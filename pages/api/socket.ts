import { Server, Socket } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from './persistent-store';
import { cpus } from 'os';
import cluster from 'cluster';

// Add in-memory cache for game states to reduce database access
interface GameStateCache {
  gameState: any;
  lastUpdated: number;
  version: number;
}

// Game state cache with expiration (5 minutes)
const gameStateCache: Map<string, GameStateCache> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const DB_CONNECTION_CACHE_TTL = 15 * 1000; // 15 seconds

// Database connection cache
let dbConnectionCache: any = null;
let lastDbConnectionTime = 0;

// Keep track of active connections
const activeConnections: Map<string, number> = new Map();
const activeGames: Map<string, Map<number, string>> = new Map();
// Track pending state updates to batch them
const pendingStateUpdates: Map<string, Set<number>> = new Map();

// Add connection pool for socket.io to reduce overhead
const socketPool: Map<string, { socket: Socket, lastUsed: number }> = new Map();
const SOCKET_POOL_TTL = 60 * 60 * 1000; // 1 hour

// Rate limiting mechanism
interface RateLimitEntry {
  count: number;
  resetTime: number;
  blocked: boolean;
}
const rateLimits: Map<string, RateLimitEntry> = new Map();
const RATE_LIMIT_WINDOW = 10000; // 10 seconds
const RATE_LIMIT_MAX_REQUESTS = 20; // Max 20 requests per 10 seconds
const BURST_BUFFER_SIZE = 5; // Allow bursts of 5 actions

// Add worker thread count detection
const numCPUs = cpus().length;
const ENABLE_CLUSTERING = false; // Set to true to enable multi-process socket server

// Clean up stale connections periodically
setInterval(() => {
  const now = Date.now();
  activeConnections.forEach((timestamp, socketId) => {
    if (now - timestamp > 30 * 60 * 1000) { // 30 minutes
      activeConnections.delete(socketId);
    }
  });
  
  // Clean up stale socket pool connections
  socketPool.forEach((entry, socketId) => {
    if (now - entry.lastUsed > SOCKET_POOL_TTL) {
      socketPool.delete(socketId);
    }
  });
  
  // Clean up expired game state cache entries
  gameStateCache.forEach((cache, gameId) => {
    if (now - cache.lastUpdated > CACHE_TTL) {
      gameStateCache.delete(gameId);
    }
  });
}, 300000); // Run every 5 minutes

// Optimized getLobby function with caching
async function getCachedLobby(gameId: string) {
  // Check cache first
  const cacheEntry = gameStateCache.get(gameId);
  
  if (cacheEntry && Date.now() - cacheEntry.lastUpdated < CACHE_TTL) {
    console.log(`Using cached game state for ${gameId}, version ${cacheEntry.version}`);
    return { gameState: cacheEntry.gameState, version: cacheEntry.version };
  }
  
  // Cache miss or expired, fetch from database
  console.log(`Cache miss for ${gameId}, fetching from database`);
  const lobby = await getLobby(gameId);
  
  if (lobby?.gameState) {
    // Update cache
    gameStateCache.set(gameId, {
      gameState: lobby.gameState,
      lastUpdated: Date.now(),
      version: (cacheEntry?.version || 0) + 1
    });
  }
  
  return lobby;
}

// Optimized setLobby function that updates cache
async function setCachedLobby(lobby: any) {
  if (!lobby?.gameId || !lobby?.gameState) {
    return await setLobby(lobby);
  }
  
  // Update cache before saving to database
  const currentCache = gameStateCache.get(lobby.gameId);
  gameStateCache.set(lobby.gameId, {
    gameState: lobby.gameState,
    lastUpdated: Date.now(),
    version: (currentCache?.version || 0) + 1
  });
  
  return await setLobby(lobby);
}

// Batch game state updates to reduce emissions
function scheduleGameStateUpdate(gameId: string, playerId: number, io: Server) {
  if (!pendingStateUpdates.has(gameId)) {
    pendingStateUpdates.set(gameId, new Set());
  }
  
  pendingStateUpdates.get(gameId)!.add(playerId);
  
  // Debounce the update to batch multiple changes
  setTimeout(async () => {
    if (pendingStateUpdates.has(gameId)) {
      const playerIds = pendingStateUpdates.get(gameId)!;
      pendingStateUpdates.delete(gameId);
      
      if (playerIds.size > 0) {
        try {
          const lobby = await getCachedLobby(gameId);
          if (lobby?.gameState) {
            console.log(`Batched game state update for game ${gameId}, ${playerIds.size} players`);
            
            // Emit to the whole room
            io.to(gameId).emit('game-state-update', { 
              gameState: lobby.gameState,
              version: gameStateCache.get(gameId)?.version || 0
            });
          }
        } catch (error) {
          console.error(`Error sending batched game state update for ${gameId}:`, error);
        }
      }
    }
  }, 50); // Small delay to batch updates
}

// Add more sophisticated rate limiting with burst handling
const checkRateLimit = (clientId: string, action: string): boolean => {
  const key = `${clientId}-${action}`;
  const now = Date.now();
  
  // Get or create the rate limit entry
  if (!rateLimits.has(key)) {
    rateLimits.set(key, {
      count: 0,
      resetTime: now + RATE_LIMIT_WINDOW,
      blocked: false
    });
  }
  
  const entry = rateLimits.get(key)!;
  
  // If time window expired, reset the counter
  if (now > entry.resetTime) {
    entry.count = 0;
    entry.resetTime = now + RATE_LIMIT_WINDOW;
    entry.blocked = false;
  }
  
  // If it's blocked, reject immediately
  if (entry.blocked) {
    return false;
  }
  
  // Increment the counter
  entry.count++;
  
  // Check if we're over the limit
  if (entry.count > RATE_LIMIT_MAX_REQUESTS) {
    // But allow occasional bursts (if we're just slightly over)
    if (entry.count <= RATE_LIMIT_MAX_REQUESTS + BURST_BUFFER_SIZE) {
      console.log(`Allowing burst traffic for ${clientId} on ${action}, count: ${entry.count}`);
      return true;
    }
    
    // If we're way over, block for the remainder of the window
    entry.blocked = true;
    console.log(`Rate limit exceeded for ${clientId} on ${action}, blocking until reset`);
    return false;
  }
  
  return true;
};

const SocketHandler = (req: NextApiRequest, res: NextApiResponse) => {
  // Check if socket.io is already initialized
  if ((res.socket as any).server?.io) {
    console.log('Socket already running');
    res.end();
    return;
  }

  // Ensure we have a valid server instance
  const server = (res.socket as any).server;
  if (!server) {
    console.error('No server instance available for socket.io');
    res.status(500).json({ error: 'Server not available' });
    return;
  }

  // Additional check for server readiness
  if (!server.httpServer && !server.listen) {
    console.error('Server instance is not ready for socket.io');
    res.status(500).json({ error: 'Server not ready' });
    return;
  }

  console.log('Setting up socket.io server');

  // Clustering support for scaling websocket connections
  if (ENABLE_CLUSTERING && cluster.isPrimary) {
    console.log(`Master socket.io process running on ${process.pid}`);
    
    // Create a worker for each CPU core
    for (let i = 0; i < Math.min(2, numCPUs); i++) {
      cluster.fork();
    }
    
    // If a worker dies, create another one
    cluster.on('exit', (worker, code, signal) => {
      console.log(`Socket.io worker ${worker.process.pid} died, creating new worker`);
      cluster.fork();
    });
    
    // Return early - the master process doesn't handle connections
    res.end();
    return;
  }

  // Modify the socket.io server options to add performance settings
  let io;
  try {
    io = new Server(server, {
      path: '/api/socket-io',
      addTrailingSlash: false,
      pingTimeout: 60000, // 1 minute - reduced for dev stability
      pingInterval: 25000, // 25 seconds
      cookie: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      maxHttpBufferSize: 1e6, // 1MB
      connectTimeout: 30000, // 30 seconds - reduced timeout
      transports: ['polling', 'websocket'], // Prioritize polling to avoid upgrade issues
      allowUpgrades: false, // Disable upgrades to prevent binding errors
      // Simplified compression settings
      perMessageDeflate: false, // Disable compression to reduce complexity
      // Performance settings
      serveClient: false, // Don't serve the client JS file
      httpCompression: false, // Disable HTTP compression for dev stability
      // Disable connection state recovery for dev mode stability
    });
    
    server.io = io;
    console.log('Socket.io server created successfully');
  } catch (error) {
    console.error('Failed to create socket.io server:', error);
    res.status(500).json({ error: 'Failed to initialize socket server' });
    return;
  }

  // Track ongoing actions to prevent duplicates
  const ongoingActions: Map<string, number> = new Map();
  
  // Clean up stale actions periodically
  setInterval(() => {
    const now = Date.now();
    ongoingActions.forEach((timestamp, key) => {
      if (now - timestamp > 30000) { // 30 seconds
        ongoingActions.delete(key);
      }
    });
  }, 60000); // Run every minute

  io.on('connection', socket => {
    console.log(`Socket connected: ${socket.id}`);
    activeConnections.set(socket.id, Date.now());
    
    // Create a throttle mechanism for this socket
    const socketThrottle: Map<string, number> = new Map();
    
    // Helper function to throttle events
    const throttleEvent = (eventName: string, data: any, cooldown = 2000): boolean => {
      const key = `${eventName}-${JSON.stringify(data)}`;
      const now = Date.now();
      const lastTime = socketThrottle.get(key) || 0;
      
      if (now - lastTime < cooldown) {
        return false;
      }
      
      socketThrottle.set(key, now);
      return true;
    };

    // Add custom properties to socket
    interface CustomSocket extends Socket {
      gameId?: string;
      playerId?: number;
      lastStateVersion?: number;
    }
    const typedSocket = socket as CustomSocket;

    // Join a game room with optimistic updates
    socket.on('join-game', async ({ gameId, playerId, playerName, requestImmediate }: { gameId: string, playerId: number, playerName: string, requestImmediate?: boolean }) => {
      // Reduce throttling for join events to allow faster connections
      if (!throttleEvent('join-game', { gameId, playerId }, 1000)) {
        console.log(`Throttled join-game event for player ${playerId}`);
        return;
      }
      
      try {
        console.log(`Player ${playerId} (${playerName}) joining game ${gameId}${requestImmediate ? ' with immediate request' : ''}`);
        
        // Track this socket's game association 
        typedSocket.gameId = gameId;
        typedSocket.playerId = playerId;
        typedSocket.lastStateVersion = 0;
        
        // Keep track of sockets in this game
        if (!activeGames.has(gameId)) {
          activeGames.set(gameId, new Map());
        }
        activeGames.get(gameId)?.set(playerId, socket.id);
        
        await socket.join(gameId);
        
        // Get current lobby with caching
        const lobby = await getCachedLobby(gameId);
        if (lobby) {
          // Send initial state immediately (optimistically)
          const cacheEntry = gameStateCache.get(gameId);
          if (cacheEntry) {
            typedSocket.lastStateVersion = cacheEntry.version;
          }
          
          // Send current game state to joining player IMMEDIATELY
          socket.emit('game-state-update', { 
            gameState: lobby.gameState,
            version: cacheEntry?.version || 0,
            immediate: true
          });
          console.log(`Sent ${requestImmediate ? 'IMMEDIATE' : 'initial'} game state to player ${playerId}`);
          
          // Notify room of new player (after sending state to reduce delays)
          socket.to(gameId).emit('player-joined', { playerId, playerName });
          
          // Update player's last activity time
          if (lobby.gameState && !lobby.gameState.last_activity) {
            lobby.gameState.last_activity = {};
          }
          
          if (lobby.gameState) {
            lobby.gameState.last_activity[playerId] = Date.now();
            // Use cached setLobby
            await setCachedLobby(lobby);
          }
          
          // If immediate request, also send a follow-up state to ensure consistency
          if (requestImmediate) {
            setTimeout(() => {
              socket.emit('game-state-update', { 
                gameState: lobby.gameState,
                version: cacheEntry?.version || 0,
                followUp: true
              });
            }, 100);
          }
        } else {
          console.error(`Failed to find lobby ${gameId} for player ${playerId}`);
          socket.emit('action-error', { error: 'Game not found' });
        }
      } catch (error) {
        console.error(`Error in join-game handler:`, error);
        socket.emit('action-error', { error: 'Failed to join game' });
      }
    });

    // Add immediate game state request handler for faster updates
    socket.on('request-game-state', async ({ gameId, playerId }: { gameId: string, playerId: number }) => {
      try {
        console.log(`Player ${playerId} requesting immediate game state for ${gameId}`);
        
        // Get current lobby with caching
        const lobby = await getCachedLobby(gameId);
        if (lobby) {
          const cacheEntry = gameStateCache.get(gameId);
          
          // Send current game state immediately
          socket.emit('game-state-update', { 
            gameState: lobby.gameState,
            version: cacheEntry?.version || 0,
            requested: true
          });
          console.log(`Sent requested game state to player ${playerId}`);
        } else {
          socket.emit('action-error', { error: 'Game not found' });
        }
      } catch (error) {
        console.error(`Error in request-game-state handler:`, error);
        socket.emit('action-error', { error: 'Failed to get game state' });
      }
    });

    // Optimized game action handler with delta updates
    socket.on('game-action', async (data: { gameId: string, action: string, playerId: number, payload?: any, actionId?: string }) => {
      // Apply throttling first
      if (!throttleEvent('game-action', data, 500)) {
        console.log(`Throttled game-action event from player ${data.playerId}`);
        return;
      }
      
      // Then apply rate limiting
      const clientId = `${data.gameId}-${data.playerId}`;
      if (!checkRateLimit(clientId, 'game-action')) {
        console.log(`Rate limited game-action for player ${data.playerId}`);
        socket.emit('action-error', { 
          error: 'Too many requests. Please slow down.',
          retryAfter: 2000
        });
        return;
      }
      
      try {
        const { gameId, action, playerId, payload, actionId } = data;
        
        if (!gameId || !action || !playerId) {
          socket.emit('action-error', { error: 'Invalid action data' });
          return;
        }
        
        // Generate a unique action ID if not provided
        const effectiveActionId = actionId || `${gameId}-${playerId}-${action}-${Date.now()}`;
        
        // Check if this is a duplicate/rapid action
        if (action === 'play-card' || action === 'make-bet') {
          const playerActionKey = `${gameId}-${playerId}-${action}`;
          const lastAction = ongoingActions.get(playerActionKey);
          
          if (lastAction && Date.now() - lastAction < 3000) {
            // Ignore rapid actions but still acknowledge receipt to avoid retries
            console.log(`Ignoring rapid action ${action} from player ${playerId}`);
            socket.emit('action-received', { 
              actionId: effectiveActionId,
              action,
              status: 'throttled'
            });
            return;
          }
          
          // Send optimistic update for better responsiveness
          if (action === 'play-card' && payload?.cardIndex !== undefined) {
            // Optimistically update UI for card plays
            socket.to(gameId).emit('optimistic-update', {
              type: 'card-played',
              playerId,
              cardIndex: payload.cardIndex,
              actionId: effectiveActionId
            });
          } else if (action === 'make-bet' && payload?.bet !== undefined) {
            // Optimistically update UI for bets
            socket.to(gameId).emit('optimistic-update', {
              type: 'bet-made',
              playerId,
              bet: payload.bet,
              actionId: effectiveActionId
            });
          }
          
          // Mark this action as in progress
          ongoingActions.set(playerActionKey, Date.now());
        }
        
        console.log(`Game action: ${action} from player ${playerId} in game ${gameId}`);
        
        // Broadcast action to everyone else with optimistic update
        socket.to(gameId).emit('player-action', { 
          playerId, 
          action, 
          actionId: effectiveActionId,
          payload, // Include payload for optimistic updates
          timestamp: Date.now() 
        });
        
        // Acknowledge receipt of action to client
        socket.emit('action-received', { 
          actionId: effectiveActionId,
          action,
          status: 'received'
        });
      } catch (error: any) {
        console.error(`Error in game-action handler:`, error);
        socket.emit('action-error', { 
          error: 'Failed to process action',
          details: error.message
        });
      }
    });

    // Handle disconnections with reconnection grace period
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Don't remove connection immediately - give a grace period for reconnection
      setTimeout(() => {
        // After grace period, check if this socket is still disconnected
        if (!io.sockets.sockets.has(socket.id)) {
          activeConnections.delete(socket.id);
          
          // Now handle game-related cleanup if needed
          if (typedSocket.gameId && typedSocket.playerId) {
            const gameConnections = activeGames.get(typedSocket.gameId);
            if (gameConnections && gameConnections.get(typedSocket.playerId) === socket.id) {
              gameConnections.delete(typedSocket.playerId);
              
              // If game has no more connections, clean up after a longer delay
              if (typedSocket.gameId && gameConnections.size === 0) {
                setTimeout(() => {
                  // Double check there are still no connections before cleaning up
                  if (typedSocket.gameId && activeGames.has(typedSocket.gameId) && 
                      activeGames.get(typedSocket.gameId)?.size === 0) {
                    activeGames.delete(typedSocket.gameId);
                  }
                }, 60000); // 1 minute grace period for game cleanup
              }
            }
          }
        }
      }, 30000); // 30 second grace period for reconnection
    });
    
    // Error handling with better diagnostics
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
      // Try to recover if possible
      if (typedSocket.gameId && typedSocket.playerId) {
        console.log(`Attempting recovery for player ${typedSocket.playerId} in game ${typedSocket.gameId}`);
      }
    });
    
    socket.on('connect_error', (error) => {
      console.error(`Socket connection error for ${socket.id}:`, error);
    });
    
    // Handle explicit reconnection attempts with error handling
    socket.on('reconnect-attempt', async ({ gameId, playerId }: { gameId: string, playerId: number }) => {
      if (!throttleEvent('reconnect-attempt', { gameId, playerId }, 5000)) {
        console.log(`Throttled reconnect-attempt event from player ${playerId}`);
        return;
      }
      
      console.log(`Player ${playerId} attempting to reconnect to game ${gameId}`);
      try {
        // Update socket's game info
        typedSocket.gameId = gameId;
        typedSocket.playerId = playerId;
        
        // Update active games tracking
        if (!activeGames.has(gameId)) {
          activeGames.set(gameId, new Map());
        }
        activeGames.get(gameId)?.set(playerId, socket.id);
        
        await socket.join(gameId);
        const lobby = await getLobby(gameId);
        
        if (lobby) {
          // Update player's activity timestamp
          if (lobby.gameState) {
            if (!lobby.gameState.last_activity) {
              lobby.gameState.last_activity = {};
            }
            lobby.gameState.last_activity[playerId] = Date.now();
            
            // Check if player was marked as inactive and reactivate
            if (lobby.gameState.inactive_players && 
                lobby.gameState.inactive_players.includes(playerId)) {
              // Remove from inactive players list
              lobby.gameState.inactive_players = lobby.gameState.inactive_players.filter(
                (id: number) => id !== playerId
              );
              console.log(`Player ${playerId} was reactivated in game ${gameId}`);
            }
            
            // Save updated lobby state
            await setLobby(lobby);
          }
          
          // Send current game state to reconnected player
          socket.emit('game-state-update', { gameState: lobby.gameState });
          
          // Notify others that this player reconnected
          socket.to(gameId).emit('player-reconnected', { playerId });
          
          // Let the player know they're reconnected
          socket.emit('reconnected', { gameId, playerId });
        } else {
          socket.emit('error', { message: 'Game not found' });
        }
      } catch (error) {
        console.error(`Error in reconnect-attempt handler:`, error);
        socket.emit('error', { message: 'Failed to reconnect to game' });
      }
    });

    // Add heartbeat mechanism to detect and prevent disconnections
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat', { timestamp: Date.now() });
      } else {
        clearInterval(heartbeatInterval);
      }
    }, 30000); // Send heartbeat every 30 seconds
    
    socket.on('heartbeat-response', () => {
      // Just update the last activity timestamp
      activeConnections.set(socket.id, Date.now());
    });
    
    // Clean up heartbeat on disconnect
    socket.on('disconnect', () => {
      clearInterval(heartbeatInterval);
    });
  });

  // Add periodic cleanup of game data that's no longer needed
  setInterval(() => {
    const now = Date.now();
    
    // Clean up stale rate limit entries
    Array.from(rateLimits.entries()).forEach(([key, entry]) => {
      if (now > entry.resetTime) {
        rateLimits.delete(key);
      }
    });
    
    // Clean up any games that haven't been active for a while
    gameStateCache.forEach((cache, gameId) => {
      // If no activity in the last hour, clean up the game
      if (now - cache.lastUpdated > 60 * 60 * 1000) {
        console.log(`Cleaning up inactive game ${gameId}`);
        gameStateCache.delete(gameId);
        
        // Also clean up any active games tracking
        if (activeGames.has(gameId)) {
          activeGames.delete(gameId);
        }
        
        // And any pending updates
        if (pendingStateUpdates.has(gameId)) {
          pendingStateUpdates.delete(gameId);
        }
      }
    });
  }, 15 * 60 * 1000); // Run every 15 minutes

  res.end();
};

export default SocketHandler;

// API route configuration for WebSockets
export const config = {
  api: {
    bodyParser: false,
  },
};