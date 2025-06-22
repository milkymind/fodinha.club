#!/usr/bin/env node

const fetch = require('node-fetch');

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

console.log('🧪 Testing Conservative Lobby Cleanup');
console.log(`Base URL: ${BASE_URL}\n`);

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testLobbyWaitingStability() {
  try {
    console.log('=== Test: Player Stability in Lobby Waiting Screen ===\n');
    
    // 1. Create lobby
    console.log('1. Creating lobby...');
    const createResponse = await fetch(`${BASE_URL}/api/create-game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: 'Host Player',
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
    console.log(`✅ Lobby created: ${gameId}`);
    
    // 2. Add Player 2
    console.log('\\n2. Adding Player 2...');
    const joinResponse = await fetch(`${BASE_URL}/api/join-game/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: 'Player 2' })
    });
    
    const joinData = await joinResponse.json();
    if (joinData.status !== 'success') {
      throw new Error(`Failed to join game: ${joinData.error}`);
    }
    
    const player2Id = joinData.player_id;
    console.log(`✅ Player 2 joined as Player ${player2Id}`);
    
    // 3. Verify both players are in lobby
    console.log('\\n3. Verifying initial lobby state...');
    let lobbyResponse = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=${hostPlayerId}`);
    let lobbyData = await lobbyResponse.json();
    
    if (lobbyData.status === 'success') {
      console.log(`✅ Initial state: ${lobbyData.lobby.players.length} players (${lobbyData.lobby.players.map(p => p.name).join(', ')})`);
    } else {
      throw new Error(`Failed to get lobby info: ${lobbyData.error}`);
    }
    
    // 4. Simulate Player 2 leaving and rejoining (like the user's scenario)
    console.log('\\n4. Player 2 leaves lobby...');
    const leaveResponse = await fetch(`${BASE_URL}/api/leave-game/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: player2Id })
    });
    
    const leaveData = await leaveResponse.json();
    if (leaveData.status === 'success') {
      console.log(`✅ Player 2 left successfully. Players remaining: ${leaveData.players_remaining}`);
    } else {
      console.log(`⚠️ Leave failed: ${leaveData.error}`);
    }
    
    // 5. Wait 15 seconds (like the user did)
    console.log('\\n5. Waiting 15 seconds (simulating user delay)...');
    await sleep(15000);
    
    // 6. Player 2 rejoins
    console.log('\\n6. Player 2 rejoins...');
    const rejoinResponse = await fetch(`${BASE_URL}/api/join-game/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: 'Player 2 (rejoined)' })
    });
    
    const rejoinData = await rejoinResponse.json();
    if (rejoinData.status === 'success') {
      const newPlayer2Id = rejoinData.player_id;
      console.log(`✅ Player 2 rejoined as Player ${newPlayer2Id}`);
      
      // 7. Verify lobby state after rejoin
      console.log('\\n7. Verifying lobby state after rejoin...');
      lobbyResponse = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=${hostPlayerId}`);
      lobbyData = await lobbyResponse.json();
      
      if (lobbyData.status === 'success') {
        console.log(`✅ After rejoin: ${lobbyData.lobby.players.length} players (${lobbyData.lobby.players.map(p => p.name).join(', ')})`);
        
        // 8. Test if game can start (this was the user's issue)
        console.log('\\n8. Testing game start...');
        const startResponse = await fetch(`${BASE_URL}/api/start-game/${gameId}`, {
          method: 'POST'
        });
        
        const startData = await startResponse.json();
        if (startData.status === 'success') {
          console.log('✅ Game started successfully! Issue is fixed.');
          return true;
        } else {
          console.log(`❌ Game start failed: ${startData.error}`);
          if (startData.debug) {
            console.log('Debug info:', startData.debug);
          }
          return false;
        }
      } else {
        console.log(`❌ Failed to get lobby info after rejoin: ${lobbyData.error}`);
        return false;
      }
    } else {
      console.log(`❌ Rejoin failed: ${rejoinData.error}`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testLobbyStabilityWithPolling() {
  try {
    console.log('\\n=== Test: Lobby Stability During Normal Polling ===\\n');
    
    // Create lobby with 2 players
    const createResponse = await fetch(`${BASE_URL}/api/create-game`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: 'Host',
        lives: 3,
        startFrom: 'one'
      })
    });
    
    const createData = await createResponse.json();
    const gameId = createData.game_id;
    const hostPlayerId = createData.player_id;
    
    const joinResponse = await fetch(`${BASE_URL}/api/join-game/${gameId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_name: 'Player 2' })
    });
    
    const joinData = await joinResponse.json();
    const player2Id = joinData.player_id;
    
    console.log(`Lobby created: ${gameId} with 2 players`);
    
    // Simulate polling from both players for 30 seconds
    console.log('Simulating normal polling for 30 seconds...');
    
    let allChecksPass = true;
    const pollInterval = 3000; // 3 seconds like the real app
    const totalTime = 30000; // 30 seconds
    const checks = totalTime / pollInterval;
    
    for (let i = 0; i < checks; i++) {
      // Both players poll
      const hostPoll = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=${hostPlayerId}`);
      const player2Poll = await fetch(`${BASE_URL}/api/lobby-info/${gameId}?playerId=${player2Id}`);
      
      const hostData = await hostPoll.json();
      const player2Data = await player2Poll.json();
      
      if (hostData.status === 'success' && player2Data.status === 'success') {
        const hostPlayerCount = hostData.lobby.players.length;
        const player2PlayerCount = player2Data.lobby.players.length;
        
        console.log(`Check ${i + 1}/${checks}: Host sees ${hostPlayerCount} players, Player 2 sees ${player2PlayerCount} players`);
        
        if (hostPlayerCount !== 2 || player2PlayerCount !== 2) {
          console.log(`❌ Player count mismatch! Expected 2, got ${hostPlayerCount}/${player2PlayerCount}`);
          allChecksPass = false;
          break;
        }
      } else {
        console.log(`❌ API error on check ${i + 1}`);
        allChecksPass = false;
        break;
      }
      
      await sleep(pollInterval);
    }
    
    if (allChecksPass) {
      console.log('✅ All polling checks passed - lobby remained stable!');
      return true;
    } else {
      console.log('❌ Lobby stability test failed');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Polling test failed:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Starting conservative cleanup tests...\\n');
  
  const test1Result = await testLobbyWaitingStability();
  const test2Result = await testLobbyStabilityWithPolling();
  
  console.log('\\n📊 TEST RESULTS:');
  console.log(`Leave/Rejoin Scenario: ${test1Result ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Polling Stability: ${test2Result ? '✅ PASS' : '❌ FAIL'}`);
  
  if (test1Result && test2Result) {
    console.log('\\n🎉 All tests passed! Conservative cleanup is working correctly.');
  } else {
    console.log('\\n⚠️  Some tests failed. The cleanup logic may still be too aggressive.');
  }
}

// Run the tests
runAllTests(); 