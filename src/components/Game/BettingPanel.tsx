import React, { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import styles from '../../../styles/Game.module.css';

interface BettingPanelProps {
  gameState: string; // Current game state
  isMyTurn: boolean;
  maxBet: number; // gameState.cartas
  currentTotal: number; // gameState.soma_palpites
  isLastPlayerToBet: boolean;
  onMakeBet: (bet: number) => void;
  isSubmittingBet: boolean;
}

export const BettingPanel: React.FC<BettingPanelProps> = ({
  gameState,
  isMyTurn,
  maxBet,
  currentTotal,
  isLastPlayerToBet,
  onMakeBet,
  isSubmittingBet
}) => {
  const { t } = useLanguage();
  const [bet, setBet] = useState<string>('');
  const [betError, setBetError] = useState<string>('');

  // Don't show if not in betting state
  if (gameState !== 'apostas') {
    return null;
  }

  // Show different message if not player's turn (removed per user request)
  if (!isMyTurn) {
    return null;
  }

  const handleMakeBet = () => {
    if (!bet || isSubmittingBet) return;
    
    const betValue = parseInt(bet);
    
    // Clear any previous error
    setBetError('');
    
    // Validate bet value
    if (isNaN(betValue) || betValue < 0) {
      setBetError(t('valid_bet_error'));
      return;
    }
    
    if (betValue > maxBet) {
      setBetError(t('bet_too_high_error', { maxBet }));
      return;
    }
    
    // Check if this bet would make the total equal to the number of cards
    // This restriction only applies to the LAST player in the betting round
    if (isLastPlayerToBet && (currentTotal + betValue) === maxBet) {
      setBetError(t('last_player_bet_error'));
      return;
    }
    
    // Call the parent's bet handler
    onMakeBet(betValue);
    
    // Clear bet on successful submission (will be cleared by socket response)
    setBet('');
  };

  const handleBetChange = (value: string) => {
    setBet(value);
    setBetError(''); // Clear error when input changes
  };

  return (
    <div className={styles.betContainer}>
      <h3>{t('make_your_bet')}</h3>
      <div className={styles.betControls}>
        <input
          type="number"
          value={bet}
          onChange={(e) => handleBetChange(e.target.value)}
          min="0"
          max={maxBet}
          className={styles.betInput}
          disabled={isSubmittingBet}
        />
        <button 
          onClick={handleMakeBet} 
          className={`${styles.actionButton} ${isSubmittingBet ? styles.buttonDisabled : ''}`}
          disabled={isSubmittingBet}
        >
          {isSubmittingBet ? t('submitting_bet') : t('bet')}
        </button>
      </div>
      {betError && (
        <p className={styles.errorMessage}>{betError}</p>
      )}
      <p className={styles.betHint}>
        {t('total_bets_so_far', { current: currentTotal, total: maxBet })}
      </p>
    </div>
  );
}; 