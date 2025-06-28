import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { getLobby } from '../persistent-store';
import { canUserReconnect, markPlayerReconnected } from '../../../lib/gameTracking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  try {
    const { gameId } = req.query;
    const { userId: clerkUserId } = getAuth(req);

    // Only authenticated users can use reconnection
    if (!clerkUserId) {
      return res.status(401).json({ 
        status: 'error', 
        error: 'Authentication required for reconnection' 
      });
    }

    if (!gameId || typeof gameId !== 'string') {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Game ID is required' 
      });
    }

    // Check if user can reconnect to this game
    const reconnectCheck = await canUserReconnect(clerkUserId, gameId);
    
    if (!reconnectCheck.canReconnect) {
      return res.status(403).json({
        status: 'error',
        error: 'Cannot reconnect to this game',
        reason: reconnectCheck.gameStatus === 'completed' 
          ? 'Game has ended' 
          : 'You were not a participant in this game'
      });
    }

    // Get current game state
    const lobby = await getLobby(gameId);
    if (!lobby) {
      return res.status(404).json({ 
        status: 'error', 
        error: 'Game not found' 
      });
    }

    // Mark player as reconnected
    await markPlayerReconnected(gameId, clerkUserId);

    // Emit reconnection event via socket
    try {
      // @ts-ignore - NextJS doesn't have type definitions for socket.server.io
      const io = res.socket?.server?.io;
      if (io) {
        io.to(gameId).emit('player-reconnected', {
          userId: clerkUserId,
          playerId: reconnectCheck.participant.playerId,
          playerName: reconnectCheck.participant.playerName,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error broadcasting reconnection:', error);
    }

    return res.status(200).json({
      status: 'success',
      message: 'Successfully reconnected to game',
      gameState: lobby.gameState,
      playerId: reconnectCheck.participant.playerId,
      playerName: reconnectCheck.participant.playerName,
      gameStatus: lobby.gameStarted ? 'active' : 'waiting'
    });

  } catch (error) {
    console.error('Error in reconnection API:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to reconnect to game',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 