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
  totalCards
}) => {
  const { t } = useLanguage();

  // Helper function to check if a card is cancelled
  const isCancelledCard = (playerIdOfCard: number, card: string): boolean => {
    if (!mesa || mesa.length < 2) return false;
    
    // In the final round of a hand, cards should not be shown as cancelled
    // because ties will be resolved by suit tiebreaker
    const isLastRoundOfHand = currentRound === totalCards;
    if (isLastRoundOfHand) {
      return false; // Never show cards as cancelled in the final round
    }
    
    // Group all cards on the table by their strength
    const cardsByStrength = new Map<number, [number, string][]>();
    
    for (const [pid, tableCard] of mesa) {
      const strength = getCardStrength(tableCard, manilha);
      
      if (!cardsByStrength.has(strength)) {
        cardsByStrength.set(strength, []);
      }
      cardsByStrength.get(strength)!.push([pid, tableCard]);
    }
    
    // Check if our specific card is cancelled
    const cardStrength = getCardStrength(card, manilha);
    const cardsWithSameStrength = cardsByStrength.get(cardStrength) || [];
    
    // If there are 2 or more cards with the same strength, they start cancelling each other
    if (cardsWithSameStrength.length >= 2) {
      // Check if our card is in a cancelling group
      const ourCardIndex = cardsWithSameStrength.findIndex(([pid, tableCard]) => 
        pid === playerIdOfCard && tableCard === card
      );
      
      if (ourCardIndex !== -1) {
        // Cards cancel in pairs: 0&1, 2&3, 4&5, etc.
        // If we have an even number of cards (2, 4, 6...), all are cancelled
        // If we have an odd number (3, 5, 7...), the last one isn't cancelled
        const pairIndex = Math.floor(ourCardIndex / 2);
        const totalPairs = Math.floor(cardsWithSameStrength.length / 2);
        
        // Our card is cancelled if it's in a complete pair
        return pairIndex < totalPairs;
      }
    }
    
    return false;
  };

  // Helper function to check if a card is the winning card
  const isWinningCard = (playerIdOfCard: number, card: string): boolean => {
    if (!mesa || mesa.length === 0) return false;
    
    // First check if the server has explicitly set a winning card player
    // This happens in tie situations resolved by tiebreaker
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
    
    // Get all cards on the table
    const tableCards = mesa;
    
    // Find the card we're checking
    const cardOnTable = tableCards.find(([pid, tableCard]) => 
        pid === playerIdOfCard && tableCard === card
      );
    
      if (!cardOnTable) return false;
      
    // Check if this is a cancelled card first
    if (isCancelledCard(playerIdOfCard, card)) {
      return false;
    }
    
    // If there's a manilha on the table, find the highest manilha
    const manilhaCards = tableCards.filter(([, tableCard]) => {
      const cardValue = tableCard.substring(0, tableCard.length - 1);
      return cardValue === manilha;
    });
    
    if (manilhaCards.length > 0) {
      // If this card is not a manilha, it can't win
      const thisCardValue = card.substring(0, card.length - 1);
      if (thisCardValue !== manilha) {
        return false;
      }
      
      // Among manilhas, find the strongest
      const maxManilhaStrength = Math.max(...manilhaCards.map(([, tableCard]) => getCardStrength(tableCard, manilha)));
      return getCardStrength(card, manilha) === maxManilhaStrength;
    }
        
    // No manilhas on table, find highest regular card
    const maxStrength = Math.max(...tableCards.map(([, tableCard]) => getCardStrength(tableCard, manilha)));
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