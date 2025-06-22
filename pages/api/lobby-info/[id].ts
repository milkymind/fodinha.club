import type { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';

// Track active players per lobby (in memory)
const activePlayersCache = new Map<string, Map<number, number>>(); // gameId -> playerId -> lastSeen timestamp

// Clean up stale entries periodically
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 10 * 60 * 1000; // 10 minutes
  
  activePlayersCache.forEach((playerMap, gameId) => {
    const activePlayers = new Map();
    playerMap.forEach((lastSeen, playerId) => {
      if (now - lastSeen < staleThreshold) {
        activePlayers.set(playerId, lastSeen);
      }
    });
    
    if (activePlayers.size > 0) {
      activePlayersCache.set(gameId, activePlayers);
    } else {
      activePlayersCache.delete(gameId);
    }
  });
}, 5 * 60 * 1000); // Clean every 5 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    const playerId = req.query.playerId ? parseInt(req.query.playerId as string) : undefined;
    const forceCleanup = req.query.forceCleanup === 'true'; // Special parameter for aggressive cleanup
    
    const lobby = await getLobby(id as string);
    if (!lobby) {
      return res.status(404).json({ status: 'error', error: 'Lobby not found' });
    }

    // Track this player as active if playerId is provided
    if (playerId) {
      if (!activePlayersCache.has(id as string)) {
        activePlayersCache.set(id as string, new Map());
      }
      activePlayersCache.get(id as string)!.set(playerId, Date.now());
    }

    // CONSERVATIVE APPROACH: Only clean up players in very specific scenarios
    // For lobby waiting screen, players should ONLY be removed if:
    // 1. They explicitly called leave-game API
    // 2. Their socket disconnected AND they haven't made a request in a LONG time (5+ minutes)
    // 3. It's a post-game cleanup (between games state) with confirmed disconnection
    
    let updatedLobby = lobby;
    if (!lobby.gameStarted && lobby.players && lobby.players.length > 0) {
      const now = Date.now();
      const activePlayersInLobby = activePlayersCache.get(id as string) || new Map();
      
      // Get socket.io server to check connected players
      const io = (res.socket as any)?.server?.io;
      let connectedPlayerIds = new Set<number>();
      
      if (io) {
        // Check which players are actually connected via socket
        const room = io.sockets.adapter.rooms.get(id as string);
        if (room) {
          // Get all sockets in the room and their associated player IDs
          room.forEach((socketId: string) => {
            const socket = io.sockets.sockets.get(socketId);
            if (socket && socket.playerId) {
              connectedPlayerIds.add(socket.playerId);
            }
          });
        }
      }
      
      // Check if this is post-game cleanup (between games state)
      const wasPreviouslyInGame = lobby.gameState !== null && lobby.gameState !== undefined;
      const isInBetweenGamesState = wasPreviouslyInGame && !lobby.gameStarted;
      
      // ONLY clean up in these very specific cases:
      let shouldCleanup = false;
      let cleanupReason = '';
      
      // Check if this is very recent post-game cleanup (within 30 seconds of returning to lobby)
      const lastCleanupTime = lobby.lastPlayerCleanup ? new Date(lobby.lastPlayerCleanup).getTime() : 0;
      const timeSinceLastCleanup = now - lastCleanupTime;
      const isVeryRecentPostGame = timeSinceLastCleanup < 30 * 1000; // 30 seconds
      
      if (isInBetweenGamesState && forceCleanup && !isVeryRecentPostGame) {
        // Post-game cleanup with force flag - but NOT if we just did cleanup recently
        shouldCleanup = true;
        cleanupReason = 'POST_GAME_FORCE';
      } else if (forceCleanup && !isVeryRecentPostGame && lobby.players.length > (connectedPlayerIds.size + activePlayersInLobby.size + 1)) {
        // Force cleanup requested AND we have way more players than active connections
        // But NOT if we just returned to lobby recently (give players time to reconnect)
        // And require at least 2 more players than active to avoid false positives
        shouldCleanup = true;
        cleanupReason = 'FORCE_STALE_DATA';
      }
      
      if (shouldCleanup) {
        const originalPlayerCount = lobby.players.length;
        
        // Very conservative cleanup - only remove players who are CLEARLY disconnected
        const activePlayers = lobby.players.filter((player: any) => {
          // ALWAYS keep the current requesting player
          if (player.id === playerId) return true;
          
          // Keep if they're socket connected (most reliable indicator)
          if (connectedPlayerIds.has(player.id)) return true;
          
          // Keep if they've made ANY request recently (even just polling)
          const lastSeen = activePlayersInLobby.get(player.id);
          if (lastSeen) {
            const timeSinceLastSeen = now - lastSeen;
            
            // For post-game cleanup, be a bit more strict (2 minutes)
            if (isInBetweenGamesState && timeSinceLastSeen < 2 * 60 * 1000) return true;
            
            // For normal lobby, be very lenient (5 minutes)
            if (!isInBetweenGamesState && timeSinceLastSeen < 5 * 60 * 1000) return true;
          }
          
          // If we get here, the player has:
          // - No socket connection AND
          // - No recent API activity (5+ minutes for normal lobby, 2+ minutes for post-game)
          console.log(`Player ${player.id} (${player.name}) marked for removal: no socket + no activity for ${lastSeen ? Math.round((now - lastSeen) / 1000) : 'unknown'} seconds`);
          return false;
        });
        
        // Only update if players were actually removed
        if (activePlayers.length !== originalPlayerCount) {
          const removedCount = originalPlayerCount - activePlayers.length;
          console.log(`Lobby ${id}: ${cleanupReason} cleanup - removed ${removedCount} players (${originalPlayerCount} -> ${activePlayers.length})`);
          
          updatedLobby = {
            ...lobby,
            players: activePlayers,
            lastPlayerCleanup: new Date().toISOString(),
            lastUpdated: new Date().toISOString()
          };
          
          // Save the updated lobby
          await setLobby(updatedLobby);
          
          // Notify connected players about the updated player list
          if (io && removedCount > 0) {
            io.to(id as string).emit('lobby-updated', {
              gameId: id,
              players: activePlayers,
              playersRemoved: removedCount,
              reason: 'confirmed_disconnect',
              cleanupType: cleanupReason
            });
            console.log(`Notified ${connectedPlayerIds.size} connected players about ${cleanupReason} lobby update`);
          }
        } else {
          console.log(`Lobby ${id}: ${cleanupReason} cleanup requested but no players needed removal`);
          // Just update the cleanup timestamp
          updatedLobby = {
            ...lobby,
            lastPlayerCleanup: new Date().toISOString()
          };
          await setLobby(updatedLobby);
        }
      } else {
        const skipReason = isVeryRecentPostGame ? 'recent post-game cleanup' : 'insufficient criteria';
        console.log(`Lobby ${id}: Skipping cleanup (${skipReason}) - ${lobby.players.length} players, ${connectedPlayerIds.size} connected, ${activePlayersInLobby.size} active, forceCleanup=${forceCleanup}`);
      }
    }
    
    return res.status(200).json({
      status: 'success',
      lobby: {
        ...updatedLobby,
        gameStarted: updatedLobby.gameStarted || false,
      },
    });
  } catch (error) {
    console.error('Error getting lobby info:', error);
    return res.status(500).json({ status: 'error', error: 'Failed to get lobby info' });
  }
} 