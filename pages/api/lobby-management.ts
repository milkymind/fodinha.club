import type { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { getLobby, setLobby } from './persistent-store';
import { getActiveGamesForUser, canUserReconnect } from '../../lib/gameTracking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { userId: clerkUserId } = getAuth(req);
    
    switch (req.method) {
      case 'GET':
        return await handleGetLobbyStatus(req, res, clerkUserId);
      case 'POST':
        return await handleLobbyAction(req, res, clerkUserId);
      default:
        return res.status(405).json({ status: 'error', error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in lobby management:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Lobby management failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Get comprehensive lobby status for user
async function handleGetLobbyStatus(req: NextApiRequest, res: NextApiResponse, clerkUserId: string | null) {
  const { gameId } = req.query;

  // Get current lobby info
  const lobby = gameId ? await getLobby(gameId as string) : null;
  
  // For authenticated users, check for active games they can rejoin
  let activeGames: any[] = [];
  if (clerkUserId) {
    activeGames = await getActiveGamesForUser(clerkUserId);
  }

  return res.status(200).json({
    status: 'success',
    lobby: lobby ? {
      gameId: lobby.gameId,
      players: lobby.players,
      maxPlayers: lobby.maxPlayers,
      lives: lobby.lives,
      gameStarted: lobby.gameStarted,
      playerCount: lobby.players.length
    } : null,
    user: {
      isAuthenticated: !!clerkUserId,
      userId: clerkUserId,
      canReconnect: activeGames.length > 0,
      activeGames: activeGames.map(game => ({
        gameId: game.gameId,
        playerName: game.playerName,
        playerId: game.playerId,
        startedAt: game.startedAt,
        livesRemaining: game.livesRemaining,
        isConnected: game.isConnected
      }))
    }
  });
}

// Handle lobby actions (join, leave, reconnect)
async function handleLobbyAction(req: NextApiRequest, res: NextApiResponse, clerkUserId: string | null) {
  const { action, gameId, playerName } = req.body;

  switch (action) {
    case 'check-reconnection':
      return await handleReconnectionCheck(res, clerkUserId, gameId);
    
    case 'get-lobby-health':
      return await handleLobbyHealth(res, gameId);
    
    default:
      return res.status(400).json({
        status: 'error',
        error: 'Invalid action. Use: check-reconnection, get-lobby-health'
      });
  }
}

// Check if user can reconnect to specific game
async function handleReconnectionCheck(res: NextApiResponse, clerkUserId: string | null, gameId: string) {
  if (!clerkUserId) {
    return res.status(401).json({
      status: 'error',
      error: 'Authentication required for reconnection check'
    });
  }

  if (!gameId) {
    return res.status(400).json({
      status: 'error',
      error: 'Game ID is required'
    });
  }

  const reconnectCheck = await canUserReconnect(clerkUserId, gameId);
  
  return res.status(200).json({
    status: 'success',
    canReconnect: reconnectCheck.canReconnect,
    gameStatus: reconnectCheck.gameStatus,
    participant: reconnectCheck.participant ? {
      playerId: reconnectCheck.participant.playerId,
      playerName: reconnectCheck.participant.playerName,
      livesRemaining: reconnectCheck.participant.livesRemaining,
      isConnected: reconnectCheck.participant.isConnected
    } : null
  });
}

// Get lobby health and connection status
async function handleLobbyHealth(res: NextApiResponse, gameId: string) {
  if (!gameId) {
    return res.status(400).json({
      status: 'error',
      error: 'Game ID is required'
    });
  }

  const lobby = await getLobby(gameId);
  if (!lobby) {
    return res.status(404).json({
      status: 'error',
      error: 'Lobby not found'
    });
  }

  // Calculate lobby health metrics
  const health = {
    gameId: lobby.gameId,
    playerCount: lobby.players.length,
    maxPlayers: lobby.maxPlayers,
    gameStarted: lobby.gameStarted,
    isWaitingForPlayers: !lobby.gameStarted && lobby.players.length < 2,
    canStart: !lobby.gameStarted && lobby.players.length >= 2,
    status: lobby.gameStarted ? 'active' : 
            lobby.players.length >= 2 ? 'ready' : 'waiting',
    lastUpdated: Date.now()
  };

  return res.status(200).json({
    status: 'success',
    health
  });
} 