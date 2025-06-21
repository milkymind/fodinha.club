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

    // If this is a lobby (not an active game), clean up disconnected players
    let updatedLobby = lobby;
    if (!lobby.gameStarted && lobby.players && lobby.players.length > 0) {
      const now = Date.now();
      const activePlayersInLobby = activePlayersCache.get(id as string) || new Map();
      
      // Force more aggressive cleanup if we detect potential issues
      const hasStaleData = lobby.players.length > (activePlayersInLobby.size + 1); // +1 for current player
      
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
      
      // Only clean up if we haven't cleaned up in the last 1 second (maximum responsiveness)
      // OR if we detect stale data, clean up immediately
      // OR if forceCleanup is requested, bypass all delays
      const cleanupThreshold = 1 * 1000; // 1 second
      const shouldCleanup = forceCleanup || hasStaleData || !lobby.lastPlayerCleanup || 
        (now - new Date(lobby.lastPlayerCleanup).getTime()) > cleanupThreshold;
      
      if (shouldCleanup) {
        // Filter out players who haven't been seen recently and aren't connected
        const originalPlayerCount = lobby.players.length;
        const recentActivityThreshold = 6 * 1000; // 6 seconds for API activity (very aggressive)
        
        const activePlayers = lobby.players.filter((player: any) => {
          // Keep the player if:
          // 1. They're the current requesting player (always keep)
          if (player.id === playerId) return true;
          
          // 2. They've made an API call recently (within 45 seconds)
          const lastSeen = activePlayersInLobby.get(player.id);
          const hasRecentActivity = lastSeen && (now - lastSeen) < recentActivityThreshold;
          
          // 3. They're connected via socket (real-time check)
          const isSocketConnected = connectedPlayerIds.has(player.id);
          
          // Keep player if they have recent activity OR are socket connected
          return hasRecentActivity || isSocketConnected;
        });
        
        // Only update if players were actually removed
        if (activePlayers.length !== originalPlayerCount) {
          const removedCount = originalPlayerCount - activePlayers.length;
          const cleanupType = forceCleanup ? 'FORCE' : hasStaleData ? 'STALE' : 'REGULAR';
          console.log(`Lobby ${id}: ${cleanupType} cleanup - removed ${removedCount} players (${originalPlayerCount} -> ${activePlayers.length})`);
          
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
              reason: 'player_disconnect',
              cleanupType
            });
            console.log(`Notified ${connectedPlayerIds.size} connected players about ${cleanupType} lobby update`);
          }
        } else {
          // Just update the cleanup timestamp
          updatedLobby = {
            ...lobby,
            lastPlayerCleanup: new Date().toISOString()
          };
          await setLobby(updatedLobby);
        }
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