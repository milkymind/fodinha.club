import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';
import { Server as SocketServer } from 'socket.io';
import { playCardSchema, gameIdSchema, validateRequest, PlayCardRequest } from '../../../lib/validation';
import { 
  recordCardPlay, 
  createRoundRecord, 
  completeRound, 
  completeTiedRound, 
  completeHand, 
  completeGame, 
  getCurrentHandId, 
  getCurrentRoundId, 
  getUserIdFromGame 
} from '../../../lib/gameTracking';

const ORDEM_CARTAS = {
  '4': 0, '5': 1, '6': 2, '7': 3, 'Q': 4, 'J': 5, 'K': 6, 'A': 7, '2': 8, '3': 9
};

const ORDEM_NAIPE_MANILHA = {'♦': 0, '♠': 1, '♥': 2, '♣': 3};
const ORDEM_NAIPE_DESEMPATE = {'♣': 3, '♥': 2, '♠': 1, '♦': 0};

interface GameState {
  players: number[];
  player_names: { [key: number]: string };
  vidas: { [key: number]: number };
  estado: string;
  carta_meio?: string;
  manilha?: string;
  maos: { [key: number]: string[] };
  original_maos?: { [key: number]: string[] }; // For one-card hands
  palpites: { [key: number]: number };
  initial_lives: number;
  current_round?: number;
  current_hand?: number;
  current_player_idx: number;
  ordem_jogada: number[];
  multiplicador: number;
  soma_palpites?: number;
  mesa: [number, string][];
  vitorias: { [key: number]: number };
  dealer?: number;
  first_player?: number;
  cartas?: number;
  eliminados: number[];
  last_round_winner?: number;
  last_trick_winner?: number; // Keeping this for backward compatibility
  direction?: 'up' | 'down';
  startFrom?: 'one' | 'max';
  maxCardsPerPlayer?: number;
  round_over_timestamp?: number; // To add a delay between rounds
  cards_played_this_round?: number; // Track how many cards played in current round
  tie_in_previous_round?: boolean; // Track if there was a tie in previous round
  tie_resolved_by_tiebreaker?: boolean; // Track if the tie was resolved by the tiebreaker
  winning_card_played_by?: number; // Track the winning card played by
  cancelled_cards?: [number, string][]; // Track which cards are cancelled in the current round
  middle_card_workaround?: { // Track middle card workaround usage
    used: boolean;
    card?: string;
  };
}

function getCardValue(card: string): string {
  return card.substring(0, card.length - 1);
}

function getCardSuit(card: string): string {
  return card.charAt(card.length - 1);
}

function getCardStrength(card: string, manilha: string | undefined): number {
  const value = getCardValue(card);
  const suit = getCardSuit(card);
  
  if (manilha && value === manilha) {
    return 100 + ORDEM_NAIPE_MANILHA[suit as keyof typeof ORDEM_NAIPE_MANILHA];
  }
  
  return ORDEM_CARTAS[value as keyof typeof ORDEM_CARTAS] || 0;
}

// Add response cache for faster 304 responses right after the processedRequests Map definition
interface CachedResponse {
  timestamp: number;
  etag: string;
  data: any;
}

// Keep track of ongoing requests to prevent duplicates
const activeRequests = new Map<string, number>();
const processedRequests = new Map<string, { timestamp: number, result: any }>();
const responseCache = new Map<string, CachedResponse>();
const CACHE_CONTROL_TTL = 2; // 2 second cache control header for play-card (lower than bet)

// Add this to the cleanup interval
// Clean up response cache after 5 minutes
responseCache.forEach((data, key) => {
  if (Date.now() - data.timestamp > 300000) { // 5 minutes
    responseCache.delete(key);
  }
});

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
    const bodyValidation = validateRequest(playCardSchema, req.body);
    if (!bodyValidation.success) {
      return res.status(400).json({
        status: 'error',
        error: bodyValidation.error
      });
    }
    
    const { player_id, card_index } = bodyValidation.data as PlayCardRequest;
    
    // Simple no-cache headers for card playing
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    
    // Start performance monitoring
    const requestStartTime = Date.now();
    
    // Simple duplicate request check - shorter window
    const duplicateKey = `play-card-${gameId}-${player_id}`;
    const recentRequest = processedRequests.get(duplicateKey);
    
    if (recentRequest && Date.now() - recentRequest.timestamp < 1000) {
      console.log(`Ignoring duplicate card play from player ${player_id}`);
      return res.status(200).json(recentRequest.result);
    }
    
    console.log(`Processing card play: player ${player_id}, card index ${card_index}, game ${gameId}`);
    
    const lobby = await getLobby(gameId as string);
    if (!lobby) {
      return res.status(404).json({ status: 'error', error: 'Game not found' });
    }
    
    const gameState = lobby.gameState as GameState;
    if (!gameState) {
      return res.status(404).json({ status: 'error', error: 'Game state not found' });
    }
  
    // Check if we need to transition from round_over to jogando for multi-round hands
    if (gameState.estado === 'round_over' && gameState.current_round && gameState.cartas && 
        gameState.current_round < gameState.cartas) {
      console.log(`Checking if we should transition from round_over to jogando`);
      console.log(`Current round: ${gameState.current_round}, Cards per hand: ${gameState.cartas}`);
      
      // If it's been at least 1500ms since the round ended, start a new round
      const now = Date.now();
      if (gameState.round_over_timestamp && now - gameState.round_over_timestamp >= 1500) {
        console.log(`Starting next round after delay`);
        // Start the next round
        gameState.estado = 'jogando';
        gameState.current_round++;
        
        // Only clear the mesa (table) after the delay
        gameState.mesa = [];
        gameState.cards_played_this_round = 0;
        gameState.cancelled_cards = []; // Clear cancelled cards for new round
        
        // For multi-round hands within the same hand, determine who starts the next round
        const activePlayers = gameState.players.filter(p => !gameState.eliminados.includes(p));
        let firstActivePlayer: number;
        
        // If there was a tie in the previous round, the tie winner starts the next round
        if (gameState.tie_in_previous_round && gameState.last_round_winner) {
          firstActivePlayer = gameState.last_round_winner;
          console.log(`Tie in previous round - player ${firstActivePlayer} starts next round`);
        } else if (gameState.last_round_winner) {
          // Normal case - round winner starts the next round
          firstActivePlayer = gameState.last_round_winner;
          console.log(`Round winner ${firstActivePlayer} starts next round`);
        } else {
          // Fallback - use dealer/first_player logic
          if (gameState.dealer !== undefined) {
            const dealerIdx = gameState.players.indexOf(gameState.dealer);
            firstActivePlayer = gameState.first_player || activePlayers[0];
            
            // Make sure the first player is still active
            if (gameState.eliminados.includes(firstActivePlayer)) {
              // Find the next active player after the dealer
              for (let i = 1; i <= gameState.players.length; i++) {
                const nextPlayerIdx = (dealerIdx + i) % gameState.players.length;
                const nextPlayer = gameState.players[nextPlayerIdx];
                if (!gameState.eliminados.includes(nextPlayer)) {
                  firstActivePlayer = nextPlayer;
                  break;
                }
              }
            }
          } else {
            firstActivePlayer = activePlayers[0];
          }
          console.log(`Using fallback logic - player ${firstActivePlayer} starts next round`);
        }
        
        // Set up the play order with only active players, starting from the determined first player
        const firstActiveIdx = activePlayers.indexOf(firstActivePlayer);
        if (firstActiveIdx !== -1) {
          gameState.ordem_jogada = [
            ...activePlayers.slice(firstActiveIdx),
            ...activePlayers.slice(0, firstActiveIdx)
          ];
          gameState.current_player_idx = 0;
        } else {
          // Fallback if player not found in active players
          gameState.ordem_jogada = activePlayers;
          gameState.current_player_idx = 0;
        }
        
        gameState.round_over_timestamp = undefined;
      }
    }
    
    if (gameState.estado !== 'jogando') {
      return res.status(400).json({ status: 'error', error: 'Not in playing phase' });
    }
    
    const currentPlayer = gameState.ordem_jogada[gameState.current_player_idx];
    if (currentPlayer !== player_id) {
      return res.status(400).json({ status: 'error', error: 'Not your turn to play' });
    }
    
    // Initialize cards_played_this_round if not already set
    if (gameState.cards_played_this_round === undefined) {
      gameState.cards_played_this_round = gameState.mesa.length;
    }
    
    // Handle one-card hand special case - we need to use the original card from the hidden hand
    if (gameState.cartas === 1 && gameState.original_maos) {
      const originalHand = gameState.original_maos[player_id];
      if (originalHand && originalHand.length > 0) {
        // Play the card from the original hand
        const card = originalHand[card_index];
        
        // Remove card from both original and current hands to keep them in sync
        originalHand.splice(card_index, 1);
        if (gameState.maos[player_id] && gameState.maos[player_id].length > 0) {
          gameState.maos[player_id].splice(card_index, 1);
        }
        
        gameState.mesa.push([player_id, card]);
        gameState.cards_played_this_round = (gameState.cards_played_this_round || 0) + 1;
        
        // Track the card play in database
        try {
          const handId = await getCurrentHandId(gameId as string);
          let roundId = handId ? await getCurrentRoundId(handId) : null;
          
          // If this is the first card of a new round, create the round record
          if (gameState.mesa.length === 1 && handId) {
            const isMultiplierRound = gameState.soma_palpites === gameState.cartas;
            const roundRecord = await createRoundRecord({
              gameId: gameId as string,
              handId: handId,
              roundNumber: gameState.current_round || 1,
              multiplierValue: gameState.multiplicador || 1,
              isMultiplierRound: isMultiplierRound
            });
            roundId = roundRecord.id;
            console.log('Created round record:', roundRecord);
          }
          
          if (handId && roundId) {
            const playerUserId = await getUserIdFromGame(gameId as string, player_id);
            if (playerUserId) {
              await recordCardPlay({
                gameId: gameId as string,
                handId,
                roundId,
                playerId: player_id,
                userId: playerUserId,
                cardPlayed: card,
                playOrder: gameState.mesa.length
              });
            }
          }
        } catch (error) {
          console.error('Error tracking card play:', error);
          // Continue with game logic even if tracking fails
        }
        
        // Advance to the next player in the ordem_jogada (which should only contain active players)
        gameState.current_player_idx = (gameState.current_player_idx + 1) % gameState.ordem_jogada.length;
      } else {
        return res.status(400).json({ status: 'error', error: 'Invalid card index' });
      }
    } else {
      // Regular case - play from visible hand
      const hand = gameState.maos[player_id];
      if (!hand || hand.length <= card_index) {
        return res.status(400).json({ status: 'error', error: 'Invalid card index' });
      }
      
          // Play the card
    const card = hand.splice(card_index, 1)[0];
    gameState.mesa.push([player_id, card]);
    gameState.cards_played_this_round = (gameState.cards_played_this_round || 0) + 1;
    
    // Track the card play in database
    try {
      const handId = await getCurrentHandId(gameId as string);
      let roundId = await getCurrentRoundId(handId!);
      
      // If this is the first card of a new round, create the round record
      if (gameState.mesa.length === 1) {
        const isMultiplierRound = gameState.soma_palpites === gameState.cartas;
        const roundRecord = await createRoundRecord({
          gameId: gameId as string,
          handId: handId!,
          roundNumber: gameState.current_round || 1,
          multiplierValue: gameState.multiplicador || 1,
          isMultiplierRound: isMultiplierRound
        });
        roundId = roundRecord.id;
        console.log('Created round record:', roundRecord);
      }
      
      if (handId && roundId) {
        const playerUserId = await getUserIdFromGame(gameId as string, player_id);
        if (playerUserId) {
          await recordCardPlay({
            gameId: gameId as string,
            handId,
            roundId,
            playerId: player_id,
            userId: playerUserId,
            cardPlayed: card,
            playOrder: gameState.mesa.length
          });
        }
      }
    } catch (error) {
      console.error('Error tracking card play:', error);
      // Continue with game logic even if tracking fails
    }
    
    // Advance to the next player in the ordem_jogada (which should only contain active players)
    gameState.current_player_idx = (gameState.current_player_idx + 1) % gameState.ordem_jogada.length;
    }
    
    // If all active players have played, resolve the trick
    const activePlayersCount = gameState.players.filter(p => !gameState.eliminados.includes(p)).length;
    if (gameState.mesa.length === activePlayersCount) {
      console.log('All players have played cards, determining round winner...');
      console.log('Cards on table:', gameState.mesa);
      
      // Step 1: Group cards by their strength value
      const cardsByStrength = new Map<number, [number, string][]>();
      
      for (const [pid, cardPlayed] of gameState.mesa) {
        const strength = getCardStrength(cardPlayed, gameState.manilha);
        
        if (!cardsByStrength.has(strength)) {
          cardsByStrength.set(strength, []);
        }
        cardsByStrength.get(strength)!.push([pid, cardPlayed]);
      }
      
      console.log('Cards grouped by strength:', Object.fromEntries(cardsByStrength));
      
      // Step 2: Cancel out cards that have the same strength (value) - but in pairs, not all at once
      const remainingCards: [number, string][] = [];
      const cancelledCards: [number, string][] = [];
      
      // Check if this is the final round - affects cancellation logic
      const isLastRoundOfHand = gameState.current_round === gameState.cartas;
      
      if (isLastRoundOfHand) {
        // Final round special logic: Cancel tied cards if there are other non-tied cards that could win
        console.log('Final round - using special cancellation logic');
        
        // Separate cards into single cards (no ties) and tied cards (multiple cards with same strength)
        const singleCards: [number, string][] = [];
        const tiedCardGroups: [number, [number, string][]][] = [];
        
        for (const [strength, cards] of Array.from(cardsByStrength.entries())) {
          if (cards.length === 1) {
            singleCards.push(cards[0]);
          } else {
            // Cards with ties (2 or more cards with same strength)
            tiedCardGroups.push([strength, cards]);
          }
        }
        
        console.log('Single cards (no ties):', singleCards);
        console.log('Tied card groups:', tiedCardGroups.map(([strength, cards]) => ({strength, cards})));
        
        // Rule: If there are single cards available, cancel ALL tied cards
        // Only consider tied cards for wins if there are NO single cards
        if (singleCards.length > 0) {
          console.log('Single cards available - cancelling ALL tied cards');
          
          // Add all single cards to remaining
          remainingCards.push(...singleCards);
          
          // Cancel ALL tied cards
          for (const [strength, cards] of tiedCardGroups) {
            console.log(`Cancelling all tied cards with strength ${strength}:`, cards);
            cancelledCards.push(...cards);
          }
        } else {
          // No single cards - only tied cards are available
          // Use the existing pair cancellation logic for tiebreaker
          console.log('Only tied cards available - using pair cancellation logic');
          
          // Find all pairs (groups with exactly 2 cards) and larger groups
          const pairs: [number, [number, string][]][] = [];
          
          for (const [strength, cards] of tiedCardGroups) {
            if (cards.length === 2) {
              pairs.push([strength, cards]);
            } else {
              // More than 2 cards - cancel in pairs as normal, leave remainder
              const numPairs = Math.floor(cards.length / 2);
              const numCancelled = numPairs * 2;
              
              for (let i = 0; i < numCancelled; i++) {
                cancelledCards.push(cards[i]);
              }
              for (let i = numCancelled; i < cards.length; i++) {
                remainingCards.push(cards[i]);
              }
            }
          }
          
          // Sort pairs by the position of their SECOND card in the play order (mesa)
          // This determines which pair was "completed last"
          pairs.sort(([strengthA, cardsA], [strengthB, cardsB]) => {
            // For each pair, find the position of the card that was played later
            const positionsA = cardsA.map(([pid, card]) => 
              gameState.mesa.findIndex(([p, c]) => p === pid && c === card)
            );
            const positionsB = cardsB.map(([pid, card]) => 
              gameState.mesa.findIndex(([p, c]) => p === pid && c === card)
            );
            
            // The "completion position" is the maximum position (last card played) for each pair
            const completionPositionA = Math.max(...positionsA);
            const completionPositionB = Math.max(...positionsB);
            
            return completionPositionA - completionPositionB;
          });
          
          console.log('Pairs in play order:', pairs.map(([strength, cards]) => ({strength, cards})));
          
          if (pairs.length === 0) {
            // No pairs (should not happen since we only enter this branch with tied cards)
            console.log('No pairs found - unexpected state');
          } else if (pairs.length === 1) {
            // Only one pair - don't cancel it, use for tiebreaker
            const [strength, cards] = pairs[0];
            console.log(`Only one pair (strength ${strength}) - keeping for tiebreaker:`, cards);
            remainingCards.push(...cards);
          } else {
            // Multiple pairs - cancel all except the last one
            for (let i = 0; i < pairs.length - 1; i++) {
              const [strength, cards] = pairs[i];
              console.log(`Cancelling pair ${i + 1} (strength ${strength}):`, cards);
              cancelledCards.push(...cards);
            }
            
            // Keep the last pair for tiebreaker
            const [lastStrength, lastCards] = pairs[pairs.length - 1];
            console.log(`Keeping last pair (strength ${lastStrength}) for tiebreaker:`, lastCards);
            remainingCards.push(...lastCards);
          }
        }
      } else {
        // Normal cancellation logic for non-final rounds
        for (const [strength, cards] of Array.from(cardsByStrength.entries())) {
          if (cards.length === 1) {
            // Only one card with this strength, it remains
            remainingCards.push(cards[0]);
          } else if (cards.length === 2) {
            // Two cards with same strength - they cancel each other out
            console.log(`Cancelling pair of cards with strength ${strength}:`, cards);
            cancelledCards.push(...cards);
          } else {
            // More than 2 cards with same strength - cancel in pairs, leaving remainder
            const numPairs = Math.floor(cards.length / 2);
            const numCancelled = numPairs * 2;
            const numRemaining = cards.length - numCancelled;
            
            console.log(`Cancelling ${numCancelled} cards (${numPairs} pairs) with strength ${strength}, ${numRemaining} remaining:`, cards);
            
            // Cancel pairs (first numCancelled cards)
            for (let i = 0; i < numCancelled; i++) {
              cancelledCards.push(cards[i]);
            }
            
            // Add remaining cards that weren't cancelled
            for (let i = numCancelled; i < cards.length; i++) {
              remainingCards.push(cards[i]);
            }
          }
        }
      }
      
      // Store cancelled cards in game state for UI display
      gameState.cancelled_cards = cancelledCards;
      
      console.log('Remaining non-cancelled cards:', remainingCards);
      console.log('Cancelled cards:', cancelledCards);
      
      // Step 3: Determine winner from remaining cards
      let winner: number = gameState.players[0]; // Default in case of unexpected errors
      let isTie = false;
      
      if (remainingCards.length === 0) {
        // All cards cancelled out - this is a true tie
        console.log('All cards cancelled out - true tie!');
        
        // Check if this is the last round of the entire hand
        const isLastRoundOfHand = gameState.current_round === gameState.cartas;
        
        if (isLastRoundOfHand) {
          // In the final round, we must determine a winner using suit tiebreaker
          // Use the highest strength cancelled cards for suit comparison
          console.log('Final round - using suit tiebreaker on highest strength cancelled cards');
          
          // Find the highest strength among cancelled cards
          let highestCancelledStrength = -1;
          const cancelledByStrength = new Map();
          
          for (const [pid, cardPlayed] of cancelledCards) {
            const strength = getCardStrength(cardPlayed, gameState.manilha);
            
            if (!cancelledByStrength.has(strength)) {
              cancelledByStrength.set(strength, []);
            }
            cancelledByStrength.get(strength).push([pid, cardPlayed]);
            
            if (strength > highestCancelledStrength) {
              highestCancelledStrength = strength;
            }
          }
          
          // Use the highest strength cancelled cards for suit tiebreaker
          const highestCancelledCards = cancelledByStrength.get(highestCancelledStrength) || [];
          console.log(`Using highest strength cancelled cards (strength ${highestCancelledStrength}) for tiebreaker:`, highestCancelledCards);
          
          let highestSuit = -1;
          let suitWinner = null;
          
          for (const [pid, cardPlayed] of highestCancelledCards) {
            const suit = getCardSuit(cardPlayed);
            const suitValue = ORDEM_NAIPE_DESEMPATE[suit as keyof typeof ORDEM_NAIPE_DESEMPATE] || 0;
            
            console.log(`Player ${pid} card ${cardPlayed}: suit ${suit} = ${suitValue}`);
            
            if (suitValue > highestSuit) {
              highestSuit = suitValue;
              suitWinner = pid;
            }
          }
          
          if (suitWinner) {
            winner = suitWinner;
            console.log(`Final round tie broken by suit: winner is player ${winner}`);
            gameState.tie_resolved_by_tiebreaker = true;
            gameState.winning_card_played_by = winner;
            isTie = false; // We found a winner, so not a tie anymore
          } else {
            // Fallback to last player rule if suit comparison fails
            const lastPlayerId = gameState.mesa[gameState.mesa.length - 1][0];
            winner = lastPlayerId;
            console.log(`Final round tie broken by last player rule: player ${winner}`);
            gameState.tie_resolved_by_tiebreaker = true;
            gameState.winning_card_played_by = winner;
            isTie = false;
          }
        } else {
          // Not final round, increase multiplier
          console.log('Increasing multiplier for next round');
          gameState.multiplicador = (gameState.multiplicador || 1) + 1;
          
          // Last player to play starts the next round
          const lastPlayerId = gameState.mesa[gameState.mesa.length - 1][0];
          winner = lastPlayerId;
          gameState.tie_in_previous_round = true;
          gameState.winning_card_played_by = undefined;
          isTie = true;
        }
      } else {
        // Find the highest strength among remaining cards
        let highestStrength = -1;
        let winners: [number, string][] = [];
        
        for (const [pid, cardPlayed] of remainingCards) {
          const strength = getCardStrength(cardPlayed, gameState.manilha);
          
          if (strength > highestStrength) {
            highestStrength = strength;
            winners = [[pid, cardPlayed]];
          } else if (strength === highestStrength) {
            winners.push([pid, cardPlayed]);
          }
        }
        
        if (winners.length === 1) {
          winner = winners[0][0];
          console.log(`Clear winner: player ${winner} with card ${winners[0][1]}`);
          gameState.tie_in_previous_round = false;
          gameState.tie_resolved_by_tiebreaker = false;
          gameState.winning_card_played_by = winner;
        } else {
          // Multiple winners with same strength - use suit tiebreaker
          const isLastRoundOfHand = gameState.current_round === gameState.cartas;
          
          if (isLastRoundOfHand) {
            // Final round - break tie using suit order
            console.log('Final round - breaking tie among remaining cards using suits');
            let highestSuit = -1;
            let suitWinner = null;
            
            for (const [pid, cardPlayed] of winners) {
              const suit = getCardSuit(cardPlayed);
              const suitValue = ORDEM_NAIPE_DESEMPATE[suit as keyof typeof ORDEM_NAIPE_DESEMPATE] || 0;
              
              console.log(`Player ${pid} card ${cardPlayed}: suit ${suit} = ${suitValue}`);
              
              if (suitValue > highestSuit) {
                highestSuit = suitValue;
                suitWinner = pid;
              }
            }
            
            if (suitWinner) {
              winner = suitWinner;
              console.log(`Final round tie broken by suit: winner is player ${winner} with suit value ${highestSuit}`);
              gameState.tie_resolved_by_tiebreaker = true;
              gameState.winning_card_played_by = winner;
              isTie = false;
            } else {
              // Fallback to last player rule if suit comparison fails
              const lastPlayerId = gameState.mesa[gameState.mesa.length - 1][0];
              winner = lastPlayerId;
              console.log(`Final round tie broken by last player rule: player ${winner}`);
              gameState.tie_resolved_by_tiebreaker = true;
              gameState.winning_card_played_by = winner;
              isTie = false;
            }
          } else {
            // Not final round - this becomes a tie
            console.log('Tie among remaining cards - increasing multiplier');
            gameState.multiplicador = (gameState.multiplicador || 1) + 1;
            isTie = true;
            
            const lastPlayerId = gameState.mesa[gameState.mesa.length - 1][0];
            winner = lastPlayerId;
            gameState.tie_in_previous_round = true;
            gameState.winning_card_played_by = undefined;
          }
        }
      }
      
      // Award trick to winner - only if there was a clear winner
      if (!isTie) {
        gameState.vitorias[winner] = (gameState.vitorias[winner] || 0) + (gameState.multiplicador || 1);
        gameState.multiplicador = 1; // Reset multiplier after awarding points
      }
      
      // Set the round winner (with backward compatibility)
      gameState.last_round_winner = winner;
      gameState.last_trick_winner = winner; // For backward compatibility
      
      // Track round completion in database
      try {
        const handId = await getCurrentHandId(gameId as string);
        const roundId = handId ? await getCurrentRoundId(handId) : null;
        
        console.log(`Round completion tracking: handId=${handId}, roundId=${roundId}, isTie=${isTie}, winner=${winner}`);
        console.log(`Attempting to complete round: handId=${handId}, roundId=${roundId}, isTie=${isTie}, winner=${winner}`);
        
        if (roundId) {
          if (isTie) {
            // This is a tied round - mark it as TIED
            console.log(`Completing tied round ${roundId}`);
            await completeTiedRound(roundId);
            console.log(`Successfully completed tied round ${roundId}`);
          } else {
            // Find the winning card from the mesa
            const winningCard = gameState.mesa.find(([pid]) => pid === winner)?.[1];
            if (winningCard) {
              console.log(`Attempting to complete round ${roundId} with winner ${winner} and winning card ${winningCard}`);
              await completeRound(roundId, winner, winningCard);
              console.log(`Successfully completed round ${roundId}`);
            } else {
              console.log(`Could not find winning card for winner ${winner}`);
            }
          }
        } else {
          console.log(`No roundId found for completion: handId=${handId}`);
        }
      } catch (error) {
        console.error('Error tracking round completion:', error);
        // Continue with game logic even if tracking fails
      }
      
      // Check if round is over (all players have played one card in this round)
      const isRoundComplete = gameState.cards_played_this_round === activePlayersCount;
      
      if (isRoundComplete) {
        console.log(`Round ${gameState.current_round} of ${gameState.cartas} completed`);
        
        // Reset cards played counter for next round
        gameState.cards_played_this_round = 0;
        
        // If this isn't the last round of the hand, move to round_over state temporarily
        if ((gameState.current_round || 1) < (gameState.cartas || 1)) {
          console.log(`Moving to round_over state for next round. Current round: ${gameState.current_round}, Cards per hand: ${gameState.cartas}`);
          // This is a round within a multi-card hand, mark it as round_over temporarily
          gameState.estado = 'round_over';
          gameState.round_over_timestamp = Date.now(); // Set timestamp for the delay
          
          // Store the round winner for UI display purposes
          gameState.last_round_winner = winner;
          gameState.last_trick_winner = winner; // For backward compatibility
          
          // Flag to indicate which card is the winning card for the UI highlight
          gameState.winning_card_played_by = winner;
          
          // Don't clear the mesa here, keep the cards visible during the delay
          // This allows players to see the final cards played in the round
        } else {
          // This was the last round of the hand, hand is complete
          gameState.estado = 'round_over';
          
          // Flag the winner of the final round for UI highlighting
          gameState.winning_card_played_by = winner;
          
          // Track hand completion in database
          try {
            const handId = await getCurrentHandId(gameId as string);
            if (handId) {
              await completeHand(handId, gameState.vitorias);
            }
          } catch (error) {
            console.error('Error tracking hand completion:', error);
            // Continue with game logic even if tracking fails
          }
          
          // Calculate life losses based on bets vs. tricks won
          for (const playerId of gameState.players) {
            if (gameState.eliminados.includes(playerId)) continue;
            
            const palpite = gameState.palpites[playerId] || 0;
            const vitorias = gameState.vitorias[playerId] || 0;
            const diff = Math.abs(palpite - vitorias);
            
            gameState.vidas[playerId] -= diff;
          }
          
          // Check for eliminated players
          gameState.eliminados = gameState.players.filter(pid => gameState.vidas[pid] <= 0);
          
          // Game ends when 1 player is eliminated (regardless of total players)
          const eliminatedCount = gameState.eliminados.length;
          const gameEnds = eliminatedCount >= 1;
          
          if (gameEnds) {
            // Game is over
            gameState.estado = 'terminado';
            
            // Track game completion in database
            try {
              const finalResults = gameState.players.map((playerId, index) => ({
                playerId,
                userId: '', // Will be filled by getUserIdFromGame
                finalPosition: gameState.eliminados.includes(playerId) ? gameState.players.length : 1,
                livesRemaining: gameState.vidas[playerId] || 0,
                isWinner: !gameState.eliminados.includes(playerId)
              }));
              
              // Fill in user IDs
              for (const result of finalResults) {
                const userId = await getUserIdFromGame(gameId as string, result.playerId);
                result.userId = userId || 'anonymous';
              }
              
              await completeGame(gameId as string, finalResults);
            } catch (error) {
              console.error('Error tracking game completion:', error);
              // Continue with game logic even if tracking fails
            }
          } else {
            // Ready to start a new hand
            gameState.estado = 'aguardando';
          }
        }
      } else {
        // Round continues, next trick
        // Setup for next trick (winner leads)
        // Find the winner's index in the ordem_jogada array (which only contains active players)
        const winnerIdx = gameState.ordem_jogada.indexOf(winner);
        if (winnerIdx !== -1) {
          gameState.current_player_idx = winnerIdx;
        } else {
          // Fallback: if winner is not found in ordem_jogada, start with first player
          console.error(`Winner ${winner} not found in ordem_jogada. Using first player as fallback.`);
          gameState.current_player_idx = 0;
        }
        gameState.mesa = [];
      }
    }
    
    // Update lobby with new game state
    lobby.gameState = gameState;
    await setLobby(lobby);
    
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
      // Continue with the API response even if socket emission fails
    }
    
    // When returning a successful response, cache it
    const result = { status: 'success', game_state: gameState };
    processedRequests.set(duplicateKey, {
      timestamp: Date.now(),
      result
    });
    
    // Add ETag for caching
    const etag = `card-${id}-${player_id}-${Date.now()}`;
    res.setHeader('ETag', etag);
    
    // Cache the response for 304 responses
    responseCache.set(etag, {
      timestamp: Date.now(),
      etag,
      data: result
    });
    
    // Log slow requests
    const totalRequestTime = Date.now() - requestStartTime;
    if (totalRequestTime > 200) {
      console.log(`Slow card play request: ${totalRequestTime}ms total for ${player_id} in game ${id}`);
    }
    
    // Clear processed request after timeout
    setTimeout(() => {
      processedRequests.delete(duplicateKey);
    }, 5000);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error(`Error in play-card handler for game ${req.query.id}:`, error);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Server error - please try again',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 