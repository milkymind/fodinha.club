import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { getActiveGamesForUser } from '../../lib/gameTracking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  try {
    const { userId: clerkUserId } = getAuth(req);

    // Only authenticated users can check their active games
    if (!clerkUserId) {
      return res.status(401).json({ 
        status: 'error', 
        error: 'Authentication required' 
      });
    }

    // Get active games for this user
    const activeGames = await getActiveGamesForUser(clerkUserId);

    return res.status(200).json({
      status: 'success',
      activeGames: activeGames.map(game => ({
        gameId: game.gameId,
        gameStatus: game.gameStatus,
        startedAt: game.startedAt,
        playerId: game.playerId,
        playerName: game.playerName,
        livesRemaining: game.livesRemaining,
        isConnected: game.isConnected,
        canReconnect: !game.isConnected || game.livesRemaining === null || game.livesRemaining > 0
      }))
    });

  } catch (error) {
    console.error('Error getting active games:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to get active games',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 