import React from 'react';

interface GameStatusProps {
  gameState: any;
  playerId: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export const GameStatus: React.FC<GameStatusProps> = ({
  gameState,
  playerId,
  connectionStatus
}) => {
  return (
    <div>
      <h3>Game Status - To be implemented</h3>
      <p>Connection: {connectionStatus}</p>
      <p>Game state: {gameState?.estado}</p>
    </div>
  );
}; 