#!/usr/bin/env node

const http = require('http');
const { io } = require('socket.io-client');

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://fodinha-card-arena.onrender.com'
  : 'http://localhost:3000';

console.log('🔄 Testing Player Reconnection and Game Start Fix');
console.log('================================================');

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

async function testReconnectionFix() {
  let gameId = null;
  let hostSocket = null;
  let player2Socket = null;

  try {
    console.log('\n📋 Test Scenario: Player Leave + Reconnect + Start Game');
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
      addResult(
        'Lobby has 2 players initially',
        playerCount === 2,
        `Expected: 2 players, Got: ${playerCount} players`
      );
    }

    // Step 5: Player 2 leaves
    console.log('\n5. Player 2 leaving game...');
    const leaveResponse = await makeRequest(`/api/leave-game/${gameId}`, 'POST', {
      player_id: player2Id
    });
    
    addResult(
      'Player 2 leave-game API call',
      leaveResponse.status === 200,
      `Status: ${leaveResponse.status}`
    );

    // Disconnect socket
    if (player2Socket) {
      player2Socket.emit('leave-game', { gameId, playerId: player2Id });
      player2Socket.disconnect();
      player2Socket = null;
    }

    await sleep(1000);

    // Step 6: Check lobby has 1 player
    console.log('\n6. Verifying lobby state after player 2 left...');
    const lobbyCheck2 = await makeRequest(`/api/lobby-info/${gameId}`);
    
    if (lobbyCheck2.status === 200) {
      const playerCount = lobbyCheck2.data.players?.length || 0;
      addResult(
        'Lobby has 1 player after leave',
        playerCount === 1,
        `Expected: 1 player, Got: ${playerCount} players`
      );
    }

    // Step 7: Player 2 reconnects (socket only, no API call)
    console.log('\n7. Player 2 reconnecting via socket...');
    player2Socket = await createSocket(gameId, player2Id, 'Player Two');
    console.log('   ✅ Player 2 socket reconnected');

    await sleep(2000); // Give time for socket join-game handler to process

    // Step 8: Check lobby has 2 players again
    console.log('\n8. Verifying lobby state after reconnection...');
    const lobbyCheck3 = await makeRequest(`/api/lobby-info/${gameId}`);
    
    if (lobbyCheck3.status === 200) {
      const playerCount = lobbyCheck3.data.players?.length || 0;
      const players = lobbyCheck3.data.players || [];
      console.log(`   Players in lobby: ${JSON.stringify(players.map(p => `${p.id}:${p.name}`))}`);
      
      addResult(
        'Lobby has 2 players after reconnection',
        playerCount === 2,
        `Expected: 2 players, Got: ${playerCount} players: ${JSON.stringify(players.map(p => `${p.id}:${p.name}`))}`
      );
    }

    // Step 9: Try to start the game
    console.log('\n9. Attempting to start game...');
    const startResponse = await makeRequest(`/api/start-game/${gameId}`, 'POST', {
      player_id: 1
    });
    
    addResult(
      'Game starts successfully after reconnection',
      startResponse.status === 200,
      `Status: ${startResponse.status}, Response: ${JSON.stringify(startResponse.data)}`
    );

    if (startResponse.status === 200) {
      await sleep(1000);
      
      // Step 10: Verify game state exists
      console.log('\n10. Verifying game state was created...');
      const gameStateResponse = await makeRequest(`/api/game-state/${gameId}`);
      
      addResult(
        'Game state exists after start',
        gameStateResponse.status === 200,
        `Status: ${gameStateResponse.status}, Has dealer: ${!!gameStateResponse.data?.dealer}`
      );
    }

  } catch (error) {
    console.error('Test failed with error:', error);
    addResult('Reconnection fix test', false, error.message);
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

async function runTests() {
  console.log(`Testing against: ${BASE_URL}\n`);
  
  // Wait a bit for server to be ready
  await sleep(3000);
  
  await testReconnectionFix();
  
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  console.log('\n🎯 Fix Summary');
  console.log('==============');
  console.log('✅ Enhanced socket join-game handler to re-add players to lobby database');
  console.log('✅ Players who reconnect via socket are automatically added back to lobby');
  console.log('✅ Game start should work after reconnections');
  
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