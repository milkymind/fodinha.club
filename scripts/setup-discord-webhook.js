#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 Discord Webhook Setup for Bug Reports');
console.log('=========================================\n');

console.log('To set up Discord notifications for bug reports:');
console.log('1. Go to your Discord server settings');
console.log('2. Navigate to Integrations > Webhooks');
console.log('3. Create a new webhook or use an existing one');
console.log('4. Copy the webhook URL\n');

rl.question('Enter your Discord webhook URL (or press Enter to skip): ', (webhookUrl) => {
  const envPath = path.join(process.cwd(), '.env.local');
  
  let envContent = '';
  
  // Read existing .env.local if it exists
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
  }
  
  if (webhookUrl.trim()) {
    // Validate webhook URL format
    if (!webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
      console.log('❌ Invalid Discord webhook URL format.');
      console.log('   Expected format: https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN');
      rl.close();
      return;
    }
    
    // Update or add the webhook URL
    if (envContent.includes('DISCORD_BUG_WEBHOOK_URL=')) {
      // Replace existing line
      envContent = envContent.replace(
        /DISCORD_BUG_WEBHOOK_URL=.*/,
        `DISCORD_BUG_WEBHOOK_URL=${webhookUrl}`
      );
    } else {
      // Add new line
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += `DISCORD_BUG_WEBHOOK_URL=${webhookUrl}\n`;
    }
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Discord webhook URL saved to .env.local');
    console.log('   Bug reports will now be sent to your Discord channel.');
  } else {
    // Ensure the environment variable exists but is empty
    if (!envContent.includes('DISCORD_BUG_WEBHOOK_URL=')) {
      if (envContent && !envContent.endsWith('\n')) {
        envContent += '\n';
      }
      envContent += '# Discord webhook for bug reports (leave empty to disable Discord notifications)\n';
      envContent += 'DISCORD_BUG_WEBHOOK_URL=\n';
      fs.writeFileSync(envPath, envContent);
    }
    console.log('ℹ️  Discord notifications disabled.');
    console.log('   Bug reports will only be logged to the console.');
    console.log('   Run this script again anytime to set up Discord notifications.');
  }
  
  console.log('\n🚀 Setup complete! Restart your development server to apply changes.');
  rl.close();
}); 