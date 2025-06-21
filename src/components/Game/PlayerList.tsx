import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import styles from '../../../styles/Game.module.css';

interface PlayerListProps {
  players: number[];
  playerNames: { [key: number]: string };
  lives: { [key: number]: number };
  currentPlayerId: number;
  gameState: string; // Current game state
  currentPlayerIdx?: number;
  ordemJogada?: number[];
  lastRoundWinner?: number;
  lastTrickWinner?: number;
  dealer?: number;
  inactivePlayers?: number[];
  palpites?: { [key: number]: number }; // Player bets
  vitorias?: { [key: number]: number }; // Player wins
}

export const PlayerList: React.FC<PlayerListProps> = ({
  players,
  playerNames,
  lives,
  currentPlayerId,
  gameState,
  currentPlayerIdx,
  ordemJogada,
  lastRoundWinner,
  lastTrickWinner,
  dealer,
  inactivePlayers,
  palpites,
  vitorias
}) => {
  const { t } = useLanguage();

  // Helper function to check if a player is inactive
  const isPlayerInactive = (id: number): boolean => {
    // Only mark players as inactive if they have been detected as inactive by the server
    // and they are not just waiting for their turn
    return !!(inactivePlayers?.includes(id) && 
      // Don't show inactive during betting/playing phase for the players in the queue
      !((gameState === 'apostas' || gameState === 'jogando') && 
        ordemJogada?.includes(id)));
  };
  
  // Helper function to check if player is waiting for their turn
  const isPlayerWaiting = (id: number): boolean => {
    return !!(ordemJogada && (gameState === 'apostas' || gameState === 'jogando') && 
           ordemJogada.includes(id) &&
           id !== ordemJogada[currentPlayerIdx || 0]);
  };

  return (
    <div className={styles.playersList}>
      <h3>{t('players')}</h3>
      <div className={styles.playersGrid}>
        {players.map((id) => (
          <div 
            key={id} 
            className={`${styles.playerCard} 
              ${id === currentPlayerId ? styles.currentPlayer : ''} 
              ${ordemJogada?.[currentPlayerIdx || 0] === id ? styles.activePlayer : ''} 
              ${(lastRoundWinner === id || lastTrickWinner === id) ? styles.lastWinner : ''}
              ${isPlayerInactive(id) ? styles.inactivePlayer : ''}
              ${isPlayerWaiting(id) ? styles.waitingPlayer : ''}`}
          >
            <div className={styles.playerName}>
              {playerNames[id]}
              {dealer === id && <span className={styles.dealerLabel}> 🎲</span>}
              {isPlayerInactive(id) && <span className={styles.inactiveLabel}> ⚠️ {t('inactive')}</span>}
            </div>
            <div className={styles.playerStats}>
              <div className={styles.playerLives}>
                {'❤️'.repeat(Math.max(0, lives[id]))}
                {lives[id] <= 0 && <span className={styles.eliminatedText}>{t('eliminated')}</span>}
              </div>
              {(palpites && palpites[id] !== undefined) || vitorias ? (
                <>
                  <div className={styles.playerBetWins}>
                    {palpites && palpites[id] !== undefined && (
                      <span className={styles.betText}>{t('bet')}: {palpites[id]}</span>
                    )}
                    {vitorias && (
                      <span className={styles.winsText}>{t('wins')}: {vitorias[id] || 0}</span>
                    )}
                  </div>
                  {palpites && palpites[id] !== undefined && vitorias && (
                    <div className={styles.playerNeeds}>
                      <span className={styles.needsText}>{t('needs_to_win')}: {Math.max(0, palpites[id] - (vitorias[id] || 0))}</span>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 