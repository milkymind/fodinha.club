import { useState, useEffect, useRef } from 'react';
import styles from '../styles/Home.module.css';
import Game from '../src/components/Game';
import { useLanguage } from '../contexts/LanguageContext';
import LanguageToggle from '../src/components/LanguageToggle';
import BugReportButton from '../src/components/BugReportButton';

interface LobbyInfo {
  players: { id: number; name: string }[];
  maxPlayers: number;
  lives: number;
}

export default function Home() {
  const { t } = useLanguage();
  const [gameId, setGameId] = useState<string>('');
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [joinGameId, setJoinGameId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [lives, setLives] = useState<number>(3);
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const createGame = async () => {
    try {
      setError('');
      const response = await fetch('/api/create-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          player_name: playerName,
          lives: lives 
        }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        setGameId(data.game_id);
        setPlayerId(data.player_id);
        setLobbyInfo(data.lobby);
        setError('');
      } else {
        setError(data.error || t('failed_to_create'));
      }
    } catch (error) {
      console.error('Error creating game:', error);
      setError(t('failed_to_connect'));
    }
  };

  const joinGame = async (id: string) => {
    try {
      setError('');
      const response = await fetch(`/api/join-game/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ player_name: playerName }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        setPlayerId(data.player_id);
        setGameId(id);
        setLobbyInfo(data.lobby);
        setError('');
      } else {
        setError(data.error || t('failed_to_join'));
      }
    } catch (error) {
      console.error('Error joining game:', error);
      setError(t('failed_to_connect'));
    }
  };

  const handleLeaveGame = () => {
    setGameId('');
    setPlayerId(null);
    setJoinGameId('');
    setLobbyInfo(null);
    setGameStarted(false);
    setError('');
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Poll lobby info every 2 seconds if in a lobby and game not started
  useEffect(() => {
    if (gameId && playerId && !gameStarted) {
      const poll = async () => {
        try {
          const response = await fetch(`/api/lobby-info/${gameId}`);
          const data = await response.json();
          if (data.status === 'success') {
            setLobbyInfo(data.lobby);
            if (data.lobby.gameStarted) {
              setGameStarted(true);
            }
          }
        } catch (e) {
          // ignore
        }
      };
      poll();
      pollingRef.current = setInterval(poll, 2000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [gameId, playerId, gameStarted]);

  // Start game handler (host only)
  const handleStartGame = async () => {
    if (!gameId) return;
    try {
      const response = await fetch(`/api/start-game/${gameId}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.status === 'success') {
        setGameStarted(true);
      } else {
        setError(data.error || t('failed_to_create'));
      }
    } catch (e) {
      setError(t('failed_to_create'));
    }
  };

  // Show Game component if started
  if ((gameId && playerId) && gameStarted) {
    return (
      <Game
        gameId={gameId}
        playerId={playerId}
        onLeaveGame={handleLeaveGame}
      />
    );
  }

  // Show lobby info if in a lobby but before game starts
  if ((gameId && playerId) && lobbyInfo) {
    const isHost = lobbyInfo.players[0]?.id === playerId;
    return (
      <div className={styles.container}>
        <LanguageToggle />
        <BugReportButton gameId={gameId} playerId={playerId} />
        <h2>{t('lobby', { id: gameId })}</h2>
        <div className={styles.section}>
          <h3>{t('players_count', { current: lobbyInfo.players.length, max: lobbyInfo.maxPlayers })}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {lobbyInfo.players.map((p) => (
              <li key={p.id} style={{ fontWeight: p.id === playerId ? 'bold' : 'normal' }}>
                {p.name} {p.id === playerId ? t('you') : ''}
              </li>
            ))}
          </ul>
          <p>{t('lives_per_player', { lives: lobbyInfo.lives })}</p>
          <p>{t('share_lobby_code', { code: gameId })}</p>
          {isHost && (
            <button className={styles.button} onClick={handleStartGame} disabled={lobbyInfo.players.length < 2}>
              {t('start_game')}
            </button>
          )}
          <button className={styles.button} onClick={handleLeaveGame}>{t('leave_lobby')}</button>
          {isHost && lobbyInfo.players.length < 2 && (
            <p style={{ color: 'red', marginTop: 8 }}>{t('min_players_required')}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <LanguageToggle />
      <BugReportButton />
      <h1 className={styles.title}>{t('title')}</h1>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      <div className={styles.section}>
        <h2>{t('join_or_create')}</h2>
        <div className={styles.inputGroup}>
          <input
            type="text"
            placeholder={t('your_name')}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.livesSelection}>
          <h3>{t('select_lives')}</h3>
          <div className={styles.livesOptions}>
            <button 
              onClick={() => setLives(3)} 
              className={`${styles.livesButton} ${lives === 3 ? styles.selected : ''}`}
            >
              {t('lives_count', { count: 3 })}
            </button>
            <button 
              onClick={() => setLives(5)} 
              className={`${styles.livesButton} ${lives === 5 ? styles.selected : ''}`}
            >
              {t('lives_count', { count: 5 })}
            </button>
            <button 
              onClick={() => setLives(7)} 
              className={`${styles.livesButton} ${lives === 7 ? styles.selected : ''}`}
            >
              {t('lives_count', { count: 7 })}
            </button>
          </div>
        </div>

        <div className={styles.buttonsGroup}>
          <button
            onClick={createGame}
            className={styles.button}
            disabled={!playerName}
          >
            {t('create_new_game')}
          </button>
        </div>
        
        <div className={styles.joinSection}>
          <h3>{t('join_existing_game')}</h3>
          <div className={styles.inputGroup}>
            <input
              type="text"
              placeholder={t('game_id')}
              value={joinGameId}
              onChange={(e) => setJoinGameId(e.target.value)}
              className={styles.input}
            />
            <button
              onClick={() => joinGame(joinGameId)}
              className={styles.button}
              disabled={!joinGameId || !playerName}
            >
              {t('join_game')}
            </button>
          </div>
        </div>
      </div>
      {gameId && !playerId && (
        <div className={styles.section}>
          <h2>{t('game_created')}</h2>
          <p>{t('your_game_id', { id: gameId })}</p>
          <p>{t('share_id')}</p>
          <button
            onClick={() => joinGame(gameId)}
            className={styles.button}
            disabled={!playerName}
          >
            {t('join_your_game')}
          </button>
        </div>
      )}
      
      {/* Rules/Tutorial Section */}
      <div className={styles.section}>
        <h2>{t('how_to_play')}</h2>
        <div className={styles.rulesSection}>
          
          <h3>{t('game_overview')}</h3>
          <p>{t('game_overview_text')}</p>
          
          <h3>{t('game_setup')}</h3>
          <ul>
            <li><strong>{t('game_setup_players')}</strong></li>
            <li><strong>{t('game_setup_lives')}</strong></li>
            <li><strong>{t('game_setup_cards')}</strong></li>
          </ul>
          
          <div className={styles.cardHierarchy}>
            <h3>{t('card_hierarchy')}</h3>
            <div className={styles.hierarchyProgression}>
              <p><strong>{t('card_hierarchy_progression')}</strong></p>
              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                {t('card_hierarchy_note')}
              </p>
            </div>
          </div>
          
          <h3>{t('how_to_play_section')}</h3>
          <div style={{ marginLeft: '20px' }}>
            <h4>{t('betting_phase_rules')}</h4>
            <ul>
              <li>{t('betting_phase_text1')}</li>
              <li><strong>{t('betting_phase_text2')}</strong></li>
              <li>{t('betting_phase_text3')}</li>
            </ul>
            
            <h4>{t('playing_phase_rules')}</h4>
            <ul>
              <li>{t('playing_phase_text1')}</li>
              <li>{t('playing_phase_text2')}</li>
              <li>{t('playing_phase_text3')}</li>
              <li><strong>{t('playing_phase_text4')}</strong></li>
            </ul>
            
            <h4>{t('scoring_rules')}</h4>
            <ul>
              <li><strong>{t('scoring_text1')}</strong></li>
              <li><strong>{t('scoring_text2')}</strong></li>
            </ul>
          </div>
          
          <h3>{t('winning_elimination')}</h3>
          <ul>
            <li>{t('winning_text1')}</li>
            <li>{t('winning_text2')}</li>
            <li>{t('winning_text3')}</li>
          </ul>
          
          <h3>{t('strategy_tips')}</h3>
          <ul>
            <li><strong>{t('strategy_tip1')}</strong></li>
            <li><strong>{t('strategy_tip2')}</strong></li>
            <li><strong>{t('strategy_tip3')}</strong></li>
            <li><strong>{t('strategy_tip4')}</strong></li>
          </ul>
          
          <h3>{t('special_rules')}</h3>
          <ul>
            <li><strong>{t('special_rule1')}</strong></li>
            <li><strong>{t('special_rule2')}</strong></li>
            <li><strong>{t('special_rule3')}</strong></li>
          </ul>
          
          <div className={styles.importantNote}>
            <strong>{t('pro_tip')}</strong>
          </div>
          
        </div>
      </div>
    </div>
  );
} 