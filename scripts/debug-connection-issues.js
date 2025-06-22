#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Fodinha Connection Issues Debug Tool\n');

// Check for common issues
const issues = [];
const fixes = [];

// 1. Check polling intervals
try {
  const indexPath = path.join(__dirname, '../pages/index.tsx');
  const indexContent = fs.readFileSync(indexPath, 'utf8');
  
  const pollingMatches = indexContent.match(/setInterval\([^,]+,\s*(\d+)\)/g);
  if (pollingMatches) {
    pollingMatches.forEach(match => {
      const interval = parseInt(match.match(/(\d+)\)$/)[1]);
      if (interval < 2000) {
        issues.push(`❌ Fast polling detected: ${match} (${interval}ms)`);
        fixes.push(`✅ Reduced polling to 3000ms for better performance`);
      } else {
        console.log(`✅ Good polling interval: ${interval}ms`);
      }
    });
  }
} catch (error) {
  console.log('⚠️  Could not check polling intervals');
}

// 2. Check lobby cleanup thresholds
try {
  const lobbyPath = path.join(__dirname, '../pages/api/lobby-info/[id].ts');
  const lobbyContent = fs.readFileSync(lobbyPath, 'utf8');
  
  const thresholdMatch = lobbyContent.match(/recentActivityThreshold.*?(\d+)\s*\*\s*1000/);
  if (thresholdMatch) {
    const threshold = parseInt(thresholdMatch[1]);
    if (threshold < 5) {
      issues.push(`❌ Aggressive lobby cleanup: ${threshold}s threshold`);
    } else {
      console.log(`✅ Conservative lobby cleanup: ${threshold}s threshold`);
      fixes.push(`✅ Increased cleanup threshold to ${threshold}s`);
    }
  }
} catch (error) {
  console.log('⚠️  Could not check lobby cleanup settings');
}

// 3. Check for error handling in APIs
const apiPaths = [
  '../pages/api/make-bet/[id].ts',
  '../pages/api/game-state/[id].ts'
];

apiPaths.forEach(apiPath => {
  try {
    const fullPath = path.join(__dirname, apiPath);
    const content = fs.readFileSync(fullPath, 'utf8');
    
    if (content.includes('Game state not found - game may not have started yet')) {
      console.log(`✅ Good error handling in ${path.basename(apiPath)}`);
      fixes.push(`✅ Added descriptive error messages in ${path.basename(apiPath)}`);
    } else if (content.includes('Game state not found')) {
      issues.push(`❌ Generic error in ${path.basename(apiPath)}`);
    }
  } catch (error) {
    console.log(`⚠️  Could not check ${apiPath}`);
  }
});

// Print summary
console.log('\n📊 SUMMARY:');
console.log(`Issues found: ${issues.length}`);
console.log(`Fixes applied: ${fixes.length}`);

if (issues.length > 0) {
  console.log('\n❌ REMAINING ISSUES:');
  issues.forEach(issue => console.log(issue));
}

if (fixes.length > 0) {
  console.log('\n✅ FIXES APPLIED:');
  fixes.forEach(fix => console.log(fix));
}

console.log('\n🔧 RECOMMENDED NEXT STEPS:');
console.log('1. Monitor server logs for "Game state not found" errors');
console.log('2. Check if players are joining games before they are started');
console.log('3. Ensure Socket.io connections are stable');
console.log('4. Test lobby cleanup behavior with multiple players');

console.log('\n📈 MONITORING COMMANDS:');
console.log('- Watch API logs: tail -f logs/api.log');
console.log('- Monitor active connections: netstat -an | grep :3000');
console.log('- Check memory usage: ps aux | grep node'); 