type Lobby = {
  gameId: string;
  players: { id: number; name: string }[];
  maxPlayers: number;
  lives: number;
  gameStarted?: boolean;
  gameState?: any;
};

const lobbies: Record<string, Lobby> = {};

export function createLobby(gameId: string, playerName: string, lives: number): Lobby {
  const lobby: Lobby = {
    gameId,
    players: [{ id: 1, name: playerName }],
    maxPlayers: 10,
    lives,
    gameStarted: false,
    gameState: null,
  };
  lobbies[gameId] = lobby;
  return lobby;
}

export function joinLobby(gameId: string, playerName: string): { lobby?: Lobby; playerId?: number; error?: string } {
  const lobby = lobbies[gameId];
  if (!lobby) return { error: 'Lobby not found' };
  if (lobby.players.length >= lobby.maxPlayers) return { error: 'Lobby is full' };
  const playerId = lobby.players.length + 1;
  lobby.players.push({ id: playerId, name: playerName });
  return { lobby, playerId };
}

export function getLobby(gameId: string): Lobby | undefined {
  return lobbies[gameId];
}

export function setGameState(gameId: string, gameState: any) {
  const lobby = lobbies[gameId];
  if (lobby) {
    lobby.gameState = gameState;
  }
}

export function getGameState(gameId: string): any {
  const lobby = lobbies[gameId];
  return lobby?.gameState;
} 