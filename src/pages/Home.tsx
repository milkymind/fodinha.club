import { useState, useEffect, useRef } from 'react';
import styles from '../../styles/Home.module.css';
import Game from '../components/Game/index';
import DemoGame from '../components/DemoGame';

interface LobbyInfo {
  players: { id: number; name: string }[];
  maxPlayers: number;
  lives: number;
}

interface HomeProps {
  demoMode?: boolean;
  isCheckingBackend?: boolean;
}

export default function Home({ demoMode = false, isCheckingBackend = false }: HomeProps) {
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
      
      // Demo mode - simulate creating a game without backend
      if (demoMode) {
        console.log('Demo mode: Creating mock game');
        const mockGameId = 'DEMO' + Math.random().toString(36).substring(2, 8).toUpperCase();
        const mockPlayerId = 1;
        const mockLobby = {
          players: [{ id: mockPlayerId, name: playerName || 'Demo Player' }],
          maxPlayers: 4,
          lives: lives
        };
        
        setGameId(mockGameId);
        setPlayerId(mockPlayerId);
        setLobbyInfo(mockLobby);
        setError('');
        
        // Auto-start the game after a short delay in demo mode
        setTimeout(() => {
          setGameStarted(true);
        }, 2000);
        return;
      }
      
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
        setError(data.error || 'Failed to create game');
      }
    } catch (error) {
      console.error('Error creating game:', error);
      setError('Failed to connect to the game server');
    }
  };

  const joinGame = async (id: string) => {
    try {
      setError('');
      
      // Demo mode - simulate joining a game
      if (demoMode) {
        console.log('Demo mode: Joining mock game');
        const mockPlayerId = 2;
        const mockLobby = {
          players: [
            { id: 1, name: 'Demo Host' },
            { id: mockPlayerId, name: playerName || 'Demo Player' }
          ],
          maxPlayers: 4,
          lives: 3
        };
        
        setPlayerId(mockPlayerId);
        setGameId(id);
        setLobbyInfo(mockLobby);
        setError('');
        
        // Auto-start the game after a short delay in demo mode
        setTimeout(() => {
          setGameStarted(true);
        }, 2000);
        return;
      }
      
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
        setError(data.error || 'Failed to join game');
      }
    } catch (error) {
      console.error('Error joining game:', error);
      setError('Failed to connect to the game server');
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
        setError(data.error || 'Failed to start game');
      }
    } catch (e) {
      setError('Failed to start game');
    }
  };

  // Show Game component if started
  if ((gameId && playerId) && gameStarted) {
    // Use DemoGame in demo mode, regular Game otherwise
    const GameComponent = demoMode ? DemoGame : Game;
    return (
      <GameComponent
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
        <h2>Lobby: {gameId}</h2>
        <div className={styles.section}>
          <h3>Players ({lobbyInfo.players.length} / {lobbyInfo.maxPlayers})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {lobbyInfo.players.map((p) => (
              <li key={p.id} style={{ fontWeight: p.id === playerId ? 'bold' : 'normal' }}>
                {p.name} {p.id === playerId ? '(You)' : ''}
              </li>
            ))}
          </ul>
          <p>Lives per player: <b>{lobbyInfo.lives}</b></p>
          <p>Share this lobby code with friends to join: <b>{gameId}</b></p>
          {isHost && (
            <button className={styles.button} onClick={handleStartGame} disabled={lobbyInfo.players.length < 2}>
              Start Game
            </button>
          )}
          <button className={styles.button} onClick={handleLeaveGame}>Leave Lobby</button>
          {isHost && lobbyInfo.players.length < 2 && (
            <p style={{ color: 'red', marginTop: 8 }}>At least 2 players are required to start.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Fodinha Card Game</h1>
      {isCheckingBackend && (
        <div style={{ 
          background: '#f3e5f5', 
          color: '#7b1fa2', 
          padding: '12px', 
          margin: '16px 0', 
          borderRadius: '8px',
          border: '1px solid #ce93d8',
          textAlign: 'center'
        }}>
          🔄 <strong>Connecting...</strong> - Checking server availability...
        </div>
      )}
      {demoMode && !isCheckingBackend && (
        <div style={{ 
          background: '#e3f2fd', 
          color: '#1976d2', 
          padding: '12px', 
          margin: '16px 0', 
          borderRadius: '8px',
          border: '1px solid #bbdefb',
          textAlign: 'center'
        }}>
          🎮 <strong>Demo Mode</strong> - This is a preview version. Try creating or joining a game to see the simulated gameplay!
        </div>
      )}
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      <div className={styles.section}>
        <h2>Join or Create a Game</h2>
        <div className={styles.inputGroup}>
          <input
            type="text"
            placeholder="Your Name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            className={styles.input}
          />
        </div>
        <div className={styles.livesSelection}>
          <h3>Select Lives (for new game)</h3>
          <div className={styles.livesOptions}>
            <button 
              onClick={() => setLives(3)} 
              className={`${styles.livesButton} ${lives === 3 ? styles.selected : ''}`}
            >
              3 Lives
            </button>
            <button 
              onClick={() => setLives(5)} 
              className={`${styles.livesButton} ${lives === 5 ? styles.selected : ''}`}
            >
              5 Lives
            </button>
            <button 
              onClick={() => setLives(7)} 
              className={`${styles.livesButton} ${lives === 7 ? styles.selected : ''}`}
            >
              7 Lives
            </button>
          </div>
        </div>
        <div className={styles.inputGroup}>
          <button 
            onClick={createGame} 
            disabled={!playerName.trim() || isCheckingBackend}
            className={styles.button}
          >
            {isCheckingBackend ? 'Connecting...' : 'Create New Game'}
          </button>
        </div>
        <div className={styles.inputGroup}>
          <input
            type="text"
            placeholder="Game Code to Join"
            value={joinGameId}
            onChange={(e) => setJoinGameId(e.target.value.toUpperCase())}
            className={styles.input}
            disabled={isCheckingBackend}
          />
          <button 
            onClick={() => joinGame(joinGameId)} 
            disabled={!playerName.trim() || !joinGameId.trim() || isCheckingBackend}
            className={styles.button}
          >
            {isCheckingBackend ? 'Connecting...' : 'Join Game'}
          </button>
        </div>
      </div>
    </div>
  );
} 