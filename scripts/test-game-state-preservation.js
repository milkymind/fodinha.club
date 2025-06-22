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

async function testGameStatePreservation() {
  let gameId = null;

  try {
    console.log('\n🎮 Test: Game State Preservation During Transitions');
    console.log('====================================================');
    
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

    // Step 2: Add player 2
    console.log('\n2. Player 2 joining...');
    const joinResponse2 = await makeRequest(`/api/join-game/${gameId}`, 'POST', {
      player_name: 'Player Two'
    });
    
    if (joinResponse2.status !== 200) {
      throw new Error(`Failed to add player 2: ${joinResponse2.status}`);
    }
    
    console.log(`   ✅ Player 2 joined`);

    // Step 3: Start the game
    console.log('\n3. Starting game...');
    const startResponse = await makeRequest(`/api/start-game/${gameId}`, 'POST');
    
    if (startResponse.status !== 200) {
      throw new Error(`Failed to start game: ${startResponse.status} - ${JSON.stringify(startResponse.data)}`);
    }
    
    console.log('   ✅ Game started successfully');

    // Step 4: Verify game state exists immediately after start
    console.log('\n4. Verifying game state exists...');
    await sleep(500); // Brief delay for state to save
    
    const gameStateResponse1 = await makeRequest(`/api/game-state/${gameId}`);
    
    if (gameStateResponse1.status !== 200) {
      throw new Error(`Game state not found after start: ${gameStateResponse1.status} - ${JSON.stringify(gameStateResponse1.data)}`);
    }
    
    console.log('   ✅ Game state exists after start');
    console.log(`   Estado: ${gameStateResponse1.data.estado}`);
    console.log(`   Players: ${gameStateResponse1.data.players?.join(', ')}`);

    // Step 5: Simulate the problematic transition (leave and rejoin)
    console.log('\n5. Simulating lobby-to-game transition...');
    
    // Both players "leave" (simulating page transition)
    await makeRequest(`/api/leave-game/${gameId}`, 'POST', { player_id: 1 });
    await makeRequest(`/api/leave-game/${gameId}`, 'POST', { player_id: 2 });
    
    console.log('   Players left (simulating page transition)');
    
    // Brief delay
    await sleep(200);
    
    // Check if game state still exists
    const gameStateResponse2 = await makeRequest(`/api/game-state/${gameId}`);
    
    if (gameStateResponse2.status !== 200) {
      console.log(`   ❌ Game state lost during transition: ${gameStateResponse2.status}`);
      console.log(`   Response: ${JSON.stringify(gameStateResponse2.data)}`);
      
      // Check lobby info to see what happened
      const lobbyResponse = await makeRequest(`/api/lobby-info/${gameId}`);
      if (lobbyResponse.status === 200) {
        console.log(`   Lobby status: gameStarted=${lobbyResponse.data.lobby?.gameStarted}, hasGameState=${!!lobbyResponse.data.lobby?.gameState}`);
      }
      
      throw new Error('Game state was lost during transition');
    }
    
    console.log('   ✅ Game state preserved during transition');

    // Step 6: Players rejoin
    console.log('\n6. Players rejoining...');
    await makeRequest(`/api/join-game/${gameId}`, 'POST', { player_name: 'Host Player' });
    await makeRequest(`/api/join-game/${gameId}`, 'POST', { player_name: 'Player Two' });
    
    console.log('   ✅ Players rejoined');

    // Step 7: Final verification
    console.log('\n7. Final game state verification...');
    const gameStateResponse3 = await makeRequest(`/api/game-state/${gameId}`);
    
    if (gameStateResponse3.status !== 200) {
      throw new Error(`Game state lost after rejoin: ${gameStateResponse3.status}`);
    }
    
    console.log('   ✅ Game state still exists after rejoin');
    console.log(`   Estado: ${gameStateResponse3.data.estado}`);
    
    // Step 8: Test betting (the original issue)
    console.log('\n8. Testing betting functionality...');
    const betResponse = await makeRequest(`/api/make-bet/${gameId}`, 'POST', {
      player_id: gameStateResponse3.data.ordem_jogada[0], // First player in order
      bet: 0
    });
    
    if (betResponse.status !== 200) {
      console.log(`   ❌ Betting failed: ${betResponse.status} - ${JSON.stringify(betResponse.data)}`);
      throw new Error('Betting still not working');
    }
    
    console.log('   ✅ Betting works correctly');

    console.log('\n🎉 SUCCESS: Game state preservation is working!');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
testGameStatePreservation().then(() => {
  console.log('\nTest completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 