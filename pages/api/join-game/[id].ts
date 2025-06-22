import type { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';
import { addPlayerToGame } from '../../../lib/gameTracking';
import { getAuth } from '@clerk/nextjs/server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  try {
    const { player_name } = req.body;
    const { id } = req.query;

    if (!player_name) {
      return res.status(400).json({ status: 'error', error: 'Player name is required' });
    }

    const lobby = await getLobby(id as string);
    if (!lobby) {
      return res.status(404).json({ status: 'error', error: 'Lobby not found' });
    }
    if (lobby.players.length >= lobby.maxPlayers) {
      return res.status(400).json({ status: 'error', error: 'Lobby is full' });
    }
    const playerId = lobby.players.length + 1;
    lobby.players.push({ id: playerId, name: player_name });
    await setLobby(lobby);

    // Add player to game tracking
    try {
      // Determine authenticated or guest user
      const { userId: clerkUserId } = getAuth(req);
      const joiningUserId = clerkUserId || 'anonymous';

      await addPlayerToGame(id as string, joiningUserId, playerId, player_name);
    } catch (error) {
      console.error('Failed to add player to game tracking:', error);
      // Don't fail the request, just log the error
    }

    return res.status(200).json({
      status: 'success',
      player_id: playerId,
      lobby: {
        players: lobby.players,
        maxPlayers: lobby.maxPlayers,
        lives: lobby.lives,
      },
    });
  } catch (error) {
    console.error('Error joining game:', error);
    return res.status(500).json({ status: 'error', error: 'Failed to join game' });
  }
} 