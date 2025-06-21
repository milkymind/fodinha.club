import { useState, useEffect } from 'react';

export interface GameState {
  players: number[];
  player_names: { [key: number]: string };
  vidas: { [key: number]: number };
  estado: string;
  carta_meio?: string;
  manilha?: string;
  maos?: { [key: number]: string[] };
  mesa?: any[];
  eliminados?: number[];
  ordem_jogada?: number[];
  current_player_idx?: number;
  multiplicador?: number;
}

export function useGameState(gameId: string, playerId: number) {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');

  useEffect(() => {
    // TODO: Implement WebSocket connection and game state management
    console.log('useGameState hook - to be implemented', { gameId, playerId });
    
    // Temporary mock state for development
    setGameState({
      players: [playerId],
      player_names: { [playerId]: 'You' },
      vidas: { [playerId]: 3 },
      estado: 'waiting',
    });
    setConnectionStatus('connected');
  }, [gameId, playerId]);

  return { gameState, connectionStatus };
} 