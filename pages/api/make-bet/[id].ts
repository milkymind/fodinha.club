import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';
import { Server as SocketServer } from 'socket.io';

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
    const { player_id, bet } = req.body;
    
    // Generate caching key and fingerprint
    const cacheKey = `bet-${id}-${player_id}-${Date.now().toString().slice(0, -3)}`;
    const requestFingerprint = `bet-${id}-${player_id}-${bet}-${Date.now().toString().slice(0, -3)}`;
    
    // Add cache control headers
    res.setHeader('Cache-Control', `private, max-age=${CACHE_CONTROL_TTL}`);
    
    // Check if client sent If-None-Match header
    const ifNoneMatch = req.headers['if-none-match'];
    if (ifNoneMatch && responseCache.has(ifNoneMatch as string)) {
      const cached = responseCache.get(ifNoneMatch as string)!;
      if (Date.now() - cached.timestamp < 10000) { // Still valid for 10 seconds
        res.setHeader('ETag', cached.etag);
        return res.status(304).end(); // Not Modified
      }
    }
    
    // Validate required fields
    if (typeof player_id !== 'number' || typeof bet !== 'number') {
      return res.status(400).json({ 
        status: 'error', 
        error: 'Invalid player_id or bet value' 
      });
    }
    
    // Check if we've already processed an identical request very recently (within last 10 seconds)
    const similarRequests = Array.from(processedRequests.entries())
      .filter(([key, data]) => {
        return key.startsWith(`bet-${id}-${player_id}-${bet}`) &&
               Date.now() - data.timestamp < 10000;
      });
    
    if (similarRequests.length > 0) {
      console.log(`Returning cached result for similar bet request from player ${player_id}`);
      // Return the most recent result
      const mostRecent = similarRequests.reduce((latest, current) => {
        return latest[1].timestamp > current[1].timestamp ? latest : current;
      });
      
      // Add ETag for future 304 responses
      const etag = `bet-${id}-${player_id}-${Date.now()}`;
      res.setHeader('ETag', etag);
      
      // Store in response cache
      responseCache.set(etag, {
        timestamp: Date.now(),
        etag,
        data: mostRecent[1].result
      });
      
      return res.status(200).json(mostRecent[1].result);
    }
    
    // Check if there's an active request from this player
    const recentKey = `bet-${id}-${player_id}`;
    const activeTimestamp = Array.from(activeRequests.entries())
      .filter(([key, _]) => key.startsWith(recentKey))
      .reduce((latest, current) => {
        return latest[1] > current[1] ? latest : current;
      }, ['', 0])[1];
    
    if (activeTimestamp && (Date.now() - activeTimestamp) < 800) { // Reduced from 2000ms
      console.log(`Rate limiting bet from player ${player_id} - action in progress`);
      
      // Instead of rejecting with 429, check if there's already a cached result we can return
      const previousResults = Array.from(processedRequests.entries())
        .filter(([key, data]) => {
          return key.startsWith(`bet-${id}-${player_id}-${bet}`) &&
                 Date.now() - data.timestamp < 8000;
        });
      
      if (previousResults.length > 0) {
        console.log(`Returning previous result instead of 429 error`);
        const mostRecent = previousResults.reduce((latest, current) => {
          return latest[1].timestamp > current[1].timestamp ? latest : current;
        });
        return res.status(200).json(mostRecent[1].result);
      }
      
      // If no previous results found, send a special response that's easier to retry
      return res.status(429).json({
        status: 'retry',
        error: 'Action in progress, please retry in a moment',
        retryAfter: 800 - (Date.now() - activeTimestamp) // Tell client exactly how long to wait
      });
    }
    
    // Mark this request as active
    activeRequests.set(requestFingerprint, Date.now());
    
    console.log(`Processing bet: player ${player_id}, bet value ${bet}, game ${id}`);
    
    // Start the database operation timer
    const dbStartTime = Date.now();
    
    const lobby = await getLobby(id as string);
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
    gameState.current_player_idx = (gameState.current_player_idx + 1) % gameState.ordem_jogada.length;
    
    // If all players have bet, transition to playing phase
    if (Object.keys(gameState.palpites).length === gameState.ordem_jogada.length) {
      gameState.estado = 'jogando';
      gameState.current_player_idx = 0; // Start with first player
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
        io.to(id as string).emit('game-state-update', { 
          gameState,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error emitting socket event:', error);
    }
    
    // Generate an ETag for this response
    const etag = `bet-${id}-${player_id}-${Date.now()}`;
    res.setHeader('ETag', etag);
    
    // When returning a successful response, cache it
    const result = { status: 'success', game_state: gameState };
    
    // Store in response cache for 304 responses
    responseCache.set(etag, {
      timestamp: Date.now(),
      etag,
      data: result
    });
    
    // Store in processed requests for duplicates
    processedRequests.set(requestFingerprint, {
      timestamp: Date.now(),
      result
    });
    
    // Clear this request from active once processed
    setTimeout(() => {
      activeRequests.delete(requestFingerprint);
    }, 1000); // Reduced from 5000ms
    
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