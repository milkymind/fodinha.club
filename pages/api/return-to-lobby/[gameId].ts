import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { gameId } = req.query;
  const { player_id } = req.body;

  if (!gameId || typeof gameId !== 'string') {
    return res.status(400).json({ error: 'Game ID is required' });
  }

  if (!player_id || typeof player_id !== 'number') {
    return res.status(400).json({ error: 'Player ID is required' });
  }

  try {
    console.log(`Processing return-to-lobby request for game ${gameId}, player ${player_id}`);
    
    // Get the current lobby
    const lobby = await getLobby(gameId);
    if (!lobby) {
      return res.status(404).json({ error: 'Game not found' });
    }

    // Check if the requesting player is the host (first player)
    const isHost = lobby.players.length > 0 && lobby.players[0].id === player_id;
    if (!isHost) {
      return res.status(403).json({ error: 'Only the host can return the game to lobby' });
    }

    // Get socket.io server to check which players are still connected
    const io = (res.socket as any)?.server?.io;
    let connectedPlayerIds = new Set<number>();
    let activePlayersFromPolling = new Set<number>();
    
    if (io) {
      // Check which players are actually connected via socket
      const room = io.sockets.adapter.rooms.get(gameId);
      if (room) {
        room.forEach((socketId: string) => {
          const socket = io.sockets.sockets.get(socketId);
          if (socket && socket.playerId) {
            connectedPlayerIds.add(socket.playerId);
          }
        });
      }
      console.log(`Connected players via socket: [${Array.from(connectedPlayerIds).join(', ')}]`);
    }

    // Also check recent API activity (players who have been polling recently)
    // This catches players who might have lost socket connection but are still active
    const now = Date.now();
    const recentActivityThreshold = 2 * 60 * 1000; // 2 minutes for post-game cleanup
    
    // Note: We can't access the activePlayersCache from here, so we'll be conservative
    // and only remove players who are definitely not connected via socket
    
    // Filter players to only keep those who are:
    // 1. Still in the current lobby (if they called leave-game API, they would already be removed)
    // 2. We'll be conservative and keep all players who were in the game unless they explicitly left
    
    // For post-game cleanup, we should be more conservative
    // Only remove players if they explicitly left during the game (they would have been removed from lobby.players already)
    // Don't remove players just because they temporarily lost socket connection
    
    const activePlayersAfterGame = lobby.players.filter((player: any) => {
      // Keep all players who are still in the lobby
      // If they had left during the game, they would have been removed from lobby.players already
      console.log(`Keeping player ${player.id} (${player.name}) - still in lobby`);
      return true;
    });

    // Only log if players were actually removed (which shouldn't happen with this conservative approach)
    const removedPlayerCount = lobby.players.length - activePlayersAfterGame.length;
    if (removedPlayerCount > 0) {
      console.log(`Post-game cleanup: Removed ${removedPlayerCount} players who explicitly left during the game`);
      console.log(`Remaining players: [${activePlayersAfterGame.map(p => `${p.id}:${p.name}`).join(', ')}]`);
    } else {
      console.log(`Post-game cleanup: All ${lobby.players.length} players kept in lobby`);
      console.log(`Players: [${activePlayersAfterGame.map(p => `${p.id}:${p.name}`).join(', ')}]`);
    }

    // Reset the game state to lobby state with cleaned up player list
    const updatedLobby = {
      ...lobby,
      players: activePlayersAfterGame,
      gameStarted: false,
      gameState: null, // Clear the game state to return to lobby
      lastPlayerCleanup: new Date().toISOString(), // Mark that we just did cleanup
      lastUpdated: new Date().toISOString()
    };

    // Save the updated lobby
    await setLobby(updatedLobby);

    // Notify all players via socket that the game has returned to lobby
    // (reuse the io variable from above)
    if (io) {
      console.log(`Broadcasting lobby return to all players in game ${gameId}`);
      
      // Get room information
      const room = io.sockets.adapter.rooms.get(gameId);
      const roomSize = room?.size || 0;
      console.log(`Active sockets in room ${gameId}:`, roomSize);
      
      if (roomSize > 0) {
        console.log(`Socket IDs in room:`, Array.from(room || []));
        
        // Broadcast to all players in the game room
        io.to(gameId).emit('lobby-returned', {
          gameId,
          message: 'Game has returned to lobby'
        });
        
        // Also emit a game-state-update to ensure all players get the updated lobby state
        io.to(gameId).emit('game-state-update', {
          gameState: null, // No game state means return to lobby
          lobbyState: updatedLobby,
          version: Date.now()
        });
        
        // Notify about the cleaned lobby (no need for additional cleanup since we already did it)
        io.to(gameId).emit('force-lobby-refresh', {
          gameId,
          reason: 'return_to_lobby_cleaned',
          immediate: true,
          playersRemoved: removedPlayerCount,
          message: `Returned to lobby - ${removedPlayerCount} players who left were removed`
        });
        
        console.log(`Successfully broadcasted lobby return and state update to ${roomSize} sockets in room ${gameId}`);
      } else {
        console.warn(`No sockets found in room ${gameId} - players may not be connected via WebSocket`);
      }
    } else {
      console.warn('Socket.io server not available for broadcasting lobby return');
    }

    console.log(`Successfully returned game ${gameId} to lobby state`);
    
    return res.status(200).json({ 
      status: 'success', 
      message: 'Game returned to lobby successfully' 
    });
  } catch (error) {
    console.error('Error returning to lobby:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
} 