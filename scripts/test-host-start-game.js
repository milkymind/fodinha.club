const { io } = require('socket.io-client');

const BASE_URL = 'http://localhost:3000';

async function makeRequest(endpoint, method = 'GET', body = null) {
  const url = `${BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  try {
    const response = await fetch(url, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    console.error(`Request failed: ${method} ${url}`, error);
    return { status: 500, data: { error: error.message } };
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createSocket(gameId, playerId, playerName) {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      timeout: 5000
    });

    socket.on('connect', () => {
      socket.gameId = gameId;
      socket.playerId = playerId;
      socket.playerName = playerName;
      
      // Join the game room
      socket.emit('join-game', {
        gameId,
        playerId,
        playerName
      });
      
      resolve(socket);
    });

    socket.on('connect_error', reject);
    
    setTimeout(() => reject(new Error('Socket connection timeout')), 5000);
  });
}

async function testHostStartGame() {
  let gameId = null;
  let hostSocket = null;
  let player2Socket = null;

  try {
    console.log('\n🎮 Test: Host Start Game Without Losing Connection');
    console.log('======================================================');
    
    // Step 1: Create a game
    console.log('\n1. Creating game...');
    const createResponse = await makeRequest('/api/create-game', 'POST', {
      player_name: 'Host Player',
      lives: 3,
      startFrom: 'one'
    });
    
    if (createResponse.status !== 200) {
      throw new Error(`Failed to create game: ${createResponse.status}`);
    }
    
    gameId = createResponse.data.game_id;
    console.log(`   ✅ Game created: ${gameId}`);

    // Step 2: Connect host socket
    console.log('\n2. Host connecting...');
    hostSocket = await createSocket(gameId, 1, 'Host Player');
    console.log('   ✅ Host socket connected');

    await sleep(1000);

    // Step 3: Add player 2
    console.log('\n3. Player 2 joining...');
    const joinResponse2 = await makeRequest(`/api/join-game/${gameId}`, 'POST', {
      player_name: 'Player Two'
    });
    
    if (joinResponse2.status !== 200) {
      throw new Error(`Failed to add player 2: ${joinResponse2.status}`);
    }
    
    const player2Id = joinResponse2.data.player_id;
    player2Socket = await createSocket(gameId, player2Id, 'Player Two');
    console.log(`   ✅ Player 2 joined: ${player2Id}`);

    await sleep(1000);

    // Step 4: Check lobby has 2 players
    console.log('\n4. Verifying lobby state with 2 players...');
    const lobbyCheck1 = await makeRequest(`/api/lobby-info/${gameId}`);
    
    if (lobbyCheck1.status === 200) {
      const playerCount = lobbyCheck1.data.players?.length || 0;
      console.log(`   Players in lobby: ${playerCount}`);
      
      if (playerCount !== 2) {
        throw new Error(`Expected 2 players, got ${playerCount}`);
      }
    }

    // Step 5: Host starts the game
    console.log('\n5. Host starting game...');
    const startResponse = await makeRequest(`/api/start-game/${gameId}`, 'POST', {
      player_id: 1
    });
    
    if (startResponse.status !== 200) {
      throw new Error(`Failed to start game: ${startResponse.status} - ${JSON.stringify(startResponse.data)}`);
    }
    
    console.log('   ✅ Game started successfully');

    await sleep(2000); // Give time for socket events to process

    // Step 6: Check that game state exists
    console.log('\n6. Verifying game state was created...');
    const gameStateResponse = await makeRequest(`/api/game-state/${gameId}`);
    
    if (gameStateResponse.status !== 200) {
      throw new Error(`Game state not found: ${gameStateResponse.status} - ${JSON.stringify(gameStateResponse.data)}`);
    }
    
    console.log('   ✅ Game state exists');
    console.log(`   Game estado: ${gameStateResponse.data.estado}`);
    console.log(`   Players: ${gameStateResponse.data.players?.join(', ')}`);
    console.log(`   Current player: ${gameStateResponse.data.ordem_jogada?.[gameStateResponse.data.current_player_idx]}`);

    // Step 7: Simulate host transitioning to game component
    console.log('\n7. Simulating host page transition (lobby to game)...');
    
    // This simulates what happens when the host's page changes from Home to Game component
    // The socket should stay connected and the host should maintain their status
    
    // Disconnect and reconnect host socket (simulating page transition)
    if (hostSocket) {
      hostSocket.disconnect();
      console.log('   Host socket disconnected (simulating page change)');
    }
    
    await sleep(500); // Brief delay like a real page transition
    
    // Reconnect as if the Game component just mounted
    hostSocket = await createSocket(gameId, 1, 'Host Player');
    console.log('   ✅ Host socket reconnected');

    await sleep(1000);

    // Step 8: Verify host can still access game state
    console.log('\n8. Verifying host still has access after transition...');
    const gameStateResponse2 = await makeRequest(`/api/game-state/${gameId}`);
    
    if (gameStateResponse2.status !== 200) {
      throw new Error(`Host lost access to game state: ${gameStateResponse2.status}`);
    }
    
    console.log('   ✅ Host still has access to game state');
    
    // Step 9: Check lobby info to see if host is still there
    console.log('\n9. Checking if host is still in lobby...');
    const lobbyCheck2 = await makeRequest(`/api/lobby-info/${gameId}`);
    
    if (lobbyCheck2.status === 200) {
      const players = lobbyCheck2.data.players || [];
      const hostPlayer = players.find(p => p.id === 1);
      
      if (!hostPlayer) {
        throw new Error('Host player missing from lobby after transition');
      }
      
      console.log('   ✅ Host player still in lobby');
      console.log(`   Players: ${players.map(p => `${p.id}:${p.name}`).join(', ')}`);
    }

    console.log('\n🎉 SUCCESS: Host can start game without losing connection!');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  } finally {
    // Cleanup
    if (hostSocket) {
      hostSocket.disconnect();
    }
    if (player2Socket) {
      player2Socket.disconnect();
    }
  }
}

// Run the test
testHostStartGame().then(() => {
  console.log('\nTest completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 