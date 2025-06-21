import React, { memo } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
  formatCard, 
  getCardColorClass, 
  getSuitClass, 
  getCardStrength 
} from './utils/cardLogic';
import styles from '../../../styles/Game.module.css';

interface GameBoardProps {
  cartaMeio?: string; // Trump card in middle
  manilha?: string;
  mesa?: [number, string][]; // Played cards
  playerNames: { [key: number]: string };
  playerId: number;
  gameState: string; // Current game state
  isOneCardHand: boolean;
  allHands?: { [key: number]: string[] }; // For one-card display
  players: number[];
  lastPlayedCard?: { playerId: number; card: string } | null;
  winningCardPlayedBy?: number;
  currentRound?: number;
  totalCards?: number;
  cancelledCards?: [number, string][]; // Backend-provided cancelled cards
  tieResolvedByTiebreaker?: boolean;
  multiplicador?: number;
}

export const GameBoard = memo<GameBoardProps>(({
  cartaMeio,
  manilha,
  mesa = [],
  playerNames,
  playerId,
  gameState,
  isOneCardHand,
  allHands,
  players,
  lastPlayedCard,
  winningCardPlayedBy,
  currentRound,
  totalCards,
  cancelledCards = [],
  tieResolvedByTiebreaker,
  multiplicador = 1
}) => {
  const { t } = useLanguage();

  // Function to determine if a card is cancelled
  const isCancelledCard = (playerIdOfCard: number, card: string): boolean => {
    // Always trust the backend's cancelled_cards array if available
    if (cancelledCards && cancelledCards.length > 0) {
      return cancelledCards.some(([pid, cancelledCard]) => 
        pid === playerIdOfCard && cancelledCard === card
      );
    }
    
    // Fallback logic only if backend doesn't provide cancelled_cards
    if (!mesa || mesa.length < 2) return false;
    
    // In the final round of a hand, don't show cancellation unless explicitly told by backend
    const isLastRoundOfHand = currentRound === totalCards;
    if (isLastRoundOfHand && (!cancelledCards || cancelledCards.length === 0)) {
      return false; // Trust that backend handles final round logic
    }
    
    // Group cards by strength for fallback logic (non-final rounds)
    const cardsByStrength = new Map<number, [number, string][]>();
    
    for (const [pid, tableCard] of mesa) {
      const strength = getCardStrength(tableCard, manilha);
      
      if (!cardsByStrength.has(strength)) {
        cardsByStrength.set(strength, []);
      }
      cardsByStrength.get(strength)!.push([pid, tableCard]);
    }
    
    // Check if this card's strength group has pairs that would cancel
    for (const [strength, cards] of Array.from(cardsByStrength.entries())) {
      if (cards.length >= 2) {
        // Find the card we're checking
        const cardIndex = cards.findIndex(([pid, tableCard]: [number, string]) => 
          pid === playerIdOfCard && tableCard === card
        );
        
        if (cardIndex !== -1) {
          // In non-final rounds, pairs cancel out
          const numCancelled = Math.floor(cards.length / 2) * 2;
          return cardIndex < numCancelled;
        }
      }
    }
    
    return false;
  };

  // Helper function to check if a card is the winning card
  const isWinningCard = (playerIdOfCard: number, card: string): boolean => {
    if (!mesa || mesa.length === 0) return false;
    
    // First priority: Check if the backend has explicitly set a winning card player
    // This happens when ties are resolved by tiebreaker
    if (winningCardPlayedBy !== undefined) {
      // Find the card played by the winning player
      const winningPlayerCard = mesa.find(([pid, tableCard]) => 
        pid === winningCardPlayedBy
      );
      
      if (winningPlayerCard) {
        const [winningPid, winningCard] = winningPlayerCard;
        return playerIdOfCard === winningPid && card === winningCard;
      }
    }
    
    // Check if this is a cancelled card first - cancelled cards can't win
    if (isCancelledCard(playerIdOfCard, card)) {
      return false;
    }
    
    // Get all cards on the table that are NOT cancelled
    const nonCancelledCards = mesa.filter(([pid, tableCard]) => 
      !isCancelledCard(pid, tableCard)
    );
    
    // If no non-cancelled cards, no winner can be determined
    if (nonCancelledCards.length === 0) {
      return false;
    }
    
    // Find the card we're checking among non-cancelled cards
    const cardOnTable = nonCancelledCards.find(([pid, tableCard]) => 
      pid === playerIdOfCard && tableCard === card
    );
    
    if (!cardOnTable) return false;
    
    // Among non-cancelled cards, find the strongest
    // First check if there are any manilhas
    const manilhaCards = nonCancelledCards.filter(([, tableCard]) => {
      const cardValue = tableCard.substring(0, tableCard.length - 1);
      return cardValue === manilha;
    });
    
    if (manilhaCards.length > 0) {
      // If this card is not a manilha, it can't win when manilhas are present
      const thisCardValue = card.substring(0, card.length - 1);
      if (thisCardValue !== manilha) {
        return false;
      }
      
      // Among manilhas, find the strongest using suit ordering
      const maxManilhaStrength = Math.max(...manilhaCards.map(([, tableCard]) => 
        getCardStrength(tableCard, manilha)
      ));
      return getCardStrength(card, manilha) === maxManilhaStrength;
    }
    
    // No manilhas among non-cancelled cards, find highest regular card
    const maxStrength = Math.max(...nonCancelledCards.map(([, tableCard]) => 
      getCardStrength(tableCard, manilha)
    ));
    return getCardStrength(card, manilha) === maxStrength;
  };

  return (
    <div className={styles.gameTable}>
      {/* Trump card and manilha info */}
      {cartaMeio && (
        <div className={styles.tableInfo}>
          <div className={styles.centerCardContainer}>
            <div className={`${styles.card} ${getCardColorClass(cartaMeio)}`}>
              <div className={styles.cardContent}>
                <span className={styles.cardValue}>{formatCard(cartaMeio).value}</span>
                <span className={`${styles.cardSuit} ${getSuitClass(cartaMeio)}`}>
                  {formatCard(cartaMeio).suit}
                </span>
              </div>
            </div>
            <div className={styles.cardLabel}>{t('middle_card')}</div>
          </div>
          <div className={styles.manilhaContainer}>
            <div className={styles.manilhaInfo}>
              <span>{t('manilha')}: </span>
              <span className={styles.manilhaValue}>{manilha}</span>
            </div>
            {multiplicador > 1 && (
              <div className={styles.multiplicadorInfo}>
                <span>{t('multiplier')}: </span>
                <span className={styles.multiplicadorValue}>{multiplicador}x</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Other players' cards in one-card hand */}
      {isOneCardHand && gameState === 'apostas' && allHands && (
        <div className={styles.otherPlayersCards}>
          <h3>{t('other_players_cards')}</h3>
          <div className={styles.tableCards}>
            {players
              .filter(id => id !== playerId)
              .map((id) => 
                allHands && allHands[id] && allHands[id].length > 0 ? (
                  <div key={id} className={styles.playedCardContainer}>
                    <div className={`${styles.card} ${getCardColorClass(allHands[id][0])}`}>
                      <div className={styles.cardContent}>
                        <span className={styles.cardValue}>{formatCard(allHands[id][0]).value}</span>
                        <span className={`${styles.cardSuit} ${getSuitClass(allHands[id][0])}`}>
                          {formatCard(allHands[id][0]).suit}
                        </span>
                      </div>
                    </div>
                    <div className={styles.playerLabel}>
                      {playerNames[id]}
                    </div>
                  </div>
                ) : null
            )}
          </div>
        </div>
      )}

      {/* Played cards */}
      {mesa && mesa.length > 0 && (
        <div className={styles.playedCards}>
          <h3>{t('played_cards')}</h3>
          <div className={styles.tableCards}>
            {mesa.map(([pid, card], index) => (
              <div key={index} className={styles.playedCardContainer}>
                <div className={`${styles.card} 
                  ${getCardColorClass(card)} 
                  ${lastPlayedCard?.playerId === pid && lastPlayedCard?.card === card ? styles.lastPlayed : ''}
                  ${isWinningCard(pid, card) ? styles.winningCard : ''}
                  ${isCancelledCard(pid, card) ? styles.cancelledCard : ''}
                `}>
                  <div className={styles.cardContent}>
                    <span className={styles.cardValue}>{formatCard(card).value}</span>
                    <span className={`${styles.cardSuit} ${getSuitClass(card)}`}>
                      {formatCard(card).suit}
                    </span>
                  </div>
                  {isCancelledCard(pid, card) && (
                    <div className={styles.cancellationOverlay}>
                      <span className={styles.cancellationX}>✗</span>
                    </div>
                  )}
                </div>
                <div className={styles.playerLabel}>
                  {playerNames[pid]}
                  {isWinningCard(pid, card) && <span className={styles.winnerLabel}>👑</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

GameBoard.displayName = 'GameBoard'; 