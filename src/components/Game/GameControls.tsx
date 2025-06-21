import React from 'react';

interface GameControlsProps {
  isHost: boolean;
  gameState: any;
  onStartRound: () => void;
  onLeaveGame: () => void;
  onReturnToLobby?: () => void;
}

export const GameControls: React.FC<GameControlsProps> = ({
  isHost,
  gameState,
  onStartRound,
  onLeaveGame,
  onReturnToLobby
}) => {
  return (
    <div>
      <h3>Game Controls - To be implemented</h3>
      <p>Is host: {isHost ? 'Yes' : 'No'}</p>
      <button onClick={onLeaveGame}>Leave Game</button>
    </div>
  );
}; 