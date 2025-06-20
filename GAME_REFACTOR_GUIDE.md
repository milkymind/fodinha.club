# Step-by-Step Guide: Refactoring Game.tsx

## Overview
Your Game.tsx is 1,767 lines - that's like trying to read a small book! Let's break it into digestible pieces.

## Step 1: Create the Component Structure

First, create this folder structure:
```
src/components/Game/
├── index.tsx              // Main Game container (200 lines)
├── GameBoard.tsx          // Table and played cards
├── PlayerHand.tsx         // Current player's cards
├── PlayerList.tsx         // List of players and their lives
├── BettingPanel.tsx       // Betting interface
├── GameStatus.tsx         // Game messages and notifications
├── GameControls.tsx       // Start round, leave game buttons
├── TrumpCard.tsx          // Middle card display
├── hooks/
│   ├── useGameState.ts    // Game state management
│   ├── useGameActions.ts  // Play card, make bet, etc.
│   └── useSocketSync.ts   // WebSocket communication
└── utils/
    ├── cardLogic.ts       // Card strength, formatting
    └── gameHelpers.ts     // Other game logic
```

## Step 2: Extract Card Logic First (Easiest)

Create `src/components/Game/utils/cardLogic.ts`:

```typescript
// Move these from Game.tsx:
const ORDEM_CARTAS = {
  '4': 0, '5': 1, '6': 2, '7': 3, 'Q': 4, 'J': 5, 'K': 6, 'A': 7, '2': 8, '3': 9
};

const ORDEM_NAIPE_MANILHA = {'♦': 0, '♠': 1, '♥': 2, '♣': 3};

export function getCardValue(card: string): string {
  return card.substring(0, card.length - 1);
}

export function getCardSuit(card: string): string {
  return card.charAt(card.length - 1);
}

export function getCardStrength(card: string, manilha?: string): number {
  const value = getCardValue(card);
  const suit = getCardSuit(card);
  
  if (manilha && value === manilha) {
    return 100 + ORDEM_NAIPE_MANILHA[suit as keyof typeof ORDEM_NAIPE_MANILHA];
  }
  
  return ORDEM_CARTAS[value as keyof typeof ORDEM_CARTAS] || 0;
}

export function getCardColorClass(card: string): string {
  const suit = getCardSuit(card);
  return (suit === '♥' || suit === '♦') ? 'red' : 'black';
}

export function getSuitClass(card: string): string {
  const suit = getCardSuit(card);
  const suitMap = {
    '♠': 'spades',
    '♥': 'hearts',
    '♦': 'diamonds',
    '♣': 'clubs'
  };
  return suitMap[suit as keyof typeof suitMap] || '';
}

export function formatCard(card: string): React.ReactNode {
  const value = getCardValue(card);
  const suit = getCardSuit(card);
  return (
    <>
      <span className="card-value">{value}</span>
      <span className="card-suit">{suit}</span>
    </>
  );
}
```

## Step 3: Extract Player Hand Component

Create `src/components/Game/PlayerHand.tsx`:

```typescript
import React, { useMemo } from 'react';
import styles from '../../styles/Game.module.css';
import { formatCard, getCardColorClass, getSuitClass, getCardStrength } from './utils/cardLogic';

interface PlayerHandProps {
  cards: string[];
  manilha?: string;
  onPlayCard: (index: number) => void;
  isMyTurn: boolean;
  isCardsSorted: boolean;
  isPlayingCard: boolean;
  clickedCardIndex: number | null;
}

export const PlayerHand: React.FC<PlayerHandProps> = ({
  cards,
  manilha,
  onPlayCard,
  isMyTurn,
  isCardsSorted,
  isPlayingCard,
  clickedCardIndex
}) => {
  const sortedCards = useMemo(() => {
    if (!isCardsSorted) return cards;
    
    return [...cards].sort((a, b) => {
      const strengthA = getCardStrength(a, manilha);
      const strengthB = getCardStrength(b, manilha);
      return strengthB - strengthA;
    });
  }, [cards, manilha, isCardsSorted]);

  const getOriginalIndex = (sortedIndex: number): number => {
    if (!isCardsSorted) return sortedIndex;
    const sortedCard = sortedCards[sortedIndex];
    return cards.indexOf(sortedCard);
  };

  return (
    <div className={styles.hand}>
      <h3>Your Hand:</h3>
      <div className={styles.cards}>
        {sortedCards.map((card, index) => {
          const originalIndex = getOriginalIndex(index);
          const isClicked = clickedCardIndex === originalIndex;
          
          return (
            <button
              key={index}
              className={`${styles.card} ${getCardColorClass(card)} ${getSuitClass(card)} ${
                isClicked ? styles.clickedCard : ''
              }`}
              onClick={() => onPlayCard(originalIndex)}
              disabled={!isMyTurn || isPlayingCard}
            >
              {formatCard(card)}
              {card.startsWith(manilha || '') && (
                <span className={styles.manilhaIndicator}>♔</span>
              )}
            </button>
          );
        })}
      </div>
      
      <button 
        className={styles.sortButton}
        onClick={() => /* toggle sort */}
      >
        {isCardsSorted ? '🔀 Unsort' : '📊 Sort by strength'}
      </button>
    </div>
  );
};
```

## Step 4: Extract Game State Hook

Create `src/components/Game/hooks/useGameState.ts`:

```typescript
import { useState, useEffect, useContext } from 'react';
import { SocketContext } from '../../../contexts/SocketContext';

export interface GameState {
  players: number[];
  player_names: { [key: number]: string };
  vidas: { [key: number]: number };
  estado: string;
  carta_meio?: string;
  manilha?: string;
  maos?: { [key: number]: string[] };
  // ... rest of GameState interface
}

export function useGameState(gameId: string, playerId: number) {
  const socket = useContext(SocketContext);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    if (!socket) return;

    // Join game room
    socket.emit('join-game', { gameId, playerId });

    // Listen for updates
    socket.on('game-state-update', (data: any) => {
      setGameState(data.gameState);
    });

    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => setConnectionStatus('disconnected'));

    return () => {
      socket.off('game-state-update');
      socket.off('connect');
      socket.off('disconnect');
    };
  }, [socket, gameId, playerId]);

  return { gameState, connectionStatus };
}
```

## Step 5: Extract Game Actions Hook

Create `src/components/Game/hooks/useGameActions.ts`:

```typescript
import { useCallback, useState } from 'react';

export function useGameActions(gameId: string, playerId: number) {
  const [isSubmittingBet, setIsSubmittingBet] = useState(false);
  const [isPlayingCard, setIsPlayingCard] = useState(false);

  const playCard = useCallback(async (cardIndex: number) => {
    if (isPlayingCard) return;
    
    setIsPlayingCard(true);
    try {
      const response = await fetch(`/api/play-card/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, card_index: cardIndex }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to play card');
      }
    } catch (error) {
      console.error('Error playing card:', error);
      throw error;
    } finally {
      setIsPlayingCard(false);
    }
  }, [gameId, playerId, isPlayingCard]);

  const makeBet = useCallback(async (bet: number) => {
    if (isSubmittingBet) return;
    
    setIsSubmittingBet(true);
    try {
      const response = await fetch(`/api/make-bet/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, bet }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to make bet');
      }
    } catch (error) {
      console.error('Error making bet:', error);
      throw error;
    } finally {
      setIsSubmittingBet(false);
    }
  }, [gameId, playerId, isSubmittingBet]);

  const startRound = useCallback(async () => {
    const response = await fetch(`/api/start-round/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to start round');
    }
  }, [gameId, playerId]);

  return {
    playCard,
    makeBet,
    startRound,
    isSubmittingBet,
    isPlayingCard,
  };
}
```

## Step 6: Create the New Main Game Component

Create `src/components/Game/index.tsx`:

```typescript
import React from 'react';
import { useGameState } from './hooks/useGameState';
import { useGameActions } from './hooks/useGameActions';
import { PlayerHand } from './PlayerHand';
import { GameBoard } from './GameBoard';
import { PlayerList } from './PlayerList';
import { BettingPanel } from './BettingPanel';
import { GameStatus } from './GameStatus';
import { GameControls } from './GameControls';
import styles from '../../styles/Game.module.css';

interface GameProps {
  gameId: string;
  playerId: number;
  onLeaveGame: () => void;
  onReturnToLobby?: () => void;
}

export default function Game({ gameId, playerId, onLeaveGame, onReturnToLobby }: GameProps) {
  const { gameState, connectionStatus } = useGameState(gameId, playerId);
  const { playCard, makeBet, startRound, isSubmittingBet, isPlayingCard } = useGameActions(gameId, playerId);

  if (!gameState) {
    return <div className={styles.loading}>Loading game...</div>;
  }

  const isMyTurn = gameState.ordem_jogada?.[gameState.current_player_idx] === playerId;
  const myCards = gameState.maos?.[playerId] || [];
  const isHost = gameState.players[0] === playerId;

  return (
    <div className={styles.container}>
      <GameStatus 
        gameState={gameState}
        playerId={playerId}
        connectionStatus={connectionStatus}
      />
      
      <div className={styles.gameLayout}>
        <div className={styles.leftPanel}>
          <PlayerList 
            players={gameState.players}
            playerNames={gameState.player_names}
            lives={gameState.vidas}
            eliminados={gameState.eliminados}
            currentPlayerId={playerId}
          />
        </div>
        
        <div className={styles.centerPanel}>
          <GameBoard 
            mesa={gameState.mesa || []}
            playerNames={gameState.player_names}
            manilha={gameState.manilha}
            multiplicador={gameState.multiplicador || 1}
          />
          
          {gameState.estado === 'apostando' && (
            <BettingPanel 
              onMakeBet={makeBet}
              isSubmitting={isSubmittingBet}
              disabled={!isMyTurn}
              maxBet={myCards.length}
            />
          )}
        </div>
        
        <div className={styles.rightPanel}>
          <PlayerHand 
            cards={myCards}
            manilha={gameState.manilha}
            onPlayCard={playCard}
            isMyTurn={isMyTurn}
            isPlayingCard={isPlayingCard}
          />
        </div>
      </div>
      
      <GameControls 
        isHost={isHost}
        gameState={gameState}
        onStartRound={startRound}
        onLeaveGame={onLeaveGame}
        onReturnToLobby={onReturnToLobby}
      />
    </div>
  );
}
```

## Step 7: Update Import in pages/index.tsx

```typescript
// Change this:
import Game from '../src/components/Game';

// To this:
import Game from '../src/components/Game/index';
```

## Migration Strategy

1. **Backup First**: Copy Game.tsx to Game.backup.tsx
2. **Create Structure**: Create all the folders and empty files
3. **Move Logic**: Start with utility functions (cardLogic.ts)
4. **Extract Components**: One at a time, starting with PlayerHand
5. **Test After Each Step**: Make sure the game still works
6. **Delete Old File**: Only after everything works

## Common Pitfalls to Avoid

1. **Don't move everything at once** - You'll get lost in imports
2. **Keep the same prop names** - Easier to track what goes where
3. **Test frequently** - After each component extraction
4. **Update imports gradually** - Don't break everything at once

## Benefits You'll See Immediately

- **Faster development**: Find code in seconds, not minutes
- **Easier debugging**: Problems isolated to small files
- **Better performance**: React can optimize smaller components
- **Team friendly**: Multiple people can work without conflicts
- **Testable**: Can unit test each component separately

## Next Steps After Refactoring

1. Add PropTypes or better TypeScript types
2. Add unit tests for each component
3. Implement React.memo for performance
4. Add Storybook for component documentation
5. Consider using React Query for API calls

Remember: This refactor will make EVERY future change easier!