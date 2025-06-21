import { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { SocketContext } from '../../../contexts/SocketContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import styles from '../../../styles/Game.module.css';
import homeStyles from '../../../styles/Home.module.css';
import HeaderLogo from '../../../components/HeaderLogo';
import { 
  getCardColorClass, 
  getSuitClass, 
  formatCard, 
  getCardValue, 
  getCardStrength,
  sortCardsByStrength 
} from './utils/cardLogic';
import { PlayerHand } from './PlayerHand';
import { BettingPanel } from './BettingPanel';
import { GameBoard } from './GameBoard';
import { PlayerList } from './PlayerList';

interface GameProps {
  gameId: string;
  playerId: number;
  onLeaveGame: () => void;
  onReturnToLobby?: () => void;
}

interface GameState {
  players: number[];
  player_names: { [key: number]: string };
  vidas: { [key: number]: number };
  estado: string;
  carta_meio?: string;
  manilha?: string;
  maos?: { [key: number]: string[] };
  palpites?: { [key: number]: number };
  initial_lives: number;
  current_round?: number;
  current_hand?: number;
  current_player_idx?: number;
  ordem_jogada?: number[];
  multiplicador?: number;
  soma_palpites?: number;
  mesa?: [number, string][];
  vitorias?: { [key: number]: number };
  dealer?: number;
  first_player?: number;
  cartas?: number;
  eliminados?: number[];
  last_round_winner?: number;
  last_trick_winner?: number;
  round_over_timestamp?: number;
  tie_in_previous_round?: boolean;
  inactive_players?: number[];
  tie_resolved_by_tiebreaker?: boolean;
  winning_card_played_by?: number;
  cancelled_cards?: [number, string][];
  middle_card_workaround?: { used: boolean; card?: string };
  host_id?: number;
}

export default function Game({ gameId, playerId, onLeaveGame, onReturnToLobby }: GameProps) {
  const socket = useContext(SocketContext);
  const { t } = useLanguage();
  
  // Debug: Check if t function is working (removed to reduce console spam)
  // console.log('Translation test:', t('your_turn_bet'));
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gameStatus, setGameStatus] = useState<string>('');
  const [waitingMsg, setWaitingMsg] = useState<string>('');
  const [lastPlayedCard, setLastPlayedCard] = useState<{playerId: number, card: string} | null>(null);
  const [winnerMessage, setWinnerMessage] = useState<string | null>(null);
  const [prevRoundWinner, setPrevRoundWinner] = useState<number | null>(null);
  const [roundEndMessage, setRoundEndMessage] = useState<string | null>(null);
  const [prevRound, setPrevRound] = useState<number | null>(null);
  const [prevHand, setPrevHand] = useState<number | null>(null);
  const [lastActivityTime, setLastActivityTime] = useState<number>(Date.now());
  const [lastWinnerMessageTime, setLastWinnerMessageTime] = useState<number>(0);
  const [notificationType, setNotificationType] = useState<'turn' | 'waiting' | 'gameState' | 'nextHand' | ''>('');
  const [lastSocketActivity, setLastSocketActivity] = useState<number>(Date.now());
  const [roundTransitionActive, setRoundTransitionActive] = useState<boolean>(false);
  const [tieNotificationTimeout, setTieNotificationTimeout] = useState<NodeJS.Timeout | null>(null);
  const [lastPollingTime, setLastPollingTime] = useState<number>(Date.now());
  const [isProcessingGameState, setIsProcessingGameState] = useState<boolean>(false);
  const [isSubmittingBet, setIsSubmittingBet] = useState<boolean>(false);
  const [isPlayingCard, setIsPlayingCard] = useState<boolean>(false);
  const [clickedCardIndex, setClickedCardIndex] = useState<number | null>(null);
  const [lastActionTime, setLastActionTime] = useState<number>(0);
  const [pendingActions, setPendingActions] = useState<Set<string>>(new Set());
  const [socketReady, setSocketReady] = useState<boolean>(false);
  const [lastRequestTimestamps, setLastRequestTimestamps] = useState<Record<string, number>>({});
  const [reconnectAttempts, setReconnectAttempts] = useState<number>(0);
  const actionDebounceTimers = useRef<Record<string, NodeJS.Timeout>>({});
  const [stateVersion, setStateVersion] = useState<number>(0);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, any>>(new Map());
  const [syncInProgress, setSyncInProgress] = useState<boolean>(false);
  
  // Card sorting state
  const [isCardsSorted, setIsCardsSorted] = useState<boolean>(false);
  const [originalCardOrder, setOriginalCardOrder] = useState<string[]>([]);
  
  // Socket room join tracking
  const [hasJoinedRoom, setHasJoinedRoom] = useState<boolean>(false);
  
  // Use a ref to track if we're already attempting to reconnect
  const isReconnecting = useRef<boolean>(false);

  // ADD ERROR STATE MANAGEMENT
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [errorTimeout, setErrorTimeout] = useState<NodeJS.Timeout | null>(null);
  
  // Function to display errors in UI instead of browser alerts
  const showError = (message: string, duration: number = 5000) => {
    setErrorMessage(message);
    
    // Clear any existing timeout
    if (errorTimeout) {
      clearTimeout(errorTimeout);
    }
    
    // Set new timeout to clear error
    const timeout = setTimeout(() => {
      setErrorMessage('');
      setErrorTimeout(null);
    }, duration);
    
    setErrorTimeout(timeout);
  };

  // Clear error function
  const clearError = () => {
    setErrorMessage('');
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      setErrorTimeout(null);
    }
  };
  
  // Debounced action handler to prevent duplicate API calls
  const debounceAction = useCallback((actionKey: string, action: () => Promise<void>, delay: number = 500) => {
    // Clear any existing timer for this action
    if (actionDebounceTimers.current[actionKey]) {
      clearTimeout(actionDebounceTimers.current[actionKey]);
    }
    
    // Track when we last attempted this action
    const now = Date.now();
    const lastAttempt = lastRequestTimestamps[actionKey] || 0;
    
    // Use shorter delays for multi-card hands
    let adjustedDelay = delay;
    if (gameState?.cartas && gameState.cartas > 2) {
      // Reduce delays for hands with more cards
      adjustedDelay = Math.max(150, delay - (gameState.cartas - 2) * 75);
    }
    
    // If we just tried this action very recently, increase the debounce delay
    const timeGap = now - lastAttempt;
    if (timeGap < 800) {
      adjustedDelay = Math.min(800, adjustedDelay * 1.5);
    }
    
    // Set the last timestamp for this action
    setLastRequestTimestamps(prev => ({
      ...prev,
      [actionKey]: now
    }));
    
    // Set a new timer
    return new Promise<void>((resolve) => {
      actionDebounceTimers.current[actionKey] = setTimeout(async () => {
        try {
          await action();
          resolve();
        } catch (error) {
          console.error(`Action ${actionKey} failed:`, error);
          resolve();
        }
      }, adjustedDelay);
    });
  }, [lastRequestTimestamps, gameState?.cartas]);
  
  // Prevent auto-scrolling when component mounts
  useEffect(() => {
    // Prevent page from auto-scrolling to bottom
    if (typeof window !== 'undefined') {
      window.scrollTo(0, 0);
      // Also prevent any smooth scrolling behavior that might cause issues
      document.documentElement.style.scrollBehavior = 'auto';
      
      // Clean up on unmount
      return () => {
        document.documentElement.style.scrollBehavior = '';
      };
    }
  }, []); // Run only once on mount

  // Set up socket connections and listeners
  useEffect(() => {
    if (!socket) {
      console.log("Socket not available yet");
      return;
    }

    console.log("Setting up socket event listeners for game", gameId);

    // Join the game room with retry logic - only if we haven't joined yet
    const joinGameRoom = async () => {
      if (hasJoinedRoom) {
        console.log("Already joined game room, skipping duplicate join");
        return;
      }
      
      try {
        console.log(`Joining game room ${gameId} as player ${playerId}`);
        socket.emit('join-game', {
          gameId,
          playerId,
          playerName: localStorage.getItem(`player_name_${playerId}`) || `Player ${playerId}`,
          requestImmediate: true // Flag to request immediate state update
        });
        
        setHasJoinedRoom(true); // Mark as joined
        
        // Set socket as ready immediately for faster response
        setSocketReady(true);
        
        // Also immediately request the latest game state to reduce delays
        setTimeout(() => {
          if (socket.connected) {
            socket.emit('request-game-state', { gameId, playerId });
            console.log('Requested immediate game state update');
          }
        }, 50); // Very short delay
      } catch (error) {
        console.error("Error joining game room:", error);
        setHasJoinedRoom(false); // Reset flag on error
      }
    };
    
    // Only join if socket is connected and we haven't joined yet
    if (socket.connected && !hasJoinedRoom) {
      joinGameRoom();
    }

    const onConnect = () => {
      console.log("Socket connected to server");
      setLastSocketActivity(Date.now());
      setReconnectAttempts(0);
      setSocketReady(true);
      
      // Rejoin room if we were previously in one
      if (!hasJoinedRoom) {
        joinGameRoom();
      }
    };

    const onDisconnect = (reason: string) => {
      console.log("Socket disconnected:", reason);
      setSocketReady(false);
      setHasJoinedRoom(false); // Reset room join status
      
      // Only attempt manual reconnection for certain reasons
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        console.log("Manual reconnection may be needed");
      }
    };

    const onConnectError = (error: Error) => {
      console.error("Socket connection error:", error);
      setSocketReady(false);
      setReconnectAttempts(prev => prev + 1);
      
      // If we've tried many times, suggest manual refresh
      if (reconnectAttempts > 5) {
        console.warn("Multiple connection failures. Consider manual refresh.");
      }
    };

    const onHeartbeat = (data: { timestamp: number }) => {
      setLastSocketActivity(data.timestamp);
    };

    const onReconnect = (attemptNumber: number) => {
      console.log(`Socket reconnected after ${attemptNumber} attempts`);
      setLastSocketActivity(Date.now());
      setReconnectAttempts(0);
      setSocketReady(true);
    };

    const onReconnectError = (error: Error) => {
      console.error("Socket reconnection error:", error);
      setReconnectAttempts(prev => prev + 1);
    };

    const onReconnectFailed = () => {
      console.error("Socket reconnection failed completely");
      setSocketReady(false);
    };

    const onManualReconnectSuccess = () => {
      console.log("Manual reconnection successful");
      setSocketReady(true);
      setReconnectAttempts(0);
    };

    const onGameStateUpdate = (data: any) => {
      if (!data || !data.gameState) {
        console.warn('Received invalid game state update:', data);
        return;
      }
      
      setLastSocketActivity(Date.now());
      
      // Version checking to prevent processing old states
      const newVersion = data.version || Date.now();
      if (newVersion <= stateVersion && !data.immediate && !data.source) {
        console.log('Ignoring outdated state update:', newVersion, 'current:', stateVersion);
        return;
      }
      
      setStateVersion(newVersion);
      
      // Process the game state update
      const newGameState = data.gameState;
      
      console.log('Processing game state update:', {
        estado: newGameState.estado,
        round: newGameState.current_round,
        hand: newGameState.current_hand,
        currentPlayer: newGameState.current_player_idx,
        ordemJogada: newGameState.ordem_jogada,
        currentPlayerInOrder: newGameState.ordem_jogada?.[newGameState.current_player_idx],
        version: newVersion,
        source: data.source || 'unknown'
      });
      
      // Clear any optimistic updates that are now confirmed
      if (optimisticUpdates.size > 0) {
        setOptimisticUpdates(new Map());
      }
      
      // Handle special state transitions
      if (gameState && newGameState) {
        // Detect round transitions
        if (gameState.current_round !== newGameState.current_round && 
            newGameState.current_round && gameState.current_round) {
          if (newGameState.current_round > gameState.current_round) {
            console.log('Round advanced:', gameState.current_round, '->', newGameState.current_round);
            setRoundTransitionActive(true);
            setTimeout(() => setRoundTransitionActive(false), 3000);
          }
        }
        
        // Detect hand transitions
        if (gameState.current_hand !== newGameState.current_hand &&
            typeof newGameState.current_hand === 'number' && 
            typeof gameState.current_hand === 'number') {
          if (newGameState.current_hand > gameState.current_hand) {
            console.log('Hand advanced:', gameState.current_hand, '->', newGameState.current_hand);
          }
        }
        
        // Detect when cards are played
        const oldMesa = gameState.mesa || [];
        const newMesa = newGameState.mesa || [];
        if (newMesa.length > oldMesa.length) {
          const lastPlayed = newMesa[newMesa.length - 1];
          if (lastPlayed && Array.isArray(lastPlayed) && lastPlayed.length >= 2) {
            const [playerId, card] = lastPlayed;
            setLastPlayedCard({ playerId, card });
            console.log('Card played:', { playerId, card });
            
            // Clear the last played card after a delay
            setTimeout(() => {
              setLastPlayedCard(null);
            }, 2000);
          }
        }
        
        // Detect winner announcements
        if (gameState.estado !== 'terminado' && newGameState.estado === 'terminado') {
          // Game has ended
          const winners = newGameState.players.filter((id: number) => !newGameState.eliminados?.includes(id));
          if (winners.length === 1) {
            const winnerName = newGameState.player_names[winners[0]] || `Player ${winners[0]}`;
            setWinnerMessage(t('player_wins_game', { name: winnerName }));
            setLastWinnerMessageTime(Date.now());
          } else if (winners.length > 1) {
            setWinnerMessage(t('multiple_winners'));
            setLastWinnerMessageTime(Date.now());
          }
        }
        
        // Detect round winner
        if (newGameState.last_round_winner && 
            newGameState.last_round_winner !== gameState.last_round_winner) {
          const winnerName = newGameState.player_names[newGameState.last_round_winner] || 
                           `Player ${newGameState.last_round_winner}`;
          setPrevRoundWinner(newGameState.last_round_winner);
          
          // Show round winner message
          if (newGameState.multiplicador && newGameState.multiplicador > 1) {
            setRoundEndMessage(t('player_wins_round_multiplier', { 
              name: winnerName, 
              multiplier: newGameState.multiplicador 
            }));
          } else {
            setRoundEndMessage(t('player_wins_round', { name: winnerName }));
          }
          
          // Clear round end message after delay
          setTimeout(() => {
            setRoundEndMessage(null);
          }, 4000);
        }
        
        // Handle tie situations
        if (newGameState.multiplicador && newGameState.multiplicador > 1 && 
            (!gameState.multiplicador || gameState.multiplicador <= 1)) {
          // New tie detected
          const isHost = playerId === 1; // Assuming player 1 is always the host
          handleTieNotification(newGameState.multiplicador, isHost);
        }
      }
      
      // Update the game state
      setGameState(newGameState);
      
      // Update game status based on new state
      updateGameStatus(newGameState);
    };

    // Register all event listeners
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('heartbeat', onHeartbeat);
    socket.on('reconnect', onReconnect);
    socket.on('reconnect_error', onReconnectError);
    socket.on('reconnect_failed', onReconnectFailed);
    socket.on('manual-reconnect-success', onManualReconnectSuccess);
    socket.on('game-state-update', onGameStateUpdate);

    // Add immediate feedback handlers for better responsiveness
    socket.on('action-received', (data) => {
      console.log('Server acknowledged action:', data);
      // Action was received, clear any loading states if needed
    });

    socket.on('action-error', (data) => {
      console.error('Server rejected action:', data);
      showError(data.error || 'Action failed. Please try again.');
      
      // Clear any loading states
      setIsSubmittingBet(false);
      setIsPlayingCard(false);
      setClickedCardIndex(null);
    });

    // Handle optimistic updates for immediate UI feedback
    socket.on('optimistic-update', (data) => {
      console.log('Received optimistic update:', data);
      // Could add immediate UI feedback here if needed
    });

    // Handle lobby return events for instant response
    socket.on('lobby-returned', (data) => {
      try {
        console.log('Received lobby-returned event:', data);
        setLastSocketActivity(Date.now());
        
        // Call the onReturnToLobby callback to return all players to lobby instantly
        if (onReturnToLobby) {
          console.log('Returning to lobby via socket event');
          onReturnToLobby();
        } else {
          console.warn('onReturnToLobby callback not available');
        }
      } catch (error) {
        console.error("Error handling lobby-returned event", error);
      }
    });

    // DISABLED: Don't fetch on every socket event to prevent API spam
    // if (socket.connected) {
    //   fetchInitialGameState();
    // }

    // Cleanup function
    return () => {
      console.log("Cleaning up socket event listeners");
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('heartbeat', onHeartbeat);
      socket.off('reconnect', onReconnect);
      socket.off('reconnect_error', onReconnectError);
      socket.off('reconnect_failed', onReconnectFailed);
      socket.off('manual-reconnect-success', onManualReconnectSuccess);
      socket.off('game-state-update', onGameStateUpdate);
      socket.off('action-received');
      socket.off('action-error');
      socket.off('optimistic-update');
      socket.off('lobby-returned');
      
      // Clear any pending timers
      Object.values(actionDebounceTimers.current).forEach(timer => {
        if (timer) clearTimeout(timer);
      });
      
      if (tieNotificationTimeout) {
        clearTimeout(tieNotificationTimeout);
      }
      
      if (errorTimeout) {
        clearTimeout(errorTimeout);
      }
    };
  }, [socket, gameId, playerId]); // FIXED: Removed variables that change frequently to prevent infinite re-renders

  // Fetch initial game state ONLY ONCE when component mounts
  useEffect(() => {
    fetchInitialGameState();
  }, [gameId]); // Only run when gameId changes

  // Fetch initial game state
  const fetchInitialGameState = async () => {
    if (syncInProgress) {
      console.log('Sync already in progress, skipping fetch');
      return;
    }
    
    try {
      setSyncInProgress(true);
      const response = await fetch(`/api/game-state/${gameId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.game_state) {
          console.log('Fetched initial game state:', data.game_state.estado);
          setGameState(data.game_state);
          updateGameStatus(data.game_state);
          
          // Update version if provided
          if (data.version) {
            setStateVersion(data.version);
          }
        }
      } else {
        console.error('Failed to fetch initial game state:', response.status);
      }
    } catch (error) {
      console.error('Error fetching initial game state:', error);
    } finally {
      setSyncInProgress(false);
    }
  };

  // Polling fallback for when socket is not working properly
  const pollGameState = async () => {
    // Only poll if socket seems unreliable or we haven't received updates recently
    const timeSinceLastActivity = Date.now() - lastSocketActivity;
    const shouldPoll = !socketReady || timeSinceLastActivity > 5000;
    
    if (!shouldPoll) {
      return;
    }
    
    if (syncInProgress) {
      console.log('Sync already in progress, skipping poll');
      return;
    }
    
    try {
      setSyncInProgress(true);
      const response = await fetch(`/api/game-state/${gameId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.game_state) {
          const newVersion = data.version || 0;
          
          // Only update if this is newer than what we have
          if (newVersion > stateVersion) {
            console.log('Polling found newer state:', newVersion, 'vs', stateVersion);
            setGameState(data.game_state);
            updateGameStatus(data.game_state);
            setStateVersion(newVersion);
          }
        }
      }
    } catch (error) {
      console.error('Error polling game state:', error);
    } finally {
      setSyncInProgress(false);
      setLastPollingTime(Date.now());
    }
  };

  // DISABLED POLLING - Using WebSocket only
  // useEffect(() => {
  //   // DISABLED: Polling disabled completely to prevent API spam
  // }, []);

  // Handle tie notification with appropriate delay and cleanup
  const handleTieNotification = (multiplicador: number, isHost: boolean) => {
    // Clear any existing timeout
    if (tieNotificationTimeout) {
      clearTimeout(tieNotificationTimeout);
    }
    
    // Set immediate notification
    setNotificationType('gameState');
    
    // Set timeout for clearing the notification
    const timeout = setTimeout(() => {
      setNotificationType('');
      setTieNotificationTimeout(null);
    }, 5000);
    
    setTieNotificationTimeout(timeout);
  };

  // Enhanced activity tracking
  useEffect(() => {
    const handleUserActivity = () => {
      setLastActivityTime(Date.now());
    };

    // Listen to various user activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // Set up activity check interval
    const activityInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceActivity = now - lastActivityTime;
      const timeSinceSocket = now - lastSocketActivity;

      // DISABLED: No automatic refresh to prevent API spam
      // if (timeSinceActivity > 30000 && timeSinceSocket > 10000 && socketReady) {
      //   console.log('Refreshing due to inactivity and stale socket');
      //   fetchInitialGameState();
      // }
    }, 15000);

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
      clearInterval(activityInterval);
    };
  }, [lastActivityTime, lastSocketActivity, socketReady]);

  // Update game status and waiting messages
  const updateGameStatus = (state: GameState) => {
    if (!state) return;

    // Clear previous messages
    setGameStatus('');
    setWaitingMsg('');
    setNotificationType('');

    const isMyTurn = state.ordem_jogada?.[state.current_player_idx || 0] === playerId;
    const currentPlayerName = state.player_names[state.ordem_jogada?.[state.current_player_idx || 0] || 0] || '';

    // Determine message based on game state
    switch (state.estado) {
      case 'aguardando':
        if (playerId === 1) {
          setGameStatus(t('waiting_to_start'));
          setNotificationType('waiting');
        } else {
          setWaitingMsg(t('waiting_for_host'));
          setNotificationType('waiting');
        }
        break;

      case 'apostas':
        if (isMyTurn) {
          setGameStatus(t('your_turn_bet'));
          setNotificationType('turn');
        } else {
          setWaitingMsg(t('waiting_for_bet', { player: currentPlayerName }));
          setNotificationType('waiting');
        }
        break;

      case 'jogando':
        if (isMyTurn) {
          setGameStatus(t('your_turn_play'));
          setNotificationType('turn');
        } else {
          setWaitingMsg(t('waiting_for_play', { player: currentPlayerName }));
          setNotificationType('waiting');
        }
        break;

      case 'round_over':
        setGameStatus(t('round_completed'));
        setNotificationType('nextHand');
        
        // If we're in round_over state and it's not the last round, 
        // set up a fallback to refresh state after 3 seconds in case the automatic transition doesn't work
        if (state.current_round && state.cartas && state.current_round < state.cartas) {
          setTimeout(() => {
            console.log('Round_over fallback: refreshing game state');
            fetchInitialGameState();
          }, 3000);
        }
        break;

      case 'hand_over':
        setGameStatus(t('hand_completed'));
        setNotificationType('nextHand');
        break;

      case 'terminado':
        setGameStatus(t('game_finished'));
        setNotificationType('gameState');
        break;

      default:
        console.warn('Unknown game state:', state.estado, 'Full state:', state);
        setGameStatus(t('unknown_state'));
        setNotificationType('gameState');
    }
  };

  // Check if it's a one-card hand
  const isOneCardHand = gameState?.cartas === 1;

  // Start a new round (host only)
  const startRound = async () => {
    if (!socketReady) {
      console.warn('Socket not ready, cannot start round');
      return;
    }
    
    const actionKey = `start-round-${gameId}`;
    
    await debounceAction(actionKey, async () => {
      try {
        console.log('Starting round for game:', gameId);
        const response = await fetch(`/api/start-round/${gameId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ player_id: playerId }),
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Round started successfully:', data);
        } else {
          const errorData = await response.json();
          console.error('Failed to start round:', errorData);
        }
      } catch (error) {
        console.error('Error starting round:', error);
      }
    });
  };

  // Make a bet
  const makeBet = async (betValue: number) => {
    if (isSubmittingBet) {
      console.log('Already submitting bet, ignoring duplicate request');
      return;
    }
    
    // Clear any existing errors
    clearError();
    setIsSubmittingBet(true);
    
    try {
      console.log('Making bet:', betValue, 'for player:', playerId);
      
      const response = await fetch(`/api/make-bet/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          player_id: playerId, 
          bet: betValue 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Bet made successfully:', data);
        
        // Set up a fallback to refresh state if socket doesn't update within 2 seconds
        const fallbackTimeout = setTimeout(() => {
          console.log('Socket update not received, forcing state refresh');
          fetchInitialGameState();
        }, 2000);
        
        // Clear the fallback if we receive a socket update
        const originalStateVersion = stateVersion;
        const checkForUpdate = setInterval(() => {
          if (stateVersion > originalStateVersion) {
            clearTimeout(fallbackTimeout);
            clearInterval(checkForUpdate);
          }
        }, 100);
        
        // Clean up the check after 3 seconds
        setTimeout(() => {
          clearInterval(checkForUpdate);
        }, 3000);
        
      } else {
        const errorData = await response.json();
        const errorMsg = errorData.error || 'Unknown error';
        console.error('Failed to make bet:', errorMsg);
        showError(`Failed to make bet: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error making bet:', error);
      showError('Error making bet. Please check your connection and try again.');
    } finally {
      setIsSubmittingBet(false);
    }
  };

  // Play a card
  const playCard = async (cardIndex: number) => {
    if (isPlayingCard) {
      console.log('Already playing card, ignoring duplicate request');
      return;
    }
    
    // Clear any existing errors
    clearError();
    setIsPlayingCard(true);
    setClickedCardIndex(cardIndex);
    
    try {
      console.log('Playing card at index:', cardIndex, 'for player:', playerId);
      
      const response = await fetch(`/api/play-card/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          player_id: playerId, 
          card_index: cardIndex 
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Card played successfully:', data);
        // The UI will update via socket event, no need to manually update here
      } else {
        const errorData = await response.json();
        const errorMsg = errorData.error || 'Unknown error';
        console.error('Failed to play card:', errorMsg);
        showError(`Failed to play card: ${errorMsg}`);
      }
    } catch (error) {
      console.error('Error playing card:', error);
      showError('Error playing card. Please check your connection and try again.');
    } finally {
      setIsPlayingCard(false);
      setClickedCardIndex(null);
    }
  };

  // Check if it's the current player's turn
  const isPlayerTurn = () => {
    if (!gameState?.ordem_jogada || gameState.current_player_idx === undefined) {
      console.log('isPlayerTurn: No ordem_jogada or current_player_idx');
      return false;
    }
    
    const currentPlayer = gameState.ordem_jogada[gameState.current_player_idx];
    const isMyTurn = currentPlayer === playerId;
    
    if (gameState.estado === 'apostas') {
      console.log('Turn check:', {
        playerId,
        currentPlayerIdx: gameState.current_player_idx,
        ordemJogada: gameState.ordem_jogada,
        currentPlayer,
        isMyTurn,
        myBetPlaced: gameState.palpites?.[playerId] !== undefined
      });
    }
    
    return isMyTurn;
  };

  // Handle new game creation (return to lobby)
  const handleNewGame = async () => {
    if (!gameId || !playerId) return;
    
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
        if (onReturnToLobby) {
          onReturnToLobby();
        }
      } else {
        console.error('Failed to return to lobby:', data.error);
      }
    } catch (error) {
      console.error('Error returning to lobby:', error);
    }
  };

  // Check if current player is the host
  const isHost = () => {
    // Primary check: use host_id if available
    if (gameState?.host_id !== undefined) {
      return gameState.host_id === playerId;
    }
    
    // Fallback: assume player 1 is the host (typical convention)
    return playerId === 1;
  };

  const getNotificationClass = () => {
    switch (notificationType) {
      case 'turn': return styles.turnNotification;
      case 'waiting': return styles.waitingNotification;
      case 'gameState': return styles.gameStateNotification;
      case 'nextHand': return styles.nextHandNotification;
      default: return '';
    }
  };

  // Loading state
  if (!gameState) {
    return (
      <div className={styles.gameContainer}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '50vh',
          color: 'white'
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎮</div>
          <h2>Loading game...</h2>
          <p style={{ color: '#ccc' }}>Connecting to game {gameId}</p>
          
          {/* Connection status indicator */}
          <div style={{ 
            marginTop: '1rem',
            padding: '0.5rem 1rem',
            borderRadius: '20px',
            backgroundColor: socketReady ? '#065f46' : '#7f1d1d',
            color: 'white',
            fontSize: '0.9rem'
          }}>
            {socketReady ? '🟢 Connected' : '🔴 Connecting...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.gameContainer} onClick={() => setLastActivityTime(Date.now())}>
      <div className={styles.header}>
        <h2>{t('game_room', { id: gameId })}</h2>
        <div className={styles.gameInfo}>
          {gameState?.current_hand !== undefined && gameState.current_hand >= 0 && (
            <p className={styles.handInfo}>{t('hand', { number: gameState.current_hand + 1 })}</p>
          )}
          {gameState?.current_round !== undefined && gameState.current_round > 0 && gameState?.cartas !== undefined && gameState.cartas > 0 && (
            <p className={styles.roundInfo}>{t('round', { current: gameState.current_round, total: gameState.cartas })}</p>
          )}
          {gameState?.multiplicador && gameState.multiplicador > 1 && (
            <p className={styles.multiplier}>
              {t('multiplier', { value: gameState.multiplicador })}
            </p>
          )}
        </div>
        <button onClick={onLeaveGame} className={styles.leaveButton}>
          {t('leave_game')}
        </button>
      </div>

      {/* Error Message Display */}
      {errorMessage && (
        <div className={styles.errorContainer}>
          <div className={styles.errorMessage}>
            <span>{errorMessage}</span>
            <button onClick={clearError} className={styles.errorCloseButton}>
              ×
            </button>
          </div>
        </div>
      )}

      {/* PlayerList Component */}
      <PlayerList 
        players={gameState?.players || []}
        playerNames={gameState?.player_names || {}}
        lives={gameState?.vidas || {}}
        currentPlayerId={playerId}
        gameState={gameState?.estado || ''}
        currentPlayerIdx={gameState?.current_player_idx}
        ordemJogada={gameState?.ordem_jogada}
        lastRoundWinner={gameState?.last_round_winner}
        lastTrickWinner={gameState?.last_trick_winner}
        dealer={gameState?.dealer}
        inactivePlayers={gameState?.inactive_players}
        palpites={gameState?.palpites}
        vitorias={gameState?.vitorias}
      />

      {/* GameBoard Component */}
      <GameBoard 
        cartaMeio={gameState?.carta_meio}
        manilha={gameState?.manilha}
        mesa={gameState?.mesa}
        playerNames={gameState?.player_names || {}}
        playerId={playerId}
        gameState={gameState?.estado || ''}
        isOneCardHand={isOneCardHand}
        allHands={gameState?.maos}
        players={gameState?.players || []}
        lastPlayedCard={lastPlayedCard}
        winningCardPlayedBy={gameState?.winning_card_played_by}
        currentRound={gameState?.current_round}
        totalCards={gameState?.cartas}
      />

      {/* Consolidated notification area - prevent overlapping notifications */}
      {(gameStatus || winnerMessage || roundEndMessage) && (
        <div className={styles.notificationArea}>
          {gameStatus && (
            <div className={`${styles.gameStatus} ${getNotificationClass()}`}>
              <p>{gameStatus}</p>
            </div>
          )}
          
          {winnerMessage && (
            <div className={`${styles.winnerMessage} ${styles.gameStateNotification}`}>
              <p>{winnerMessage}</p>
            </div>
          )}
          
          {roundEndMessage && (
            <div className={`${styles.roundEndMessage} ${styles.gameStateNotification}`}>
              <p>{roundEndMessage}</p>
            </div>
          )}
        </div>
      )}

      {waitingMsg && (
        <div className={styles.waitingMsg}>
          <p>{waitingMsg}</p>
        </div>
      )}

      {gameState?.estado === 'aguardando' && playerId === 1 && (
        <div className={styles.actionContainer}>
          <button 
            onClick={startRound} 
            className={styles.actionButton}
          >
            {t('start_game')}
          </button>
        </div>
      )}

      {/* Betting Panel Component */}
      <BettingPanel 
        gameState={gameState?.estado || ''}
        isMyTurn={isPlayerTurn()}
        maxBet={gameState?.cartas || 1}
        currentTotal={gameState?.soma_palpites || 0}
        isLastPlayerToBet={(() => {
          const currentPlayerIdx = gameState?.current_player_idx || 0;
          const totalPlayersInBettingRound = gameState?.ordem_jogada?.length || 0;
          return currentPlayerIdx === (totalPlayersInBettingRound - 1);
        })()}
        onMakeBet={makeBet}
        isSubmittingBet={isSubmittingBet}
      />

      {/* Player Hand Component */}
      <PlayerHand 
        cards={gameState?.maos?.[playerId] || []}
        manilha={gameState?.manilha}
        gameState={gameState?.estado || ''}
        isMyTurn={isPlayerTurn()}
        isPlayingCard={isPlayingCard}
        isOneCardHand={isOneCardHand}
        clickedCardIndex={clickedCardIndex}
        onPlayCard={playCard}
      />

      {gameState?.estado === 'terminado' && (
        <div className={styles.gameOver}>
          <h2>{t('game_over')}</h2>
          <div className={styles.finalResults}>
            <h3>{t('final_results')}</h3>
            {gameState.players.map(id => (
              <div 
                key={id}
                className={`${styles.resultRow} ${gameState.eliminados?.includes(id) ? styles.eliminated : styles.winner}`}
              >
                <span className={styles.resultName}>
                  {gameState.player_names[id]}: 
                </span>
                <span className={styles.resultLives}>
                  {gameState.vidas[id] <= 0 ? t('eliminated') : `${gameState.vidas[id]} ${t('lives')}`}
                </span>
                {!gameState.eliminados?.includes(id) && (
                  <span className={styles.winnerBadge}> 🏆 {t('winner')}</span>
                )}
              </div>
            ))}
          </div>
          <div className={styles.gameOverButtons}>
            {isHost() && onReturnToLobby && (
              <button className={styles.actionButton} onClick={onReturnToLobby}>
                {t('new_game')}
              </button>
            )}
            <button className={styles.leaveButton} onClick={onLeaveGame}>
              {t('leave_game')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 