import type { NextApiRequest, NextApiResponse } from 'next';
import { setLobby } from './persistent-store';
import { createGameSchema, validateRequest } from '../../lib/validation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  try {
    // Validate request body
    const bodyValidation = validateRequest(createGameSchema, req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        status: 'error',
        error: bodyValidation.error
      });
    }

    const { player_name, lives, start_from } = bodyValidation.data;

    // Generate a unique game ID
    const gameId = Math.random().toString(36).substring(2, 6).toUpperCase();
    console.log(`Creating new game with ID: ${gameId}`);
    
    // Create the lobby object
    const numLives = typeof lives === 'number' ? lives : 3;
    const startFromSetting: 'one' | 'max' = start_from === 'max' ? 'max' : 'one';
    const lobby = {
      gameId,
      players: [{ id: 1, name: player_name }],
      maxPlayers: 10,
      lives: numLives,
      startFrom: startFromSetting,
      gameStarted: false,
      gameState: null,
    };

    // Save the lobby
    const success = await setLobby(lobby);
    
    if (!success) {
      console.error(`Failed to save lobby for game ${gameId}`);
      return res.status(500).json({ status: 'error', error: 'Failed to create game - database error' });
    }
    
    console.log(`Successfully created game ${gameId} for player ${player_name}`);

    return res.status(200).json({
      status: 'success',
      game_id: gameId,
      player_id: 1,
      lobby: {
        players: lobby.players,
        maxPlayers: lobby.maxPlayers,
        lives: lobby.lives,
      },
    });
  } catch (error) {
    console.error('Error creating game:', error);
    return res.status(500).json({ status: 'error', error: 'Failed to create game - server error' });
  }
} 