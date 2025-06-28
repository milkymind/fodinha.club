#!/usr/bin/env node

/**
 * Test script for the Real-Time Leaderboard functionality
 * Tests the API endpoints and ensures data flows correctly
 */

// Use native fetch if available (Node 18+) or fallback to a simple test
const fetch = globalThis.fetch || require('https').get;

const BASE_URL = 'http://localhost:3000';

async function testLeaderboardAPI() {
  console.log('🧪 Testing Leaderboard API Endpoints...\n');

  const metrics = [
    'perfectPredictionRate',
    'avgSurvivalRate', 
    'multiplierEfficiency',
    'lastPlayerWinRate',
    'highPressureAccuracy',
    'avgBetAccuracyScore'
  ];

  for (const metric of metrics) {
    try {
      console.log(`📊 Testing metric: ${metric}`);
      
      // Test standard format
      const standardResponse = await fetch(`${BASE_URL}/api/leaderboard-live?metric=${metric}&limit=10`);
      const standardData = await standardResponse.json();
      
      if (standardData.status === 'success') {
        console.log(`  ✅ Standard format: ${standardData.leaderboard.length} entries`);
      } else {
        console.log(`  ❌ Standard format failed: ${standardData.error}`);
      }

      // Test comprehensive format
      const comprehensiveResponse = await fetch(`${BASE_URL}/api/leaderboard-live?metric=${metric}&format=comprehensive&limit=50`);
      const comprehensiveData = await comprehensiveResponse.json();
      
      if (comprehensiveData.status === 'success') {
        console.log(`  ✅ Comprehensive format: ${comprehensiveData.leaderboard.rankings.length} entries`);
        console.log(`  📈 Total players: ${comprehensiveData.leaderboard.totalPlayers}`);
        console.log(`  🏷️  Metric info: ${comprehensiveData.leaderboard.metricInfo.name}`);
      } else {
        console.log(`  ❌ Comprehensive format failed: ${comprehensiveData.error}`);
      }

    } catch (error) {
      console.log(`  ❌ Error testing ${metric}: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }
}

async function testLeaderboardPage() {
  console.log('🌐 Testing Leaderboard Page...\n');

  try {
    const response = await fetch(`${BASE_URL}/leaderboard`);
    
    if (response.ok) {
      const html = await response.text();
      
      // Check if the page contains expected elements
      const hasTitle = html.includes('Leaderboard');
      const hasReactApp = html.includes('__next');
      const hasJavaScript = html.includes('leaderboard.js');
      
      console.log(`✅ Page loads successfully (${response.status})`);
      console.log(`✅ Contains title: ${hasTitle}`);
      console.log(`✅ React app structure: ${hasReactApp}`);
      console.log(`✅ JavaScript bundle: ${hasJavaScript}`);
      
      if (hasTitle && hasReactApp && hasJavaScript) {
        console.log('🎉 Leaderboard page is properly configured!');
      } else {
        console.log('⚠️  Some page elements may be missing');
      }
      
    } else {
      console.log(`❌ Page failed to load: ${response.status} ${response.statusText}`);
    }
    
  } catch (error) {
    console.log(`❌ Error testing page: ${error.message}`);
  }
}

async function testUserMenuIntegration() {
  console.log('\n🔗 Testing User Menu Integration...\n');

  try {
    const response = await fetch(`${BASE_URL}/`);
    
    if (response.ok) {
      const html = await response.text();
      
      // Check if home page loads (where the user menu is)
      const hasUserMenu = html.includes('CustomUserMenu') || html.includes('Leaderboard');
      
      console.log(`✅ Home page loads: ${response.ok}`);
      console.log(`✅ User menu integration: ${hasUserMenu ? 'Found' : 'Not found in HTML'}`);
      
    } else {
      console.log(`❌ Home page failed: ${response.status}`);
    }
    
  } catch (error) {
    console.log(`❌ Error testing integration: ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Leaderboard Component Tests\n');
  console.log('=' .repeat(50));
  
  await testLeaderboardAPI();
  await testLeaderboardPage();
  await testUserMenuIntegration();
  
  console.log('\n' + '=' .repeat(50));
  console.log('✨ Leaderboard tests completed!');
  console.log('\n📝 Next steps:');
  console.log('  1. Visit http://localhost:3000/leaderboard to see the UI');
  console.log('  2. Click the Leaderboard button in the user menu');
  console.log('  3. Test different metrics and auto-refresh');
  console.log('  4. Create some test games to populate data');
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testLeaderboardAPI, testLeaderboardPage, testUserMenuIntegration }; 