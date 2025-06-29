import { Server, Socket } from 'socket.io';
import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from './persistent-store';

// Simple in-memory tracking for active connections
const activeConnections: Map<string, Set<string>> = new Map(); // gameId -> Set of socketIds
const socketToPlayer: Map<string, { gameId: string, playerId: number, userId?: string }> = new Map();

// Simple rate limiting - only for abuse prevention
const rateLimits: Map<string, number> = new Map();
const RATE_LIMIT_WINDOW = 1000; // 1 second

function checkRateLimit(socketId: string, action: string): boolean {
  const key = `${socketId}-${action}`;
  const now = Date.now();
  const lastAction = rateLimits.get(key) || 0;
  
  if (now - lastAction < RATE_LIMIT_WINDOW) {
    return false;
  }
  
  rateLimits.set(key, now);
  return true;
}

// Clean up old rate limits every minute
setInterval(() => {
  const now = Date.now();
  rateLimits.forEach((timestamp, key) => {
    if (now - timestamp > 60000) {
      rateLimits.delete(key);
    }
  });
}, 60000);

const SocketHandler = (req: NextApiRequest, res: NextApiResponse) => {
  // Check if socket.io is already initialized
  if ((res.socket as any).server?.io) {
    console.log('Socket already running');
    res.end();
    return;
  }

  console.log('Setting up socket.io server');
  
  const io = new Server((res.socket as any).server, {
    path: '/api/socket',
    addTrailingSlash: false,
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    transports: ['polling', 'websocket'],
    upgradeTimeout: 30000,
    pingTimeout: 25000,
    pingInterval: 10000
  });

  (res.socket as any).server.io = io;
  console.log('Socket.io server created successfully');

  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Join game room
    socket.on('join-game', async ({ gameId, playerId, playerName, userId }: { gameId: string, playerId: number, playerName: string, userId?: string }) => {
      // Simple rate limiting
      if (!checkRateLimit(socket.id, 'join-game')) {
        return;
      }

      try {
        console.log(`Player ${playerId} (${playerName}) joining game ${gameId}, userId: ${userId || 'guest'}`);
        
        // Track this connection
        if (!activeConnections.has(gameId)) {
          activeConnections.set(gameId, new Set());
        }
        activeConnections.get(gameId)!.add(socket.id);
        socketToPlayer.set(socket.id, { gameId, playerId, userId });

        // Join socket room
        await socket.join(gameId);
        console.log(`Player ${playerId} joined socket room ${gameId}`);

        // Mark authenticated user as connected (not guests)
        if (userId && !userId.startsWith('guest_') && userId !== 'anonymous') {
          import('../../lib/gameTracking').then(({ markPlayerReconnected }) => {
            markPlayerReconnected(gameId, userId)
              .catch((error: any) => console.error('Error marking player as connected:', error));
          });
        }

        // Get current game state and send immediately
        const lobby = await getLobby(gameId);
        if (lobby?.gameState) {
          socket.emit('game-state-update', {
            gameState: lobby.gameState,
            immediate: true,
            timestamp: Date.now()
          });
          console.log(`Sent immediate game state to player ${playerId}`);
        }

        // Notify other players
        socket.to(gameId).emit('player-joined', { playerId, playerName });

      } catch (error) {
        console.error(`Error in join-game:`, error);
        socket.emit('action-error', { error: 'Failed to join game' });
      }
    });

    // Leave game room
    socket.on('leave-game', async ({ gameId, playerId }: { gameId: string, playerId: number }) => {
      try {
        console.log(`Player ${playerId} leaving game ${gameId}`);
        
        // Remove from tracking
        if (activeConnections.has(gameId)) {
          activeConnections.get(gameId)!.delete(socket.id);
        }
        socketToPlayer.delete(socket.id);

        // Leave socket room
        await socket.leave(gameId);
        
        // Notify other players
        socket.to(gameId).emit('player-left', { playerId });

      } catch (error) {
        console.error(`Error in leave-game:`, error);
      }
    });

    // Handle betting updates
    socket.on('bet-made', async ({ gameId, playerId, gameState }: { gameId: string, playerId: number, gameState: any }) => {
      if (!checkRateLimit(socket.id, 'bet-made')) {
        return;
      }

      try {
        console.log(`Broadcasting bet update for player ${playerId} in game ${gameId}`);
        
        // Immediately broadcast to all players in the game
        socket.to(gameId).emit('game-state-update', {
          gameState,
          source: 'bet-made',
          playerId,
          timestamp: Date.now()
        });
        
        console.log(`Bet update broadcasted successfully`);
        
      } catch (error) {
        console.error(`Error broadcasting bet update:`, error);
      }
    });

    // Handle game start events
    socket.on('game-started', async ({ gameId, gameState }: { gameId: string, gameState: any }) => {
      try {
        console.log(`Broadcasting game start for ${gameId}`);
        
        // Broadcast to all players
        io.to(gameId).emit('game-state-update', {
          gameState,
          source: 'game-started',
          immediate: true,
          timestamp: Date.now()
        });
        
        console.log(`Game start broadcasted successfully`);
        
      } catch (error) {
        console.error(`Error broadcasting game start:`, error);
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      
      // Clean up tracking
      const playerInfo = socketToPlayer.get(socket.id);
      if (playerInfo) {
        const { gameId, playerId, userId } = playerInfo;
        if (activeConnections.has(gameId)) {
          activeConnections.get(gameId)!.delete(socket.id);
        }
        socketToPlayer.delete(socket.id);

        // Mark authenticated user as disconnected (but don't remove from game)
        if (userId && !userId.startsWith('guest_') && userId !== 'anonymous') {
          import('../../lib/gameTracking').then(({ markPlayerDisconnected }) => {
            markPlayerDisconnected(gameId, userId)
              .catch((error: any) => console.error('Error marking player as disconnected:', error));
          });
        }

        // Notify other players in the lobby about disconnection
        // This helps trigger UI updates so the disconnected player's name can be hidden/dimmed
        socket.to(gameId).emit('player-disconnected', {
          gameId,
          playerId,
          userId,
          reason: 'socket_disconnect',
          timestamp: Date.now()
        });
        
        console.log(`Notified players in game ${gameId} about player ${playerId} disconnection`);
      }
    });
  });

  res.end();
};

export default SocketHandler; 