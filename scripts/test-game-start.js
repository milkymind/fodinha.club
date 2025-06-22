#!/usr/bin/env node

const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const GAME_ID = 'TEST' + Math.random().toString(36).substr(2, 4).toUpperCase();

console.log('🧪 Testing Game Start Race Conditions');
console.log(`Game ID: ${GAME_ID}`);
console.log(`Base URL: ${BASE_URL}\n`);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createLobby() {
  console.log('1. Creating lobby...');
  const response = await fetch(`${BASE_URL}/api/create-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_name: 'Test Player 1',
      lives: 3,
      startFrom: 'one'
    })
  });
  
  const data = await response.json();
  if (data.status === 'success') {
    console.log(`✅ Lobby created: ${data.game_id}`);
    return data.game_id;
  } else {
    throw new Error(`Failed to create lobby: ${data.error}`);
  }
}

async function joinGame(gameId, playerName) {
  console.log(`2. Adding ${playerName}...`);
  const response = await fetch(`${BASE_URL}/api/join-game/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_name: playerName })
  });
  
  const data = await response.json();
  if (data.status === 'success') {
    console.log(`✅ ${playerName} joined as Player ${data.player_id}`);
    return data.player_id;
  } else {
    throw new Error(`Failed to join game: ${data.error}`);
  }
}

async function startGame(gameId) {
  console.log('3. Starting game...');
  const response = await fetch(`${BASE_URL}/api/start-game/${gameId}`, {
    method: 'POST'
  });
  
  const data = await response.json();
  if (data.status === 'success') {
    console.log('✅ Game started successfully');
    return true;
  } else {
    throw new Error(`Failed to start game: ${data.error}`);
  }
}

async function checkLobbyState(gameId, expectedStarted) {
  const response = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=1`);
  const data = await response.json();
  
  if (data.status === 'success') {
    const actualStarted = data.lobby.gameStarted;
    const hasGameState = !!data.lobby.gameState;
    
    console.log(`   Lobby gameStarted: ${actualStarted}, hasGameState: ${hasGameState}`);
    
    if (actualStarted === expectedStarted) {
      return { success: true, lobby: data.lobby };
    } else {
      return { 
        success: false, 
        expected: expectedStarted, 
        actual: actualStarted,
        lobby: data.lobby 
      };
    }
  } else {
    throw new Error(`Failed to check lobby: ${data.error}`);
  }
}

async function checkGameState(gameId) {
  const response = await fetch(`${BASE_URL}/api/game-state/${gameId}`);
  
  if (response.ok) {
    const data = await response.json();
    return { found: true, gameState: data.game_state };
  } else if (response.status === 404) {
    const errorData = await response.json();
    return { found: false, error: errorData.error };
  } else {
    throw new Error(`Unexpected response: ${response.status}`);
  }
}

async function runTest() {
  try {
    // Create lobby and add players
    const gameId = await createLobby();
    await joinGame(gameId, 'Test Player 2');
    
    console.log('\n4. Checking initial lobby state...');
    const initialCheck = await checkLobbyState(gameId, false);
    if (!initialCheck.success) {
      console.log('❌ Initial lobby state incorrect');
      return;
    }
    console.log('✅ Initial lobby state correct (gameStarted: false)');
    
    // Start the game
    await startGame(gameId);
    
    console.log('\n5. Testing race condition detection...');
    
    // Check immediately after start (potential race condition)
    console.log('   Checking immediately after start...');
    const immediateCheck = await checkLobbyState(gameId, true);
    if (!immediateCheck.success) {
      console.log(`❌ RACE CONDITION DETECTED: Expected gameStarted: ${immediateCheck.expected}, got: ${immediateCheck.actual}`);
      
      // Wait a bit and check again
      console.log('   Waiting 200ms and checking again...');
      await sleep(200);
      const delayedCheck = await checkLobbyState(gameId, true);
      if (delayedCheck.success) {
        console.log('✅ Race condition resolved after delay');
      } else {
        console.log('❌ Race condition persists after delay');
      }
    } else {
      console.log('✅ No race condition detected');
    }
    
    // Check game state availability
    console.log('\n6. Checking game state availability...');
    const gameStateCheck = await checkGameState(gameId);
    if (gameStateCheck.found) {
      console.log('✅ Game state found and accessible');
      console.log(`   Game estado: ${gameStateCheck.gameState?.estado}`);
      console.log(`   Players: ${gameStateCheck.gameState?.players?.length}`);
    } else {
      console.log(`❌ Game state not found: ${gameStateCheck.error}`);
    }
    
    // Multiple rapid checks to simulate client polling
    console.log('\n7. Simulating rapid client polling...');
    let inconsistencies = 0;
    for (let i = 0; i < 5; i++) {
      const check = await checkLobbyState(gameId, true);
      if (!check.success) {
        inconsistencies++;
        console.log(`   Poll ${i + 1}: ❌ Inconsistent (expected: ${check.expected}, got: ${check.actual})`);
      } else {
        console.log(`   Poll ${i + 1}: ✅ Consistent`);
      }
      await sleep(100); // 100ms between polls
    }
    
    if (inconsistencies === 0) {
      console.log('✅ All polling checks consistent');
    } else {
      console.log(`❌ ${inconsistencies}/5 polling checks were inconsistent`);
    }
    
    console.log('\n🎉 Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
runTest(); 