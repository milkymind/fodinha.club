import { useState, useEffect } from 'react';
import styles from '../../styles/Game.module.css';

interface DemoGameProps {
  gameId: string;
  playerId: number;
  onLeaveGame: () => void;
}

interface DemoGameState {
  players: number[];
  player_names: { [key: number]: string };
  vidas: { [key: number]: number };
  estado: string;
  carta_meio?: string;
  manilha?: string;
  maos?: { [key: number]: string[] };
  palpites?: { [key: number]: number };
  current_round?: number;
  current_hand?: number;
  current_player_idx?: number;
  ordem_jogada?: number[];
  multiplicador?: number;
  soma_palpites?: number;
  mesa?: [number, string][];
  vitorias?: { [key: number]: number };
  dealer?: number;
  cartas?: number;
  eliminados?: number[];
}

export default function DemoGame({ gameId, playerId, onLeaveGame }: DemoGameProps) {
  const [gameState, setGameState] = useState<DemoGameState>({
    players: [1, 2, 3],
    player_names: { 1: 'You', 2: 'Alice', 3: 'Bob' },
    vidas: { 1: 3, 2: 3, 3: 3 },
    estado: 'apostas',
    carta_meio: '7♥',
    manilha: '8',
    maos: {
      1: ['A♠', 'K♦', '10♣'],
      2: ['Q♥', 'J♠', '9♦'],
      3: ['8♣', '7♠', '6♥']
    },
    current_round: 1,
    current_hand: 0,
    current_player_idx: 0,
    ordem_jogada: [1, 2, 3],
    multiplicador: 1,
    soma_palpites: 0,
    dealer: 1,
    cartas: 3,
    eliminados: []
  });

  const [bet, setBet] = useState<string>('');
  const [gameStatus, setGameStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [currentPhase, setCurrentPhase] = useState<'betting' | 'playing' | 'round_over'>('betting');

  // Simulate game progression
  useEffect(() => {
    const timer = setInterval(() => {
      setGameState(prevState => {
        const newState = { ...prevState };
        
        // Simulate other players making moves
        if (prevState.estado === 'apostas' && prevState.current_player_idx !== undefined) {
          const nextPlayerIdx = (prevState.current_player_idx + 1) % prevState.players.length;
          if (nextPlayerIdx === 0 && prevState.players.every(p => prevState.palpites?.[p] !== undefined || p === playerId)) {
            // All bets placed, move to playing
            newState.estado = 'jogando';
            newState.current_player_idx = 0;
            setGameStatus("It's your turn to play a card!");
          } else if (nextPlayerIdx !== 0) {
            // AI players make random bets
            const aiPlayerId = prevState.players[nextPlayerIdx];
            if (!prevState.palpites?.[aiPlayerId]) {
              newState.palpites = { ...prevState.palpites, [aiPlayerId]: Math.floor(Math.random() * 3) };
              newState.soma_palpites = (prevState.soma_palpites || 0) + newState.palpites[aiPlayerId];
            }
            newState.current_player_idx = nextPlayerIdx;
          }
        }
        
        return newState;
      });
    }, 2000);

    return () => clearInterval(timer);
  }, [playerId]);

  // Update game status
  useEffect(() => {
    if (gameState.estado === 'apostas') {
      const currentPlayer = gameState.ordem_jogada?.[gameState.current_player_idx || 0];
      if (currentPlayer === playerId) {
        setGameStatus("It's your turn to place a bet!");
      } else if (currentPlayer !== undefined) {
        setGameStatus(`Waiting for ${gameState.player_names[currentPlayer]} to place a bet`);
      }
    } else if (gameState.estado === 'jogando') {
      const currentPlayer = gameState.ordem_jogada?.[gameState.current_player_idx || 0];
      if (currentPlayer === playerId) {
        setGameStatus("It's your turn to play a card!");
      } else if (currentPlayer !== undefined) {
        setGameStatus(`Waiting for ${gameState.player_names[currentPlayer]} to play a card`);
      }
    }
  }, [gameState, playerId]);

  const makeBet = () => {
    if (!bet) return;
    const betValue = parseInt(bet);
    
    setGameState(prevState => ({
      ...prevState,
      palpites: { ...prevState.palpites, [playerId]: betValue },
      soma_palpites: (prevState.soma_palpites || 0) + betValue,
      current_player_idx: (prevState.current_player_idx || 0) + 1
    }));
    
    setBet('');
  };

  const playCard = (cardIndex: number) => {
    const card = gameState.maos?.[playerId]?.[cardIndex];
    if (!card) return;

    setGameState(prevState => {
      const newState = { ...prevState };
      
      // Remove card from hand
      if (newState.maos?.[playerId]) {
        newState.maos[playerId] = newState.maos[playerId].filter((_, i) => i !== cardIndex);
      }
      
      // Add to mesa
      newState.mesa = [...(prevState.mesa || []), [playerId, card]];
      
      // Move to next player
      newState.current_player_idx = ((prevState.current_player_idx || 0) + 1) % prevState.players.length;
      
      return newState;
    });
  };

  const isPlayerTurn = () => {
    const currentPlayer = gameState.ordem_jogada?.[gameState.current_player_idx || 0];
    return currentPlayer === playerId;
  };

  const getCardColorClass = (card: string) => {
    const suit = card.charAt(card.length - 1);
    return suit === '♥' || suit === '♦' ? styles.redCard : styles.blackCard;
  };

  const formatCard = (card: string) => {
    return { 
      value: card.substring(0, card.length - 1),
      suit: card.charAt(card.length - 1)
    };
  };

  return (
    <div className={styles.gameContainer}>
      <div className={styles.header}>
        <h2>Demo Game: {gameId}</h2>
        <div className={styles.gameInfo}>
          <p className={styles.handInfo}>Hand: {(gameState.current_hand || 0) + 1}</p>
          <p className={styles.roundInfo}>Round: {gameState.current_round} of {gameState.cartas}</p>
        </div>
        <button onClick={onLeaveGame} className={styles.leaveButton}>
          Leave Game
        </button>
      </div>

      <div style={{ 
        background: '#fff3cd', 
        color: '#856404', 
        padding: '12px', 
        margin: '16px 0', 
        borderRadius: '8px',
        border: '1px solid #ffeaa7',
        textAlign: 'center'
      }}>
        🎮 <strong>Demo Mode</strong> - This is a simulated game to showcase the UI. In the real game, you'd play against real players!
      </div>

      {gameStatus && (
        <div className={styles.gameStatus}>
          <p>{gameStatus}</p>
        </div>
      )}

      {error && (
        <div className={styles.errorMessage}>
          <p>{error}</p>
        </div>
      )}

      <div className={styles.playersList}>
        <h3>Players</h3>
        <div className={styles.playersGrid}>
          {gameState.players.map((id) => (
            <div 
              key={id} 
              className={`${styles.playerCard} ${id === playerId ? styles.currentPlayer : ''} ${
                isPlayerTurn() && gameState.ordem_jogada?.[gameState.current_player_idx || 0] === id ? styles.activePlayer : ''
              }`}
            >
              <div className={styles.playerName}>
                {gameState.player_names[id]} {id === playerId ? '(You)' : ''}
                {gameState.dealer === id && <span className={styles.dealerLabel}> 🎲</span>}
              </div>
              <div className={styles.playerStats}>
                <div className={styles.playerLives}>
                  {'❤️'.repeat(gameState.vidas[id])}
                </div>
                {gameState.palpites && gameState.palpites[id] !== undefined && (
                  <div className={styles.playerBet}>
                    Bet: {gameState.palpites[id]}
                  </div>
                )}
                {gameState.vitorias && (
                  <div className={styles.playerWins}>
                    Wins: {gameState.vitorias[id] || 0}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.gameTable}>
        {gameState.carta_meio && (
          <div className={styles.tableInfo}>
            <div className={styles.centerCardContainer}>
              <div className={`${styles.card} ${getCardColorClass(gameState.carta_meio)}`}>
                <div className={styles.cardContent}>
                  <span className={styles.cardValue}>{formatCard(gameState.carta_meio).value}</span>
                  <span className={styles.cardSuit}>
                    {formatCard(gameState.carta_meio).suit}
                  </span>
                </div>
              </div>
              <div className={styles.cardLabel}>Middle Card</div>
            </div>
            <div className={styles.manilhaContainer}>
              <div className={styles.manilhaInfo}>
                <span>Manilha: </span>
                <span className={styles.manilhaValue}>{gameState.manilha}</span>
              </div>
            </div>
          </div>
        )}

        {gameState.mesa && gameState.mesa.length > 0 && (
          <div className={styles.playedCards}>
            <h3>Played Cards</h3>
            <div className={styles.tableCards}>
              {gameState.mesa.map(([pid, card], index) => (
                <div key={index} className={styles.playedCardContainer}>
                  <div className={`${styles.card} ${getCardColorClass(card)}`}>
                    <div className={styles.cardContent}>
                      <span className={styles.cardValue}>{formatCard(card).value}</span>
                      <span className={styles.cardSuit}>
                        {formatCard(card).suit}
                      </span>
                    </div>
                  </div>
                  <div className={styles.playerLabel}>
                    {gameState.player_names[pid]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {gameState.estado === 'apostas' && isPlayerTurn() && (
        <div className={styles.betContainer}>
          <h3>Make Your Bet</h3>
          <div className={styles.betControls}>
            <input
              type="number"
              value={bet}
              onChange={(e) => setBet(e.target.value)}
              min="0"
              max={gameState.cartas || 1}
              className={styles.betInput}
            />
            <button onClick={makeBet} className={styles.actionButton}>
              Confirm Bet
            </button>
          </div>
          <p className={styles.betHint}>
            Total bets so far: {gameState.soma_palpites || 0} / {gameState.cartas}
          </p>
        </div>
      )}

      {gameState.maos && gameState.maos[playerId] && gameState.maos[playerId].length > 0 && (
        <div className={styles.handContainer}>
          <h3>Your Hand</h3>
          <div className={styles.cards}>
            {gameState.maos[playerId].map((card, index) => (
              <button
                key={index}
                onClick={() => gameState.estado === 'jogando' && isPlayerTurn() ? playCard(index) : null}
                className={`${styles.card} ${getCardColorClass(card)} ${
                  gameState.estado === 'jogando' && isPlayerTurn() ? styles.playable : ''
                }`}
                disabled={gameState.estado !== 'jogando' || !isPlayerTurn()}
              >
                <div className={styles.cardContent}>
                  <span className={styles.cardValue}>{formatCard(card).value}</span>
                  <span className={styles.cardSuit}>
                    {formatCard(card).suit}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {gameState.palpites && Object.keys(gameState.palpites).length > 0 && (
        <div className={styles.betsInfo}>
          <h3>All Bets</h3>
          <div className={styles.betsList}>
            {Object.entries(gameState.palpites).map(([pid, betValue]) => (
              <div key={pid} className={styles.betItem}>
                <span className={styles.betPlayer}>{gameState.player_names[Number(pid)]}</span>
                <span className={styles.betValue}>{betValue}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 