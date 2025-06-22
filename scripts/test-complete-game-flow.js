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

async function testCompleteGameFlow() {
  let gameId = null;

  try {
    console.log('\n🎮 Complete Game Flow Test');
    console.log('===========================');
    
    // Step 1: Create lobby
    console.log('\n1. Creating lobby...');
    const createResponse = await makeRequest('/api/create-game', 'POST', {
      player_name: 'Host Player',
      lives: 3,
      startFrom: 'one'
    });
    
    if (createResponse.status !== 200) {
      throw new Error(`Failed to create game: ${createResponse.status}`);
    }
    
    gameId = createResponse.data.game_id;
    console.log(`   ✅ Lobby created: ${gameId}`);

    // Step 2: Player 2 joins
    console.log('\n2. Player 2 joining lobby...');
    const joinResponse = await makeRequest(`/api/join-game/${gameId}`, 'POST', {
      player_name: 'Player Two'
    });
    
    if (joinResponse.status !== 200) {
      throw new Error(`Failed to join game: ${joinResponse.status}`);
    }
    
    console.log(`   ✅ Player 2 joined (ID: ${joinResponse.data.player_id})`);

    // Step 3: Host starts game
    console.log('\n3. Host starting game...');
    const startResponse = await makeRequest(`/api/start-game/${gameId}`, 'POST');
    
    if (startResponse.status !== 200) {
      throw new Error(`Failed to start game: ${startResponse.status}`);
    }
    
    console.log('   ✅ Game started successfully');

    // Step 4: Simulate page transitions (the critical test)
    console.log('\n4. Simulating player page transitions...');
    await makeRequest(`/api/leave-game/${gameId}`, 'POST', { player_id: 1 });
    await makeRequest(`/api/leave-game/${gameId}`, 'POST', { player_id: 2 });
    console.log('   Players left (simulating lobby-to-game transition)');
    
    await sleep(300); // Brief delay
    
    await makeRequest(`/api/join-game/${gameId}`, 'POST', { player_name: 'Host Player' });
    await makeRequest(`/api/join-game/${gameId}`, 'POST', { player_name: 'Player Two' });
    console.log('   ✅ Players rejoined');

    // Step 5: Verify game state preserved
    console.log('\n5. Verifying game state...');
    const gameStateResponse = await makeRequest(`/api/game-state/${gameId}`);
    
    if (gameStateResponse.status !== 200) {
      throw new Error(`Game state lost: ${gameStateResponse.status}`);
    }
    
    const gameState = gameStateResponse.data.game_state;
    console.log(`   ✅ Game state preserved`);
    console.log(`   Estado: ${gameState.estado}`);
    console.log(`   Players: ${gameState.players.join(', ')}`);
    console.log(`   Betting order: ${gameState.ordem_jogada.join(', ')}`);
    console.log(`   Current player: ${gameState.ordem_jogada[gameState.current_player_idx]}`);

    // Step 6: First player bets
    console.log('\n6. First player betting...');
    const firstPlayer = gameState.ordem_jogada[gameState.current_player_idx];
    const bet1Response = await makeRequest(`/api/make-bet/${gameId}`, 'POST', {
      player_id: firstPlayer,
      bet: 0
    });
    
    if (bet1Response.status !== 200) {
      throw new Error(`First bet failed: ${bet1Response.status} - ${JSON.stringify(bet1Response.data)}`);
    }
    
    console.log(`   ✅ Player ${firstPlayer} bet 0`);
    console.log(`   Next player: ${bet1Response.data.game_state.ordem_jogada[bet1Response.data.game_state.current_player_idx]}`);

    // Step 7: Second player bets
    console.log('\n7. Second player betting...');
    const updatedState = bet1Response.data.game_state;
    const secondPlayer = updatedState.ordem_jogada[updatedState.current_player_idx];
    const bet2Response = await makeRequest(`/api/make-bet/${gameId}`, 'POST', {
      player_id: secondPlayer,
      bet: 0
    });
    
    if (bet2Response.status !== 200) {
      throw new Error(`Second bet failed: ${bet2Response.status} - ${JSON.stringify(bet2Response.data)}`);
    }
    
    console.log(`   ✅ Player ${secondPlayer} bet 0`);
    console.log(`   Game state: ${bet2Response.data.game_state.estado}`);

    // Step 8: Verify transition to playing phase
    console.log('\n8. Verifying game progression...');
    const finalState = bet2Response.data.game_state;
    
    if (finalState.estado !== 'jogando') {
      throw new Error(`Expected 'jogando' state, got '${finalState.estado}'`);
    }
    
    console.log(`   ✅ Successfully transitioned to playing phase`);
    console.log(`   Total bets: Player 1: ${finalState.palpites[1]}, Player 2: ${finalState.palpites[2]}`);
    console.log(`   Sum of bets: ${finalState.soma_palpites}`);

    console.log('\n🎉 SUCCESS: Complete game flow working perfectly!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Lobby creation');
    console.log('   ✅ Player joining');
    console.log('   ✅ Game starting');
    console.log('   ✅ Page transitions (lobby → game)');
    console.log('   ✅ Game state preservation');
    console.log('   ✅ First player betting');
    console.log('   ✅ Second player betting');
    console.log('   ✅ Betting phase completion');
    console.log('   ✅ Transition to playing phase');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    process.exit(1);
  }
}

// Run the test
testCompleteGameFlow().then(() => {
  console.log('\n🎮 All systems operational!');
  process.exit(0);
}).catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
}); 