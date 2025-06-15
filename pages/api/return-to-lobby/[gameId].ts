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

    // Reset the game state to lobby state
    const updatedLobby = {
      ...lobby,
      gameStarted: false,
      gameState: null // Clear the game state to return to lobby
    };

    // Save the updated lobby
    await setLobby(updatedLobby);

    // Notify all players via socket that the game has returned to lobby
    const io = (res.socket as any)?.server?.io;
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