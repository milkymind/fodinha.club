#!/usr/bin/env node

const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🔍 Diagnosing Lobby Issue');
console.log(`Base URL: ${BASE_URL}\n`);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function createAndMonitorLobby() {
  try {
    console.log('1. Creating lobby...');
    
    // Create lobby
    const createResponse = await fetch(`${BASE_URL}/api/create-game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: 'Test Host',
        lives: 3,
        startFrom: 'one'
      })
    });
    
    const createData = await createResponse.json();
    if (createData.status !== 'success') {
      throw new Error(`Failed to create lobby: ${createData.error}`);
    }
    
    const gameId = createData.game_id;
    const hostPlayerId = createData.player_id;
    
    console.log(`✅ Lobby created: ${gameId}, Host: Player ${hostPlayerId}`);
    
    // Monitor lobby immediately after creation
    console.log('\\n2. Monitoring lobby state...');
    
    for (let i = 0; i < 10; i++) {
      const lobbyResponse = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=${hostPlayerId}`);
      const lobbyData = await lobbyResponse.json();
      
      if (lobbyData.status === 'success') {
        const playerCount = lobbyData.lobby.players?.length || 0;
        const playerNames = lobbyData.lobby.players?.map(p => p.name).join(', ') || 'none';
        
        console.log(`  Check ${i + 1}: ${playerCount} players (${playerNames})`);
        
        if (playerCount === 0) {
          console.log('❌ ISSUE DETECTED: Lobby has 0 players!');
          console.log('Lobby details:', JSON.stringify(lobbyData.lobby, null, 2));
          break;
        }
      } else {
        console.log(`  Check ${i + 1}: Error - ${lobbyData.error}`);
      }
      
      await sleep(1000); // Wait 1 second between checks
    }
    
    // Try to add a second player
    console.log('\\n3. Adding second player...');
    
    const joinResponse = await fetch(`${BASE_URL}/api/join-game/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: 'Test Player 2' })
    });
    
    const joinData = await joinResponse.json();
    if (joinData.status === 'success') {
      console.log(`✅ Player 2 joined as Player ${joinData.player_id}`);
      
      // Check lobby after join
      await sleep(500);
      const lobbyResponse = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=${hostPlayerId}`);
      const lobbyData = await lobbyResponse.json();
      
      if (lobbyData.status === 'success') {
        const playerCount = lobbyData.lobby.players?.length || 0;
        const playerNames = lobbyData.lobby.players?.map(p => p.name).join(', ') || 'none';
        console.log(`After join: ${playerCount} players (${playerNames})`);
      }
    } else {
      console.log(`❌ Failed to add Player 2: ${joinData.error}`);
    }
    
    // Try to start the game
    console.log('\\n4. Attempting to start game...');
    
    const startResponse = await fetch(`${BASE_URL}/api/start-game/${gameId}`, {
      method: 'POST'
    });
    
    const startData = await startResponse.json();
    console.log(`Start game result: ${startData.status}`);
    
    if (startData.status === 'error') {
      console.log(`❌ Start game error: ${startData.error}`);
      if (startData.debug) {
        console.log('Debug info:', startData.debug);
      }
    } else {
      console.log('✅ Game started successfully');
    }
    
  } catch (error) {
    console.error('❌ Diagnostic failed:', error.message);
  }
}

async function testMultipleLobbies() {
  console.log('\\n=== Testing Multiple Lobbies ===');
  
  for (let i = 1; i <= 3; i++) {
    console.log(`\\nTest ${i}:`);
    await createAndMonitorLobby();
    await sleep(2000); // Wait between tests
  }
}

// Run the diagnostic
testMultipleLobbies(); 