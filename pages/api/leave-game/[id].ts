import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { player_id } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ status: 'error', error: 'Game ID is required' });
  }

  if (!player_id || typeof player_id !== 'number') {
    return res.status(400).json({ status: 'error', error: 'Player ID is required' });
  }

  try {
    console.log(`Processing leave-game request for game ${id}, player ${player_id}`);
    
    // Get the current lobby
    const lobby = await getLobby(id);
    if (!lobby) {
      return res.status(404).json({ status: 'error', error: 'Game not found' });
    }

    // Find and remove the player from the lobby
    const originalPlayerCount = lobby.players.length;
    lobby.players = lobby.players.filter((player: any) => player.id !== player_id);
    
    if (lobby.players.length === originalPlayerCount) {
      // Player wasn't in the lobby anyway
      console.log(`Player ${player_id} was not in lobby ${id}`);
      return res.status(200).json({ 
        status: 'success', 
        message: 'Player was not in lobby',
        players_remaining: lobby.players.length
      });
    }

    // Update lobby metadata
    lobby.lastPlayerCleanup = new Date().toISOString();
    lobby.lastUpdated = new Date().toISOString();

    // If this was an active game and now there are no players, be conservative about cleanup
    if (lobby.players.length === 0) {
      // If the game was started, give it a grace period before cleanup
      // This prevents clearing state during lobby-to-game transitions
      if (lobby.gameStarted && lobby.gameState) {
        console.log(`All players left active game ${id} - delaying cleanup for potential reconnection`);
        // Don't immediately clear - let reconnections happen
        // Periodic cleanup will handle truly abandoned games
      } else {
        console.log(`All players left game ${id} - cleaning up (game never started)`);
        lobby.gameStarted = false;
        lobby.gameState = null;
      }
    } 
    // If this was the host leaving and there are other players, transfer host to next player
    else if (lobby.players.length > 0) {
      // The first player in the array is always considered the host
      console.log(`Player ${player_id} left, ${lobby.players.length} players remaining. New host: ${lobby.players[0].name} (ID: ${lobby.players[0].id})`);
    }

    // Save the updated lobby
    await setLobby(lobby);

    // Notify other players via socket that this player left
    const io = (res.socket as any)?.server?.io;
    if (io) {
      console.log(`Broadcasting player leave to game ${id}`);
      
      // Notify remaining players
      io.to(id).emit('player-left', { 
        playerId: player_id,
        gameId: id,
        playersRemaining: lobby.players.length,
        reason: 'explicit_leave'
      });
      
      // Force lobby refresh for all remaining players
      io.to(id).emit('force-lobby-refresh', {
        gameId: id,
        reason: 'player_left',
        playerId: player_id,
        immediate: true
      });
      
      console.log(`Notified remaining players about player ${player_id} leaving`);
    } else {
      console.warn('Socket.io server not available for broadcasting player leave');
    }

    console.log(`Successfully removed player ${player_id} from game ${id}. Players remaining: ${lobby.players.length}`);
    
    return res.status(200).json({ 
      status: 'success', 
      message: 'Player removed from lobby successfully',
      players_remaining: lobby.players.length,
      new_host: lobby.players.length > 0 ? lobby.players[0] : null
    });
  } catch (error) {
    console.error('Error removing player from lobby:', error);
    return res.status(500).json({ status: 'error', error: 'Internal server error' });
  }
} 