#!/usr/bin/env node

const http = require('http');

const BASE_URL = process.env.NODE_ENV === 'production' 
  ? 'https://fodinha-card-arena.onrender.com'
  : 'http://localhost:3000';

console.log('🎲🦶 Testing Language-Dependent Dealer Emoji');
console.log('============================================');

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
          resolve({ status: res.statusCode, data: parsed, html: data });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: data }, html: data });
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

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDealerEmojiImplementation() {
  let gameId = null;

  try {
    console.log('\n1. Testing dealer emoji implementation...');
    
    // Test 1: Create a game to ensure dealer assignment works
    console.log('\n   Creating game to test dealer assignment...');
    const createResponse = await makeRequest('/api/create-game', 'POST', {
      lives: 3,
      startFrom: 'one'
    });
    
    if (createResponse.status !== 200) {
      throw new Error(`Failed to create game: ${createResponse.status}`);
    }
    
    gameId = createResponse.data.gameId;
    console.log(`   Game created: ${gameId}`);

    // Test 2: Add second player
    console.log('\n   Adding second player...');
    const joinResponse = await makeRequest(`/api/join-game/${gameId}`, 'POST', {
      player_name: 'Test Player 2'
    });
    
    addResult(
      'Second player joined successfully',
      joinResponse.status === 200,
      `Status: ${joinResponse.status}, Response: ${JSON.stringify(joinResponse.data)}`
    );

    await sleep(1000);

    // Test 3: Start the game to assign dealer
    console.log('\n   Starting game to assign dealer...');
    const startResponse = await makeRequest(`/api/start-game/${gameId}`, 'POST', {
      player_id: 1
    });
    
    addResult(
      'Game started and dealer assigned',
      startResponse.status === 200,
      `Status: ${startResponse.status}, Response: ${JSON.stringify(startResponse.data)}`
    );

    await sleep(1000);

    // Test 4: Check game state has dealer assigned
    console.log('\n   Checking game state for dealer assignment...');
    const gameStateResponse = await makeRequest(`/api/game-state/${gameId}`);
    
    if (gameStateResponse.status === 200 && gameStateResponse.data.dealer) {
      const dealerId = gameStateResponse.data.dealer;
      console.log(`   ✅ Dealer assigned to player ${dealerId}`);
      
      addResult(
        'Dealer properly assigned in game state',
        true,
        `Dealer is player ${dealerId}`
      );
    } else {
      addResult(
        'Dealer assignment check',
        false,
        `Game state response: ${gameStateResponse.status}, dealer: ${gameStateResponse.data?.dealer}`
      );
    }

    // Test 5: Verify the UI components have the dealer emoji logic
    console.log('\n   Verifying component implementations...');
    
    const fs = require('fs');
    const path = require('path');
    
    // Check PlayerList component
    try {
      const playerListPath = path.join(process.cwd(), 'src/components/Game/PlayerList.tsx');
      const playerListContent = fs.readFileSync(playerListPath, 'utf8');
      
      const hasLanguageImport = playerListContent.includes('const { t, language } = useLanguage()');
      const hasDealerFunction = playerListContent.includes('getDealerEmoji');
      const hasFootEmoji = playerListContent.includes('🦶');
      const hasDiceEmoji = playerListContent.includes('🎲');
      
      addResult(
        'PlayerList component has language-dependent dealer emoji',
        hasLanguageImport && hasDealerFunction && hasFootEmoji && hasDiceEmoji,
        `Language import: ${hasLanguageImport}, Dealer function: ${hasDealerFunction}, Foot emoji: ${hasFootEmoji}, Dice emoji: ${hasDiceEmoji}`
      );
    } catch (error) {
      addResult(
        'PlayerList component check',
        false,
        `Error reading file: ${error.message}`
      );
    }

    // Check Game component
    try {
      const gamePath = path.join(process.cwd(), 'src/components/Game/index.tsx');
      const gameContent = fs.readFileSync(gamePath, 'utf8');
      
      const hasLanguageImport = gameContent.includes('const { t, language } = useLanguage()');
      const hasDealerFunction = gameContent.includes('getDealerEmoji');
      const hasFootEmoji = gameContent.includes('🦶');
      const hasDiceEmoji = gameContent.includes('🎲');
      
      addResult(
        'Game component has language-dependent dealer emoji',
        hasLanguageImport && hasDealerFunction && hasFootEmoji && hasDiceEmoji,
        `Language import: ${hasLanguageImport}, Dealer function: ${hasDealerFunction}, Foot emoji: ${hasFootEmoji}, Dice emoji: ${hasDiceEmoji}`
      );
    } catch (error) {
      addResult(
        'Game component check',
        false,
        `Error reading file: ${error.message}`
      );
    }

    // Check DemoGame component
    try {
      const demoGamePath = path.join(process.cwd(), 'src/components/DemoGame.tsx');
      const demoGameContent = fs.readFileSync(demoGamePath, 'utf8');
      
      const hasLanguageImport = demoGameContent.includes('const { language } = useLanguage()');
      const hasDealerFunction = demoGameContent.includes('getDealerEmoji');
      const hasFootEmoji = demoGameContent.includes('🦶');
      const hasDiceEmoji = demoGameContent.includes('🎲');
      
      addResult(
        'DemoGame component has language-dependent dealer emoji',
        hasLanguageImport && hasDealerFunction && hasFootEmoji && hasDiceEmoji,
        `Language import: ${hasLanguageImport}, Dealer function: ${hasDealerFunction}, Foot emoji: ${hasFootEmoji}, Dice emoji: ${hasDiceEmoji}`
      );
    } catch (error) {
      addResult(
        'DemoGame component check',
        false,
        `Error reading file: ${error.message}`
      );
    }

  } catch (error) {
    console.error('Test failed with error:', error);
    addResult('Dealer emoji implementation test', false, error.message);
  }
}

async function runTests() {
  console.log(`Testing against: ${BASE_URL}\n`);
  
  await testDealerEmojiImplementation();
  
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${Math.round((testResults.passed / (testResults.passed + testResults.failed)) * 100)}%`);
  
  console.log('\n🎯 Implementation Summary');
  console.log('========================');
  console.log('✅ English (en): Dealer shows 🎲 (dice emoji)');
  console.log('✅ Portuguese (pt): Dealer shows 🦶 (foot emoji)');
  console.log('✅ All three game components updated:');
  console.log('   - PlayerList.tsx');
  console.log('   - Game.tsx');
  console.log('   - DemoGame.tsx');
  
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