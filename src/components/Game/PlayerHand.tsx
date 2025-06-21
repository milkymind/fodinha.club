import React, { useState, useMemo, memo } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { 
  getCardColorClass, 
  getSuitClass, 
  formatCard,
  sortCardsByStrength 
} from './utils/cardLogic';
import styles from '../../../styles/Game.module.css';

interface PlayerHandProps {
  cards: string[];
  manilha?: string;
  gameState: string; // 'apostas', 'jogando', etc.
  isMyTurn: boolean;
  isPlayingCard: boolean;
  isOneCardHand: boolean;
  clickedCardIndex: number | null;
  onPlayCard: (cardIndex: number) => void;
}

export const PlayerHand = memo<PlayerHandProps>(({
  cards,
  manilha,
  gameState,
  isMyTurn,
  isPlayingCard,
  isOneCardHand,
  clickedCardIndex,
  onPlayCard
}) => {
  const { t } = useLanguage();
  const [isCardsSorted, setIsCardsSorted] = useState<boolean>(false);
  const [originalCardOrder, setOriginalCardOrder] = useState<string[]>([]);

  // Toggle card sorting
  const toggleCardSorting = () => {
    if (!cards || cards.length === 0) return;
    
    if (!isCardsSorted) {
      // Store original order before sorting
      setOriginalCardOrder([...cards]);
      setIsCardsSorted(true);
    } else {
      // Return to original order
      setIsCardsSorted(false);
    }
  };

  // Get sorted cards
  const getSortedCards = (): string[] => {
    if (!cards || cards.length === 0) return [];
    
    if (!isCardsSorted) {
      return cards;
    }
      
    // Sort cards by strength (lowest to highest, left to right)
    return sortCardsByStrength(cards, manilha);
  };

  // Get original card index from sorted index
  const getOriginalCardIndex = (sortedIndex: number): number => {
    if (!isCardsSorted || !cards) return sortedIndex;
    
    const sortedCards = getSortedCards();
    const sortedCard = sortedCards[sortedIndex];
    return cards.indexOf(sortedCard);
  };

  // Don't render if no cards
  if (!cards || cards.length === 0) {
    return null;
  }

  // For one-card hand during playing phase, show hidden card
  if (isOneCardHand && gameState === 'jogando') {
    return (
      <div className={styles.handContainer}>
        <h3>{t('your_hand')}</h3>
        <div className={styles.cards}>
          <button
            onClick={() => isMyTurn && !isPlayingCard ? onPlayCard(0) : null}
            className={`${styles.card} ${styles.hiddenCard} ${
              isMyTurn && !isPlayingCard ? styles.playable : ''
            } ${clickedCardIndex === 0 ? styles.cardSelected : ''}`}
            disabled={!isMyTurn || isPlayingCard}
          >
            <div className={styles.cardBackContent}>
              <span>?</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // Only show player's hand if it's not a one-card hand
  if (isOneCardHand) {
    return null;
  }

  return (
    <div className={styles.handContainer}>
      <div className={styles.handHeader}>
        <h3>{t('your_hand')}</h3>
        <button 
          onClick={toggleCardSorting}
          className={`${styles.filterButton} ${isCardsSorted ? styles.filterActive : ''}`}
          title={isCardsSorted ? t('show_original_order') : t('sort_by_strength')}
        >
          📶
        </button>
      </div>
      <div className={styles.cards}>
        {getSortedCards().map((card, index) => (
          <button
            key={`${card}-${index}`}
            onClick={() => gameState === 'jogando' && isMyTurn && !isPlayingCard ? onPlayCard(getOriginalCardIndex(index)) : null}
            className={`${styles.card} ${getCardColorClass(card)} ${
              gameState === 'jogando' && isMyTurn && !isPlayingCard ? styles.playable : ''
            } ${clickedCardIndex === getOriginalCardIndex(index) ? styles.cardSelected : ''}`}
            disabled={gameState !== 'jogando' || !isMyTurn || isPlayingCard}
          >
            <div className={styles.cardContent}>
              <span className={styles.cardValue}>{formatCard(card).value}</span>
              <span className={`${styles.cardSuit} ${getSuitClass(card)}`}>
                {formatCard(card).suit}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

PlayerHand.displayName = 'PlayerHand'; 