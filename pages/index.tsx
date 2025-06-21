import { useState, useEffect, useRef, useContext } from 'react';
import Head from 'next/head';
import styles from '../styles/Home.module.css';
import Game from '../src/components/Game/index';
import { useLanguage } from '../contexts/LanguageContext';
import { SocketContext } from '../contexts/SocketContext';

import { useGuest } from '../contexts/GuestContext';
import AuthWrapper from '../components/AuthWrapper';
import UsernameSetup from '../components/UsernameSetup';
import Logo from '../components/Logo';
import HeaderLogo from '../components/HeaderLogo';
import { useUser } from '@clerk/nextjs';

interface LobbyInfo {
  players: { id: number; name: string }[];
  maxPlayers: number;
  lives: number;
  startFrom?: 'one' | 'max';
}

export default function Home() {
  const { t } = useLanguage();
  const { user, isLoaded } = useUser();
  const { isGuest, guestName } = useGuest();
  const socket = useContext(SocketContext);
  const [gameId, setGameId] = useState<string>('');
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState<string>('');
  const [joinGameId, setJoinGameId] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [lives, setLives] = useState<number>(3);
  const [startFrom, setStartFrom] = useState<'one' | 'max'>('one');
  const [lobbyInfo, setLobbyInfo] = useState<LobbyInfo | null>(null);
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [showUsernameSetup, setShowUsernameSetup] = useState<boolean>(false);

  // Set default player name from user when loaded or from guest name
  useEffect(() => {
    // Leave name field empty for customization - removed automatic defaults
    // Users can enter their own preferred names
  }, [isLoaded, user, playerName, isGuest, guestName]);

  // Update player name when transitioning from guest to authenticated
  useEffect(() => {
    // Leave name field empty for customization - removed automatic defaults
    // Users can enter their own preferred names
  }, [isLoaded, user, isGuest, playerName, guestName]);

  const handleUsernameSet = (username: string) => {
    setShowUsernameSetup(false);
  };

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
          lives: lives,
          start_from: startFrom 
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

  const handleReturnToLobby = async () => {
    if (!gameId || !playerId) return;
    
    // Check if this player is the host
    const isHost = lobbyInfo?.players?.[0]?.id === playerId;
    
    if (isHost) {
      // Host: Make API call to reset game state
      try {
        const response = await fetch(`/api/return-to-lobby/${gameId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ player_id: playerId }),
        });
        
        const data = await response.json();
        if (data.status === 'success') {
          // Successfully reset to lobby state
          setGameStarted(false);
          // Refresh lobby info multiple times to ensure we get updated player list
          const refreshLobby = async (attempts = 0) => {
            try {
              const lobbyResponse = await fetch(`/api/lobby-info/${gameId}`);
              const lobbyData = await lobbyResponse.json();
              if (lobbyData.status === 'success') {
                setLobbyInfo(lobbyData.lobby);
                console.log(`Lobby refreshed (attempt ${attempts + 1}):`, lobbyData.lobby.players.length, 'players');
              }
              // Refresh again after a short delay to catch any players who left
              if (attempts < 2) {
                setTimeout(() => refreshLobby(attempts + 1), 1000);
              }
            } catch (error) {
              console.error('Error refreshing lobby info:', error);
            }
          };
          refreshLobby();
        } else {
          console.error('Failed to return to lobby:', data.error);
          setError(data.error || 'Failed to return to lobby');
        }
      } catch (error) {
        console.error('Error returning to lobby:', error);
        setError('Failed to return to lobby');
      }
    } else {
      // Non-host: Just update local state (triggered by socket event)
      console.log('Non-host player returning to lobby via socket event');
      setGameStarted(false);
      // Refresh lobby info multiple times to ensure we get updated player list
      const refreshLobby = async (attempts = 0) => {
        try {
          const lobbyResponse = await fetch(`/api/lobby-info/${gameId}?playerId=${playerId}`);
          const lobbyData = await lobbyResponse.json();
          if (lobbyData.status === 'success') {
            setLobbyInfo(lobbyData.lobby);
            console.log(`Non-host lobby refreshed (attempt ${attempts + 1}):`, lobbyData.lobby.players.length, 'players');
          }
          // Refresh again after a short delay to catch any players who left
          if (attempts < 2) {
            setTimeout(() => refreshLobby(attempts + 1), 1000);
          }
        } catch (error) {
          console.error('Error refreshing lobby info:', error);
        }
      };
      refreshLobby();
    }
  };

  // Poll lobby info less frequently - WebSocket should handle most updates
  useEffect(() => {
    if (gameId && playerId && !gameStarted) {
      const poll = async () => {
        try {
          const response = await fetch(`/api/lobby-info/${gameId}?playerId=${playerId}`);
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
      pollingRef.current = setInterval(poll, 500); // Poll every 500ms for maximum responsiveness
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [gameId, playerId, gameStarted]);

  // Listen for lobby updates via socket and join game room
  useEffect(() => {
    if (gameId && playerId && !gameStarted && socket) {
      // Join the game room so the server knows this socket belongs to this player/game
      console.log(`Joining game room ${gameId} as player ${playerId}`);
      socket.emit('join-game', { 
        gameId, 
        playerId, 
        playerName: playerName || `Player ${playerId}` 
      });

      const handleLobbyUpdate = (data: any) => {
        console.log('Received lobby update:', data);
        if (data.gameId === gameId) {
          // Refresh lobby info to get the latest player list
          fetch(`/api/lobby-info/${gameId}?playerId=${playerId}`)
            .then(response => response.json())
            .then(lobbyData => {
              if (lobbyData.status === 'success') {
                setLobbyInfo(lobbyData.lobby);
                console.log('Updated lobby after socket notification:', lobbyData.lobby.players.length, 'players');
              }
            })
            .catch(error => console.error('Error refreshing lobby after update:', error));
        }
      };

      const handlePlayerDisconnected = (data: any) => {
        console.log('Player disconnected:', data);
        // Trigger immediate lobby refresh with force cleanup
        fetch(`/api/lobby-info/${gameId}?playerId=${playerId}&forceCleanup=true`)
          .then(response => response.json())
          .then(lobbyData => {
            if (lobbyData.status === 'success') {
              setLobbyInfo(lobbyData.lobby);
              console.log('Updated lobby after player disconnect:', lobbyData.lobby.players.length, 'players');
            }
          })
          .catch(error => console.error('Error refreshing lobby after disconnect:', error));
      };

      const handlePlayerLeft = (data: any) => {
        console.log('Player left:', data);
        // Trigger immediate lobby refresh to update player list
        fetch(`/api/lobby-info/${gameId}?playerId=${playerId}`)
          .then(response => response.json())
          .then(lobbyData => {
            if (lobbyData.status === 'success') {
              setLobbyInfo(lobbyData.lobby);
              console.log('Updated lobby after player left:', lobbyData.lobby.players.length, 'players');
            }
          })
          .catch(error => console.error('Error refreshing lobby after player left:', error));
      };

      const handleForceLobbyRefresh = (data: any) => {
        console.log('Force lobby refresh triggered:', data);
        // Immediate aggressive refresh with force cleanup
        fetch(`/api/lobby-info/${gameId}?playerId=${playerId}&forceCleanup=true`)
          .then(response => response.json())
          .then(lobbyData => {
            if (lobbyData.status === 'success') {
              setLobbyInfo(lobbyData.lobby);
              console.log('Force refreshed lobby:', lobbyData.lobby.players.length, 'players');
            }
          })
          .catch(error => console.error('Error in force lobby refresh:', error));
      };

      socket.on('lobby-updated', handleLobbyUpdate);
      socket.on('player-disconnected', handlePlayerDisconnected);
      socket.on('player-left', handlePlayerLeft);
      socket.on('force-lobby-refresh', handleForceLobbyRefresh);
      
      return () => {
        socket.off('lobby-updated', handleLobbyUpdate);
        socket.off('player-disconnected', handlePlayerDisconnected);
        socket.off('player-left', handlePlayerLeft);
        socket.off('force-lobby-refresh', handleForceLobbyRefresh);
        // Leave the game room when component unmounts or dependencies change
        socket.emit('leave-game', { gameId, playerId });
      };
    }
  }, [gameId, playerId, gameStarted, socket, playerName]);

  // Additional polling for players in game to detect lobby return
  useEffect(() => {
    if (gameId && playerId && gameStarted) {
      const pollForLobbyReturn = async () => {
        try {
          const response = await fetch(`/api/lobby-info/${gameId}?playerId=${playerId}`);
          const data = await response.json();
          if (data.status === 'success' && !data.lobby.gameStarted) {
            // Game has been returned to lobby
            console.log('Detected lobby return via polling - returning to lobby');
            setGameStarted(false);
            setLobbyInfo(data.lobby);
            // Trigger additional refresh to catch any players who left
            setTimeout(async () => {
              try {
                const refreshResponse = await fetch(`/api/lobby-info/${gameId}?playerId=${playerId}`);
                const refreshData = await refreshResponse.json();
                if (refreshData.status === 'success') {
                  setLobbyInfo(refreshData.lobby);
                  console.log('Additional lobby refresh after return:', refreshData.lobby.players.length, 'players');
                }
              } catch (error) {
                console.error('Error in additional lobby refresh:', error);
              }
            }, 2000);
          }
        } catch (e) {
          // ignore
        }
      };
      
      // Poll every 15 seconds while in game to detect lobby return
      const pollInterval = setInterval(pollForLobbyReturn, 15000);
      return () => clearInterval(pollInterval);
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
      <AuthWrapper gameId={gameId} playerId={playerId}>
        <Head>
          <title>{process.env.NODE_ENV === 'development' ? 'FODINHA.CLUB LOCAL' : 'FODINHA.CLUB'}</title>
        </Head>
        <Game
          gameId={gameId}
          playerId={playerId}
          onLeaveGame={handleLeaveGame}
          onReturnToLobby={handleReturnToLobby}
        />
      </AuthWrapper>
    );
  }

  // Show lobby info if in a lobby but before game starts
  if ((gameId && playerId) && lobbyInfo) {
    const isHost = lobbyInfo.players[0]?.id === playerId;
    return (
      <AuthWrapper gameId={gameId} playerId={playerId}>
        <Head>
          <title>{process.env.NODE_ENV === 'development' ? 'FODINHA.CLUB LOCAL' : 'FODINHA.CLUB'}</title>
        </Head>

        <div className={styles.container}>
        <h2>{t('lobby', { id: gameId })}</h2>
        <div className={styles.section}>
          <h3>{t('players_count', { current: lobbyInfo.players.length, max: lobbyInfo.maxPlayers })}</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {lobbyInfo.players.map((p) => (
              <li key={p.id} style={{ fontWeight: p.id === playerId ? 'bold' : 'normal' }}>
                {p.name}
              </li>
            ))}
          </ul>
          <p className={styles.lobbyInfo}>{t('lives')}: <b>{lobbyInfo.lives}</b></p>
          <p className={styles.lobbyInfo}>{t('start_game_from')}: <b>{lobbyInfo.startFrom === 'max' ? t('max_cards') : t('one_card')}</b></p>
          <div className={styles.lobbyButtons}>
            <button className={styles.secondaryButton} onClick={handleLeaveGame}>{t('leave_lobby')}</button>
            {isHost && (
              <button className={styles.button} onClick={handleStartGame} disabled={lobbyInfo.players.length < 2}>
                {t('start_game')}
              </button>
            )}
          </div>
          {isHost && lobbyInfo.players.length < 2 && (
            <p style={{ color: 'red', marginTop: 8 }}>{t('min_players_required')}</p>
          )}
        </div>
      </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <Head>
        <title>{process.env.NODE_ENV === 'development' ? 'FODINHA.CLUB LOCAL' : 'FODINHA.CLUB'}</title>
      </Head>
      {showUsernameSetup && (
        <UsernameSetup onUsernameSet={handleUsernameSet} />
      )}

      <div className={styles.container}>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      {/* Home Banner Image */}
      <div className={styles.section} style={{ padding: 0, backgroundColor: 'transparent' }}>
        <img 
          src="/home-banner.jpeg" 
          alt="Fodinha Game Banner" 
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '6px',
            display: 'block'
          }}
        />
      </div>
      
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

        <div className={styles.startFromSelection}>
          <h3>{t('start_game_from')}</h3>
          <div className={styles.startFromOptions}>
            <button 
              onClick={() => setStartFrom('one')} 
              className={`${styles.startFromButton} ${startFrom === 'one' ? styles.selected : ''}`}
            >
              {t('one_card_hand')}
            </button>
            <button 
              onClick={() => setStartFrom('max')} 
              className={`${styles.startFromButton} ${startFrom === 'max' ? styles.selected : ''}`}
            >
              {t('max_card_hand')}
            </button>
          </div>
        </div>

        <div className={styles.buttonsGroup}>
          <button
            onClick={createGame}
            className={styles.button}
            disabled={!playerName}
          >
                            {t('create_new_lobby')}
          </button>
        </div>
        
        <div className={styles.joinSection}>
          <h3>{t('join_existing_lobby')}</h3>
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
                              {t('join_lobby')}
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
              <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }} className={styles.hierarchyNote}>
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
    </AuthWrapper>
  );
} 