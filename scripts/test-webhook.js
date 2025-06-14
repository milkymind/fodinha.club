#!/usr/bin/env node

const crypto = require('crypto');
const fetch = require('node-fetch');

// Configuration
const WEBHOOK_URL = 'https://fodinha.club/api/github-webhook';
const GITHUB_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const REPO_OWNER = 'milkymind';
const REPO_NAME = 'fodinha.club';

if (!GITHUB_SECRET) {
  console.error('Error: GITHUB_WEBHOOK_SECRET environment variable is required');
  process.exit(1);
}

// Function to create GitHub webhook signature
function createSignature(payload, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  return 'sha256=' + hmac.digest('hex');
}

// Function to create a mock GitHub webhook payload
function createWebhookPayload(commits, branch = 'Discord-Updates') {
  return {
    ref: `refs/heads/${branch}`,
    before: commits[commits.length - 1]?.id || '0000000000000000000000000000000000000000',
    after: commits[0]?.id || '0000000000000000000000000000000000000000',
    repository: {
      id: 123456789,
      name: REPO_NAME,
      full_name: `${REPO_OWNER}/${REPO_NAME}`,
      html_url: `https://github.com/${REPO_OWNER}/${REPO_NAME}`,
      description: 'Fodinha Card Game - Brazilian trick-taking card game',
      private: false,
      default_branch: 'main'
    },
    pusher: {
      name: 'Test User',
      email: 'test@example.com'
    },
    sender: {
      login: 'test-user',
      id: 12345,
      avatar_url: 'https://github.com/images/error/octocat_happy.gif',
      type: 'User'
    },
    commits: commits,
    head_commit: commits[0] || null,
    compare: `https://github.com/${REPO_OWNER}/${REPO_NAME}/compare/${commits[commits.length - 1]?.id.substring(0, 12)}...${commits[0]?.id.substring(0, 12)}`,
    created: false,
    deleted: false,
    forced: false
  };
}

// Function to send webhook
async function sendWebhook(payload) {
  const payloadString = JSON.stringify(payload);
  const signature = createSignature(payloadString, GITHUB_SECRET);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': signature,
        'X-GitHub-Event': 'push',
        'X-GitHub-Delivery': crypto.randomUUID(),
        'User-Agent': 'GitHub-Hookshot/test'
      },
      body: payloadString
    });

    const responseText = await response.text();
    
    if (response.ok) {
      console.log('✅ Webhook sent successfully');
      return true;
    } else {
      console.error(`❌ Webhook failed: ${response.status} - ${responseText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending webhook:', error.message);
    return false;
  }
}

// Function to get recent commits from git log
function getRecentCommits(count = 5) {
  const { execSync } = require('child_process');
  
  try {
    const gitLog = execSync(
      `git log --oneline -${count} --pretty=format:"%H|%an|%ae|%s|%ad" --date=iso`,
      { encoding: 'utf8' }
    );

    return gitLog.trim().split('\n').map((line, index) => {
      const [hash, author, email, message, date] = line.split('|');
      return {
        id: hash,
        tree_id: hash, // Simplified for testing
        distinct: true,
        message: message,
        timestamp: new Date(date).toISOString(),
        url: `https://github.com/${REPO_OWNER}/${REPO_NAME}/commit/${hash}`,
        author: {
          name: author,
          email: email,
          username: author.toLowerCase().replace(/\s+/g, '')
        },
        committer: {
          name: author,
          email: email,
          username: author.toLowerCase().replace(/\s+/g, '')
        },
        added: [],
        removed: [],
        modified: ['test-file.js'] // Simplified for testing
      };
    });
  } catch (error) {
    console.error('Error getting git commits:', error.message);
    return [];
  }
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const commitCount = parseInt(args[0]) || 5;
  const branch = args[1] || 'Discord-Updates';

  console.log(`🔄 Fetching last ${commitCount} commits from ${branch} branch...`);
  
  const commits = getRecentCommits(commitCount);
  
  if (commits.length === 0) {
    console.log('❌ No commits found');
    return;
  }

  console.log(`📋 Found ${commits.length} commits:`);
  commits.forEach((commit, index) => {
    console.log(`  ${index + 1}. ${commit.id.substring(0, 7)} - ${commit.message}`);
  });

  console.log('\n🚀 Sending test webhook notifications...\n');

  // Send webhooks for each commit (or group them)
  const groupCommits = args.includes('--group');
  
  if (groupCommits) {
    // Send all commits in one webhook (like a real push with multiple commits)
    console.log('📦 Sending grouped webhook...');
    const payload = createWebhookPayload(commits, branch);
    await sendWebhook(payload);
  } else {
    // Send individual webhooks for each commit
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      console.log(`📤 Sending webhook for: ${commit.id.substring(0, 7)} - ${commit.message}`);
      
      const payload = createWebhookPayload([commit], branch);
      const success = await sendWebhook(payload);
      
      if (success) {
        console.log('   ✅ Sent successfully\n');
      } else {
        console.log('   ❌ Failed to send\n');
      }
      
      // Add a small delay between requests
      if (i < commits.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  console.log('🎉 Test webhook notifications completed!');
}

// Handle command line usage
if (require.main === module) {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: node scripts/test-webhook.js [count] [branch] [options]

Arguments:
  count     Number of recent commits to send (default: 5)
  branch    Branch name (default: Discord-Updates)

Options:
  --group   Send all commits in one webhook instead of individual ones
  --help    Show this help message

Examples:
  node scripts/test-webhook.js                    # Send last 5 commits individually
  node scripts/test-webhook.js 10                # Send last 10 commits individually  
  node scripts/test-webhook.js 5 main            # Send last 5 commits from main branch
  node scripts/test-webhook.js 3 --group         # Send last 3 commits in one grouped webhook

Environment Variables:
  GITHUB_WEBHOOK_SECRET   Required - Your GitHub webhook secret
`);
    process.exit(0);
  }

  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
} 