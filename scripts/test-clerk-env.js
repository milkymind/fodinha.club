// Test Clerk environment variables
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing Clerk environment variables...\n');

const requiredClerkVars = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'NEXT_PUBLIC_CLERK_SIGN_IN_URL',
  'NEXT_PUBLIC_CLERK_SIGN_UP_URL'
];

const requiredDatabaseVars = [
  'DATABASE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const requiredDiscordVars = [
  'DISCORD_BUG_WEBHOOK_URL',
  'DISCORD_PUSH_WEBHOOK_URL'
];

function checkVariables(vars, category) {
  console.log(`\n📋 ${category} Variables:`);
  let allPresent = true;
  
  vars.forEach(varName => {
    const value = process.env[varName];
    if (value) {
      // Show first few characters for verification, hide the rest
      const preview = value.length > 20 ? value.substring(0, 20) + '...' : value;
      console.log(`✅ ${varName}: ${preview}`);
    } else {
      console.log(`❌ ${varName}: Missing`);
      allPresent = false;
    }
  });
  
  return allPresent;
}

// Check all variable categories
const clerkOk = checkVariables(requiredClerkVars, 'Clerk Authentication');
const dbOk = checkVariables(requiredDatabaseVars, 'Database');
const discordOk = checkVariables(requiredDiscordVars, 'Discord Webhooks');

console.log('\n🎯 Summary:');
console.log(`Clerk Authentication: ${clerkOk ? '✅ Ready' : '❌ Missing variables'}`);
console.log(`Database Connection: ${dbOk ? '✅ Ready' : '❌ Missing variables'}`);
console.log(`Discord Webhooks: ${discordOk ? '✅ Ready' : '❌ Missing variables'}`);

if (clerkOk && dbOk) {
  console.log('\n🚀 All critical systems ready for development!');
} else {
  console.log('\n⚠️  Some systems may not work properly.');
} 