import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';
import { Server as SocketServer } from 'socket.io';

// Track last processed requests
const lastProcessedRequests = new Map<string, { timestamp: number, etag: string }>();

// Clear old entries periodically
setInterval(() => {
  const now = Date.now();
  lastProcessedRequests.forEach((data, key) => {
    if (now - data.timestamp > 10 * 60 * 1000) { // 10 minutes
      lastProcessedRequests.delete(key);
    }
  });
}, 5 * 60 * 1000); // Clean every 5 minutes

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  const playerId = req.headers['x-player-id'] ? parseInt(req.headers['x-player-id'] as string) : undefined;
  
  try {
    // Check if this is a cached request
    const requestKey = `${id}-${playerId || 'anonymous'}`;
    const ifNoneMatch = req.headers['if-none-match'];
    const lastProcessed = lastProcessedRequests.get(requestKey);
    
    // If the client sent an etag and it matches our last processed request,
    // and it's recent (within 5 seconds), return 304 Not Modified
    if (ifNoneMatch && 
        lastProcessed && 
        ifNoneMatch === lastProcessed.etag && 
        Date.now() - lastProcessed.timestamp < 5000) {
      res.status(304).end();
      return;
    }
    
    // Fetch the lobby data
    console.log(`Processing game-state request for game ${id}, player ${playerId || 'anonymous'}`);
    const lobby = await getLobby(id as string);
    
    if (!lobby) {
      console.log(`Game ${id} not found`);
      return res.status(404).json({ status: 'error', error: 'Game not found' });
    }
    
    if (!lobby.gameState) {
      console.log(`Game state for ${id} not found`);
      return res.status(404).json({ status: 'error', error: 'Game state not found' });
    }
    
    // Track player activity if this is a player request
    let shouldUpdateLobby = false;
    
    if (playerId) {
      const now = Date.now();
      
      // Initialize or update the last_activity tracker
      if (!lobby.gameState.last_activity) {
        lobby.gameState.last_activity = {};
        shouldUpdateLobby = true;
      }
      
      // Only update timestamp if it's been more than 5 seconds since last update
      const lastActivity = lobby.gameState.last_activity[playerId] || 0;
      if (now - lastActivity > 5000) {
        lobby.gameState.last_activity[playerId] = now;
        shouldUpdateLobby = true;
        
        // Check for inactive players (inactive for > 2 minutes)
        if (lobby.gameState.players && lobby.gameState.estado !== 'terminado') {
          const inactiveThreshold = 2 * 60 * 1000; // 2 minutes
          const activePlayers = new Set();
          
          Object.entries(lobby.gameState.last_activity).forEach(([pid, timestamp]) => {
            if ((now - (timestamp as number)) < inactiveThreshold) {
              activePlayers.add(parseInt(pid));
            }
          });
          
          // If we detect inactive players, mark them in the gameState
          const inactivePlayers = lobby.gameState.players.filter(
            (p: number) => !activePlayers.has(p) && p !== playerId
          );
          
          // Only update if the inactive players list has changed
          if (JSON.stringify(lobby.gameState.inactive_players || []) !== JSON.stringify(inactivePlayers)) {
            lobby.gameState.inactive_players = inactivePlayers;
            shouldUpdateLobby = true;
          }
        }
      }
    }
    
    // Check if we need to transition from round_over to jogando for multi-round hands
    if (lobby.gameState.estado === 'round_over' && 
        lobby.gameState.current_round && 
        lobby.gameState.cartas && 
        lobby.gameState.current_round < lobby.gameState.cartas) {
      
      // If it's been at least 2000ms since the round ended
      if (lobby.gameState.round_over_timestamp && 
          Date.now() - lobby.gameState.round_over_timestamp >= 2000) {
        
        console.log(`Starting next round after delay for game ${id}`);
        shouldUpdateLobby = true;
        
        // Clear the winning card flag for the next round
        lobby.gameState.winning_card_played_by = undefined;
        
        // Reset tie flags for the new round (important for crown highlighting)
        lobby.gameState.tie_in_previous_round = false;
        lobby.gameState.cancelled_cards = [];
        
        // Clear the table and move to the next round
        lobby.gameState.mesa = [];
        lobby.gameState.estado = 'jogando';
        
        // Increment the current round counter
        lobby.gameState.current_round++;
        console.log(`Game ${id}: Transitioning to round ${lobby.gameState.current_round} of ${lobby.gameState.cartas}`);
        
        // Reset the cards_played_this_round counter
        lobby.gameState.cards_played_this_round = 0;
        
        // Set the first player for the next round (winner of the previous round)
        const lastWinner = lobby.gameState.last_round_winner || lobby.gameState.last_trick_winner;
        if (lastWinner) {
          console.log(`Game ${id}: Round winner ${lastWinner} will start next round`);
          
          // Only include active (non-eliminated) players in the order
          const activePlayers = lobby.gameState.players.filter((p: number) => !lobby.gameState.eliminados.includes(p));
          
          // Find the index of the winner in the active players array
          const winnerIdx = activePlayers.indexOf(lastWinner);
          if (winnerIdx !== -1) {
            lobby.gameState.current_player_idx = 0;
            
            // Reorder the active players so the winner goes first
            const newOrder = [];
            for (let i = 0; i < activePlayers.length; i++) {
              const idx = (winnerIdx + i) % activePlayers.length;
              newOrder.push(activePlayers[idx]);
            }
            lobby.gameState.ordem_jogada = newOrder;
            console.log(`Game ${id}: New turn order for round ${lobby.gameState.current_round}: ${newOrder.join(', ')}`);
          } else {
            // Fallback: if winner is not found in active players, use active players in current order
            console.error(`Winner ${lastWinner} not found in active players. Using active players as fallback.`);
            lobby.gameState.ordem_jogada = activePlayers;
            lobby.gameState.current_player_idx = 0;
          }
        } else {
          // No last winner, just use active players in current order
          const activePlayers = lobby.gameState.players.filter((p: number) => !lobby.gameState.eliminados.includes(p));
          lobby.gameState.ordem_jogada = activePlayers;
          lobby.gameState.current_player_idx = 0;
        }
        
        // Reset the round_over_timestamp 
        lobby.gameState.round_over_timestamp = undefined;
      }
    }
    
    // Only save the lobby if we actually changed something
    if (shouldUpdateLobby) {
      await setLobby(lobby);
      
      // Emit the updated game state via WebSockets if available
      try {
        // @ts-ignore - NextJS doesn't have type definitions for socket.server.io
        const io = res.socket?.server?.io;
        if (io) {
          console.log(`Emitting game state update for game ${id} via socket.io`);
          io.to(id as string).emit('game-state-update', { gameState: lobby.gameState });
        }
      } catch (error) {
        console.error('Error emitting socket event:', error);
      }
    }
    
    // Generate a simple ETag based on game state
    const etag = `"${Buffer.from(JSON.stringify(lobby.gameState)).toString('base64').substring(0, 16)}"`;
    
    // Save last processed request information
    lastProcessedRequests.set(requestKey, { 
      timestamp: Date.now(),
      etag
    });
    
    // Set cache-related headers
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.status(200).json({ status: 'success', game_state: lobby.gameState });
  } catch (error) {
    console.error(`Error in game-state handler for game ${id}:`, error);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Server error - please try again later',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 