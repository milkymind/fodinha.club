import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';
import { Server as SocketServer } from 'socket.io';
import { makeBetSchema, gameIdSchema, validateRequest } from '../../../lib/validation';

interface GameState {
  players: number[];
  player_names: { [key: number]: string };
  vidas: { [key: number]: number };
  estado: string;
  carta_meio?: string;
  manilha?: string;
  maos: { [key: number]: string[] };
  palpites: { [key: number]: number };
  initial_lives: number;
  current_round?: number;
  current_hand?: number;
  current_player_idx: number;
  ordem_jogada: number[];
  multiplicador: number;
  soma_palpites: number;
  mesa: [number, string][];
  vitorias: { [key: number]: number };
  dealer?: number;
  first_player?: number;
  cartas: number;
  eliminados: number[];
  direction?: 'up' | 'down';
  original_maos?: { [key: number]: string[] };
  middle_card_workaround?: { // Track middle card workaround usage
    used: boolean;
    card?: string;
  };
}

// Add response cache for faster 304 responses
interface CachedResponse {
  timestamp: number;
  etag: string;
  data: any;
}

// Keep track of ongoing requests to prevent duplicates
const activeRequests = new Map<string, number>();
const processedRequests = new Map<string, { timestamp: number, result: any }>();
const responseCache = new Map<string, CachedResponse>();
const CACHE_CONTROL_TTL = 5; // 5 second cache control header

// Clean up old requests every 30 seconds
setInterval(() => {
  const now = Date.now();
  activeRequests.forEach((timestamp, key) => {
    if (now - timestamp > 30000) { // 30 seconds
      activeRequests.delete(key);
    }
  });
  
  // Clean up processed requests after 2 minutes
  processedRequests.forEach((data, key) => {
    if (now - data.timestamp > 120000) { // 2 minutes
      processedRequests.delete(key);
    }
  });
  
  // Clean up response cache after 5 minutes
  responseCache.forEach((data, key) => {
    if (now - data.timestamp > 300000) { // 5 minutes
      responseCache.delete(key);
    }
  });
}, 30000);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }
  
  try {
    const { id } = req.query;
    
    // Validate game ID - handle Next.js dynamic route parameter
    const gameId = Array.isArray(id) ? id[0] : id;
    const gameIdValidation = validateRequest(gameIdSchema, gameId);
    if (!gameIdValidation.success) {
      return res.status(400).json({
        status: 'error',
        error: `Invalid game ID: ${gameIdValidation.error}`
      });
    }
    
    // Validate request body
    const bodyValidation = validateRequest(makeBetSchema, req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        status: 'error',
        error: bodyValidation.error
      });
    }
    
    const { player_id, bet } = bodyValidation.data;
    
    // Generate caching key and fingerprint
    const cacheKey = `bet-${gameId}-${player_id}-${Date.now().toString().slice(0, -3)}`;
    const requestFingerprint = `bet-${gameId}-${player_id}-${bet}-${Date.now().toString().slice(0, -3)}`;
    
    // Simple no-cache headers for betting
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Simple duplicate request check - shorter window
    const duplicateKey = `bet-${gameId}-${player_id}`;
    const recentRequest = processedRequests.get(duplicateKey);
    
    if (recentRequest && Date.now() - recentRequest.timestamp < 2000) {
      console.log(`Ignoring duplicate bet from player ${player_id}`);
      return res.status(200).json(recentRequest.result);
    }
    
    console.log(`Processing bet: player ${player_id}, bet value ${bet}, game ${gameId}`);
    
    // Start the database operation timer
    const dbStartTime = Date.now();
    
    const lobby = await getLobby(gameId as string);
    if (!lobby) {
      return res.status(404).json({ status: 'error', error: 'Game not found' });
    }
    
    const dbTime = Date.now() - dbStartTime;
    if (dbTime > 100) {
      console.log(`Slow database fetch: ${dbTime}ms to fetch lobby`);
    }
    
    const gameState = lobby.gameState as GameState;
    if (!gameState) {
      return res.status(404).json({ status: 'error', error: 'Game state not found' });
    }
    
    // Game state validation
    if (gameState.estado !== 'apostas') {
      return res.status(400).json({ status: 'error', error: 'Not in betting phase' });
    }
    
    const currentPlayer = gameState.ordem_jogada[gameState.current_player_idx];
    if (currentPlayer !== player_id) {
      return res.status(400).json({ status: 'error', error: 'Not your turn to bet' });
    }
    
    // Check if bet is valid
    if (bet < 0 || bet > gameState.cartas) {
      return res.status(400).json({ 
        status: 'error', 
        error: `Bet must be between 0 and ${gameState.cartas}` 
      });
    }
    
    // If the sum of bets would match the number of cards and this is the last player to bet,
    // make sure the bet doesn't make total bets equal the number of cards in hand
    if (gameState.current_player_idx === gameState.ordem_jogada.length - 1) {
      const currentTotal = Object.values(gameState.palpites).reduce((a: number, b: number) => a + b, 0);
      
      if (currentTotal + bet === gameState.cartas) {
        return res.status(400).json({ 
          status: 'error', 
          error: 'Last player cannot make the total bets equal to the number of cards.' 
        });
      }
    }
    
    // Record the bet
    gameState.palpites[player_id] = bet;
    
    // Calculate sum of palpites
    gameState.soma_palpites = Object.values(gameState.palpites).reduce((a: number, b: number) => a + b, 0);
    
    // Move to next player
    console.log(`Before: current_player_idx=${gameState.current_player_idx}, bets=${JSON.stringify(gameState.palpites)}`);
    gameState.current_player_idx = (gameState.current_player_idx + 1) % gameState.ordem_jogada.length;
    console.log(`After: current_player_idx=${gameState.current_player_idx}`);
    
    // If all players have bet, transition to playing phase
    if (Object.keys(gameState.palpites).length === gameState.ordem_jogada.length) {
      console.log('All players have bet, transitioning to playing phase');
      gameState.estado = 'jogando';
      gameState.current_player_idx = 0; // Start with first player
    } else {
      console.log(`Still waiting for bets: ${Object.keys(gameState.palpites).length}/${gameState.ordem_jogada.length}`);
    }
    
    // Save updated game state - time this operation too
    const saveStartTime = Date.now();
    
    lobby.gameState = gameState;
    const saveResult = await setLobby(lobby);
    
    const saveTime = Date.now() - saveStartTime;
    if (saveTime > 100) {
      console.log(`Slow database save: ${saveTime}ms to save lobby`);
    }
    
    if (!saveResult) {
      console.error(`Failed to save lobby after bet from player ${player_id}`);
      return res.status(500).json({ 
        status: 'error', 
        error: 'Failed to save game state' 
      });
    }
    
    // Emit the updated game state via WebSockets if available
    try {
      // @ts-ignore - NextJS doesn't have type definitions for socket.server.io
      const io = res.socket?.server?.io;
      if (io) {
        console.log(`Emitting game state update to game ${gameId} via socket`);
        io.to(gameId as string).emit('game-state-update', { 
          gameState,
          timestamp: Date.now(),
          version: Date.now(), // Add version for consistency
          source: 'make-bet'
        });
        console.log(`Successfully emitted game state update for bet from player ${player_id}`);
      } else {
        console.warn('Socket.IO server not available for game state emission');
      }
    } catch (error) {
      console.error('Error emitting socket event:', error);
    }
    
    // No additional headers needed for simple response
    
    // When returning a successful response, cache it simply
    const result = { status: 'success', game_state: gameState };
    
    // Store in processed requests for duplicates (simplified)
    processedRequests.set(duplicateKey, {
      timestamp: Date.now(),
      result
    });
    
    // Clear processed request after timeout
    setTimeout(() => {
      processedRequests.delete(duplicateKey);
    }, 5000);
    
    // Measure total request time
    const totalTime = Date.now() - dbStartTime;
    if (totalTime > 200) {
      console.log(`Slow request: ${totalTime}ms to process bet`);
    }
    
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error in make-bet handler for game ${req.query.id}:`, error);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Server error - please try again',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 