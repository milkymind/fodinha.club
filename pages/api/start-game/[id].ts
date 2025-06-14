import { NextApiRequest, NextApiResponse } from 'next';
import { getLobby, setLobby } from '../persistent-store';

const SUITS = ['♣', '♥', '♠', '♦'];
const VALUES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'];

function shuffle<T>(array: T[]): T[] {
  const result = [...array]; // Create a copy to avoid mutating the original
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]]; // Swap elements
  }
  return result;
}

function createDeck() {
  const deck = SUITS.flatMap((suit) => VALUES.map((value) => ({ value, suit })));
  return shuffle(deck);
}

function getNextManilha(carta: string): string {
  const value = carta.substring(0, carta.length - 1);
  const valueIndex = VALUES.indexOf(value);
  return VALUES[(valueIndex + 1) % VALUES.length];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }
  
  try {
    const { id } = req.query;
    console.log(`Starting game with ID: ${id}`);
    
    if (!id || typeof id !== 'string') {
      console.error('Invalid game ID');
      return res.status(400).json({ status: 'error', error: 'Invalid game ID' });
    }
    
    const lobby = await getLobby(id);
    
    if (!lobby) {
      console.error(`Lobby not found for game ${id}`);
      return res.status(404).json({ status: 'error', error: 'Lobby not found' });
    }
    
    if (lobby.players.length < 2) {
      console.error(`Not enough players in game ${id} - only ${lobby.players.length} player(s)`);
      return res.status(400).json({ status: 'error', error: 'At least 2 players are required to start the game' });
    }
    
    // Mark the lobby as started
    lobby.gameStarted = true;
    console.log(`Initializing game state for game ${id} with ${lobby.players.length} players`);

    // Initialize game state
    const players = lobby.players.map((p) => p.id);
    const player_names = Object.fromEntries(lobby.players.map((p) => [p.id, p.name]));
    const vidas = Object.fromEntries(lobby.players.map((p) => [p.id, lobby.lives]));
    const round = 1;
    
    // Calculate cards per player dynamically based on number of players
    // For the first hand, start with 1 card per player
    const cardsPerPlayer = 1;
    
    // Calculate maximum cards per player for this game
    // We need to consider two scenarios:
    // 1. Normal case: max_cards = floor((40 - 1) / num_players) - reserve 1 card for middle
    // 2. Workaround case: max_cards = floor(40 / num_players) - use all 40 cards
    const maxCardsWithMiddleCard = Math.floor(39 / players.length); // Normal case
    const maxCardsWithWorkaround = Math.floor(40 / players.length); // Workaround case
    const maxCardsPerPlayer = maxCardsWithWorkaround; // Use the higher maximum
    
    console.log(`Game setup: ${players.length} players, starting with ${cardsPerPlayer} cards`);
    console.log(`Max with middle card reserved: ${maxCardsWithMiddleCard}`);
    console.log(`Max with workaround: ${maxCardsWithWorkaround}`);
    console.log(`Using maximum: ${maxCardsPerPlayer} cards per player`);
    
    // Create and shuffle deck
    const deck = createDeck();
    
    // Check if we need the middle card workaround for this configuration
    const totalCardsNeeded = players.length * cardsPerPlayer;
    const needsMiddleCardWorkaround = totalCardsNeeded === 40;
    
    let carta_meio: { value: string; suit: string } | undefined;
    let middleCardAssignedTo: number | undefined;
    
    if (needsMiddleCardWorkaround) {
      // Special case: all 40 cards will be dealt to players
      // Show middle card to everyone, then randomly assign it to a player
      carta_meio = deck.shift();
      if (carta_meio) {
        // Randomly assign this card to one of the players
        middleCardAssignedTo = players[Math.floor(Math.random() * players.length)];
        console.log(`Middle card workaround: ${carta_meio.value}${carta_meio.suit} shown to all, assigned to player ${middleCardAssignedTo}`);
      }
    } else {
      // Normal case: deal middle card (for manilha) and keep it separate
      carta_meio = deck.shift();
    }
    
    const manilha = carta_meio ? getNextManilha(carta_meio.value) : '';
    console.log(`Middle card: ${carta_meio?.value}${carta_meio?.suit}, Manilha: ${manilha}`);

    // Deal cards to players
    const hands: { [key: number]: string[] } = {};
    for (const player of players) {
      hands[player] = [];
      for (let i = 0; i < cardsPerPlayer; i++) {
        const card = deck.shift();
        if (card) {
          hands[player].push(card.value + card.suit);
        }
      }
      
      // If this player was assigned the middle card, add it to their hand
      if (needsMiddleCardWorkaround && player === middleCardAssignedTo && carta_meio) {
        hands[player].push(carta_meio.value + carta_meio.suit);
      }
    }
    
    console.log(`Dealt ${cardsPerPlayer} card(s) to each player${needsMiddleCardWorkaround ? ' (with middle card workaround)' : ''}`);

    // For one-card hands, also keep the original hands for later reference
    // (since we'll remove cards as they're played)
    const original_hands = JSON.parse(JSON.stringify(hands));
    
    // Select the first dealer (player 1 by default)
    const dealer = players[0];
    
    // In Fodinha, the first player is always the one after the dealer
    const dealerIndex = players.indexOf(dealer);
    const firstPlayerIndex = (dealerIndex + 1) % players.length;
    const firstPlayer = players[firstPlayerIndex];
    
    console.log(`Dealer: Player ${dealer}, First player: Player ${firstPlayer}`);
    
    // Create the order of play, starting with the first player
    const playOrder = [
      ...players.slice(firstPlayerIndex),
      ...players.slice(0, firstPlayerIndex)
    ];
    
    console.log(`Play order: ${playOrder.join(', ')}`);

    const gameState = {
      players,
      player_names,
      vidas,
      estado: 'apostas',
      carta_meio: carta_meio ? carta_meio.value + carta_meio.suit : '',
      manilha,
      maos: hands,
      original_maos: original_hands, // Add original hands for one-card games
      palpites: {},
      initial_lives: lobby.lives,
      current_round: 1,
      current_hand: 0,
      current_player_idx: 0,
      ordem_jogada: playOrder,
      multiplicador: 1,
      soma_palpites: 0,
      mesa: [],
      vitorias: Object.fromEntries(players.map(pid => [pid, 0])),
      dealer: dealer,
      first_player: firstPlayer,
      cartas: cardsPerPlayer,
      eliminados: [],
      // Initialize tie-related flags
      tie_in_previous_round: false,
      tie_resolved_by_tiebreaker: false,
      winning_card_played_by: undefined,
      cancelled_cards: [],
      // For tracking player activity
      last_activity: Object.fromEntries(players.map(pid => [pid, Date.now()])),
      // Store information about the middle card workaround for UI display
      middle_card_workaround: needsMiddleCardWorkaround ? {
        used: true,
        card: carta_meio ? carta_meio.value + carta_meio.suit : ''
      } : {
        used: false
      },
    };
    
    // Set first player to play
    gameState.current_player_idx = gameState.ordem_jogada.indexOf(gameState.first_player);
    if (gameState.current_player_idx === -1) gameState.current_player_idx = 0;
    
    lobby.gameState = gameState;
    
    // Save the updated lobby and game state
    const success = await setLobby(lobby);
    
    if (!success) {
      console.error(`Failed to save game state for game ${id}`);
      return res.status(500).json({ status: 'error', error: 'Failed to save game state' });
    }
    
    console.log(`Game ${id} successfully started`);
    
    return res.status(200).json({ status: 'success' });
  } catch (error) {
    console.error('Error starting game:', error);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Failed to start game',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 