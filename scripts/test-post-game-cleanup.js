#!/usr/bin/env node

const http = require('http');
const { io } = require('socket.io-client');

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://fodinha-card-arena.onrender.com'
  : 'http://localhost:3000';

console.log('🧪 Testing Post-Game Cleanup Behavior');
console.log('=====================================');

let testResults = {
  passed: 0,
  failed: 0,
  details: []
};

function addResult(test, passed, details) {
  if (passed) {
    testResults.passed++;
    console.log(`✅ ${test}`);
  } else {
    testResults.failed++;
    console.log(`❌ ${test}`);
    console.log(`   Details: ${details}`);
  }
  testResults.details.push({ test, passed, details });
}

async function makeRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPostGameCleanup() {
  let gameId = null;
  let hostSocket = null;
  let player2Socket = null;
  let player3Socket = null;

  try {
    // Step 1: Create a game
    console.log('\n1. Creating game...');
    const createResponse = await makeRequest('/api/create-game', 'POST', {
      lives: 3,
      startFrom: 'one'
    });
    
    if (createResponse.status !== 200) {
      throw new Error(`Failed to create game: ${createResponse.status}`);
    }
    
    gameId = createResponse.data.gameId;
    console.log(`   Game created: ${gameId}`);

    // Step 2: Connect host socket
    console.log('\n2. Connecting host socket...');
    hostSocket = await createSocket(gameId, 1, 'Host Player');
    console.log('   Host socket connected');

    // Step 3: Add player 2
    console.log('\n3. Adding player 2...');
    const joinResponse2 = await makeRequest(`/api/join-game/${gameId}`, 'POST', {
      player_name: 'Player Two'
    });
    
    if (joinResponse2.status !== 200) {
      throw new Error(`Failed to add player 2: ${joinResponse2.status}`);
    }
    
    const player2Id = joinResponse2.data.player_id;
    player2Socket = await createSocket(gameId, player2Id, 'Player Two');
    console.log(`   Player 2 joined: ${player2Id}`);

    // Step 4: Add player 3
    console.log('\n4. Adding player 3...');
    const joinResponse3 = await makeRequest(`/api/join-game/${gameId}`, 'POST', {
      player_name: 'Player Three'
    });
    
    if (joinResponse3.status !== 200) {
      throw new Error(`Failed to add player 3: ${joinResponse3.status}`);
    }
    
    const player3Id = joinResponse3.data.player_id;
    player3Socket = await createSocket(gameId, player3Id, 'Player Three');
    console.log(`   Player 3 joined: ${player3Id}`);

    // Step 5: Start the game
    console.log('\n5. Starting game...');
    const startResponse = await makeRequest(`/api/start-game/${gameId}`, 'POST', {
      player_id: 1
    });
    
    addResult(
      'Game started successfully',
      startResponse.status === 200,
      `Status: ${startResponse.status}, Response: ${JSON.stringify(startResponse.data)}`
    );

    await sleep(2000); // Let game initialize

    // Step 6: Simulate player 2 leaving during the game
    console.log('\n6. Player 2 leaves during game...');
    
    // First, player 2 calls leave-game API
    const leaveResponse = await makeRequest(`/api/leave-game/${gameId}`, 'POST', {
      player_id: player2Id
    });
    
    addResult(
      'Player 2 leave-game API call',
      leaveResponse.status === 200,
      `Status: ${leaveResponse.status}, Response: ${JSON.stringify(leaveResponse.data)}`
    );

    // Then disconnect socket
    if (player2Socket) {
      player2Socket.emit('leave-game', { gameId, playerId: player2Id });
      player2Socket.disconnect();
      player2Socket = null;
      console.log('   Player 2 socket disconnected');
    }

    await sleep(1000);

    // Step 7: Simulate player 3 just closing their tab (no API call)
    console.log('\n7. Player 3 closes tab (socket disconnect only)...');
    if (player3Socket) {
      player3Socket.disconnect();
      player3Socket = null;
      console.log('   Player 3 socket disconnected');
    }

    await sleep(2000);

    // Step 8: Check lobby state before return-to-lobby
    console.log('\n8. Checking lobby state before return-to-lobby...');
    const lobbyBeforeResponse = await makeRequest(`/api/lobby-info/${gameId}`);
    
    if (lobbyBeforeResponse.status === 200) {
      const playerCount = lobbyBeforeResponse.data.players?.length || 0;
      console.log(`   Players in lobby before cleanup: ${playerCount}`);
      console.log(`   Players: ${JSON.stringify(lobbyBeforeResponse.data.players?.map(p => `${p.id}:${p.name}`) || [])}`);
    }

    // Step 9: Host returns to lobby (this should trigger cleanup)
    console.log('\n9. Host returns to lobby (should clean up disconnected players)...');
    const returnResponse = await makeRequest(`/api/return-to-lobby/${gameId}`, 'POST', {
      player_id: 1
    });
    
    addResult(
      'Return to lobby API call',
      returnResponse.status === 200,
      `Status: ${returnResponse.status}, Response: ${JSON.stringify(returnResponse.data)}`
    );

    await sleep(1000);

    // Step 10: Check final lobby state
    console.log('\n10. Checking final lobby state...');
    const lobbyAfterResponse = await makeRequest(`/api/lobby-info/${gameId}`);
    
    if (lobbyAfterResponse.status === 200) {
      const finalPlayerCount = lobbyAfterResponse.data.players?.length || 0;
      const finalPlayers = lobbyAfterResponse.data.players || [];
      
      console.log(`   Players in lobby after cleanup: ${finalPlayerCount}`);
      console.log(`   Players: ${JSON.stringify(finalPlayers.map(p => `${p.id}:${p.name}`))}`);
      
      // Should only have the host (player 1) remaining
      const onlyHostRemains = finalPlayerCount === 1 && finalPlayers[0]?.id === 1;
      
      addResult(
        'Only host remains in lobby after cleanup',
        onlyHostRemains,
        `Expected: 1 player (host), Got: ${finalPlayerCount} players: ${JSON.stringify(finalPlayers.map(p => `${p.id}:${p.name}`))}`
      );
      
      const gameStarted = lobbyAfterResponse.data.gameStarted;
      addResult(
        'Game returned to lobby state',
        !gameStarted,
        `gameStarted should be false, got: ${gameStarted}`
      );
      
    } else {
      addResult(
        'Final lobby state check',
        false,
        `Failed to get lobby info: ${lobbyAfterResponse.status}`
      );
    }

  } catch (error) {
    console.error('Test failed with error:', error);
    addResult('Post-game cleanup test', false, error.message);
  } finally {
    // Cleanup
    if (hostSocket) {
      hostSocket.disconnect();
    }
    if (player2Socket) {
      player2Socket.disconnect();
    }
    if (player3Socket) {
      player3Socket.disconnect();
    }
  }
}

async function runTests() {
  console.log(`Testing against: ${BASE_URL}\n`);
  
  await testPostGameCleanup();
  
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  if (testResults.failed > 0) {
    console.log('\n❌ Failed Tests:');
    testResults.details
      .filter(r => !r.passed)
      .forEach(r => console.log(`   - ${r.test}: ${r.details}`));
  }
  
  process.exit(testResults.failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runTests().catch(console.error);
} 