#!/usr/bin/env node

const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🧪 Testing Lobby Fixes');
console.log(`Base URL: ${BASE_URL}\n`);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createLobby(playerName = 'Host Player') {
  console.log(`1. Creating lobby with host: ${playerName}...`);
  const response = await fetch(`${BASE_URL}/api/create-game`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      player_name: playerName,
      lives: 3,
      startFrom: 'one'
    })
  });
  
  const data = await response.json();
  if (data.status === 'success') {
    console.log(`✅ Lobby created: ${data.game_id}`);
    return { gameId: data.game_id, hostPlayerId: data.player_id };
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

async function leaveGame(gameId, playerId) {
  console.log(`3. Player ${playerId} leaving game ${gameId}...`);
  const response = await fetch(`${BASE_URL}/api/leave-game/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId })
  });
  
  const data = await response.json();
  if (data.status === 'success') {
    console.log(`✅ Player ${playerId} left successfully. Players remaining: ${data.players_remaining}`);
    return data;
  } else {
    throw new Error(`Failed to leave game: ${data.error}`);
  }
}

async function getLobbyInfo(gameId, playerId = 1) {
  const response = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=${playerId}`);
  const data = await response.json();
  
  if (data.status === 'success') {
    return data.lobby;
  } else {
    throw new Error(`Failed to get lobby info: ${data.error}`);
  }
}

async function startGame(gameId) {
  console.log(`4. Starting game ${gameId}...`);
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

async function getGameState(gameId) {
  const response = await fetch(`${BASE_URL}/api/game-state/${gameId}`);
  
  if (response.ok) {
    const data = await response.json();
    return data.game_state;
  } else {
    return null;
  }
}

async function testPlayerLeaving() {
  console.log('\n=== Test 1: Player Leaving Lobby ===');
  
  try {
    // Create lobby with host
    const { gameId, hostPlayerId } = await createLobby('Host Player');
    
    // Add two more players
    const player2Id = await joinGame(gameId, 'Player 2');
    const player3Id = await joinGame(gameId, 'Player 3');
    
    // Check initial lobby state
    let lobby = await getLobbyInfo(gameId);
    console.log(`Initial lobby: ${lobby.players.length} players - ${lobby.players.map(p => p.name).join(', ')}`);
    
    // Player 2 leaves
    await leaveGame(gameId, player2Id);
    
    // Wait a moment for cleanup
    await sleep(500);
    
    // Check lobby state after leave
    lobby = await getLobbyInfo(gameId, hostPlayerId);
    console.log(`After Player 2 left: ${lobby.players.length} players - ${lobby.players.map(p => p.name).join(', ')}`);
    
    // Verify Player 2 is no longer in the lobby
    const player2StillInLobby = lobby.players.some(p => p.id === player2Id);
    if (player2StillInLobby) {
      console.log('❌ Player 2 is still in lobby after leaving!');
      return false;
    } else {
      console.log('✅ Player 2 properly removed from lobby');
    }
    
    // Player 3 leaves
    await leaveGame(gameId, player3Id);
    await sleep(500);
    
    // Check final lobby state
    lobby = await getLobbyInfo(gameId, hostPlayerId);
    console.log(`After Player 3 left: ${lobby.players.length} players - ${lobby.players.map(p => p.name).join(', ')}`);
    
    if (lobby.players.length === 1 && lobby.players[0].id === hostPlayerId) {
      console.log('✅ Only host remains in lobby');
      return true;
    } else {
      console.log('❌ Unexpected players in lobby');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testRandomDealer() {
  console.log('\n=== Test 2: Random Dealer Selection ===');
  
  const dealerCounts = {};
  const numTests = 10;
  
  for (let i = 0; i < numTests; i++) {
    try {
      // Create lobby and add players
      const { gameId } = await createLobby(`Host ${i}`);
      await joinGame(gameId, `Player 2-${i}`);
      await joinGame(gameId, `Player 3-${i}`);
      
      // Start the game
      await startGame(gameId);
      
      // Get game state to check dealer
      const gameState = await getGameState(gameId);
      if (gameState && gameState.dealer) {
        const dealer = gameState.dealer;
        dealerCounts[dealer] = (dealerCounts[dealer] || 0) + 1;
        console.log(`Game ${i + 1}: Dealer is Player ${dealer}`);
      } else {
        console.log(`Game ${i + 1}: Could not determine dealer`);
      }
      
      // Small delay between tests
      await sleep(100);
      
    } catch (error) {
      console.error(`Game ${i + 1} failed:`, error.message);
    }
  }
  
  console.log('\nDealer Distribution:');
  Object.entries(dealerCounts).forEach(([playerId, count]) => {
    const percentage = ((count / numTests) * 100).toFixed(1);
    console.log(`  Player ${playerId}: ${count}/${numTests} times (${percentage}%)`);
  });
  
  // Check if distribution is reasonably random (no player should have ALL games)
  const maxCount = Math.max(...Object.values(dealerCounts));
  const isRandomEnough = maxCount < numTests; // No player should be dealer in ALL games
  
  if (isRandomEnough) {
    console.log('✅ Dealer selection appears to be randomized');
    return true;
  } else {
    console.log('❌ Dealer selection not random enough');
    return false;
  }
}

async function runAllTests() {
  try {
    console.log('🚀 Starting lobby fixes tests...\n');
    
    const test1Result = await testPlayerLeaving();
    const test2Result = await testRandomDealer();
    
    console.log('\n📊 TEST RESULTS:');
    console.log(`Player Leaving: ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Random Dealer: ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
    
    if (test1Result && test2Result) {
      console.log('\n🎉 All tests passed! Lobby fixes are working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
    
  } catch (error) {
    console.error('❌ Test suite failed:', error.message);
  }
}

// Run the tests
runAllTests(); 