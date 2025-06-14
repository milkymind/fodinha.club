// pages/api/github-webhook.ts
// This API route handles GitHub webhook events for push notifications.
// It verifies the incoming request's signature, parses the push event,
// and sends a formatted summary of commits to a Discord channel.

import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto'; // Node.js built-in module for cryptographic functions
import getRawBody from 'raw-body'; // Required to get the raw request body for signature verification

// Configuration for this API route: Disable default body parsing
// This is necessary because GitHub sends a signature based on the raw request body,
// and Next.js's default body parser would consume it before we can verify it.
export const config = {
  api: {
    bodyParser: false, // Disable Next.js's built-in body parser for this route
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Ensure the request method is POST, as GitHub webhooks are POST requests.
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed'); // 405 for unsupported HTTP methods
  }

  // Retrieve environment variables for security and Discord webhook URL.
  // These should be set on your Render deployment.
  const githubSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const discordWebhookUrl = process.env.DISCORD_PUSH_WEBHOOK_URL;

  // Validate that required environment variables are set.
  if (!githubSecret || !discordWebhookUrl) {
    console.error('Server configuration error: GITHUB_WEBHOOK_SECRET or DISCORD_PUSH_WEBHOOK_URL is missing.');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  // --- Signature Verification ---
  // GitHub sends an 'X-Hub-Signature-256' header. We must verify this
  // to ensure the request genuinely came from GitHub and hasn't been tampered with.

  let rawBody;
  try {
    // Get the raw request body. This is crucial for signature verification.
    rawBody = await getRawBody(req);
  } catch (error) {
    console.error('Error reading raw request body:', error);
    return res.status(400).send('Bad Request: Could not read request body.');
  }

  const signature = req.headers['x-hub-signature-256'] as string;
  // Compute the HMAC SHA256 hash of the raw body using the secret.
  const hmac = crypto.createHmac('sha256', githubSecret);
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex');

  // Compare the computed digest with the signature provided by GitHub.
  if (digest !== signature) {
    console.warn('GitHub webhook signature mismatch. Request origin is suspicious.');
    return res.status(403).send('Forbidden: Invalid signature.'); // 403 for unauthorized access
  }

  // --- Process GitHub Payload ---
  let payload: any;
  try {
    // Parse the raw body as JSON to get the GitHub event payload.
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    console.error('Error parsing JSON payload from GitHub webhook:', error);
    return res.status(400).send('Bad Request: Invalid JSON payload.');
  }

  try {
    // Extract relevant data from the GitHub push event payload.
    const { ref, pusher, repository, commits } = payload;
    // Extract the branch name (e.g., "refs/heads/main" -> "main").
    const branch = ref.split('/').pop();
    const repoName = repository.name;

    let commitSummary = '';
    // Format the commit messages into a readable summary for Discord.
    if (commits && commits.length > 0) {
      commitSummary = commits.map((commit: any) => {
        const commitHash = commit.id.substring(0, 7); // Shorten commit hash for brevity
        // Use the first line of the commit message for the summary.
        const firstLineMessage = commit.message.split('\n')[0];
        // Format with Discord Markdown: [hash](url) message - by author
        return `• [\`${commitHash}\`](${commit.url}) ${firstLineMessage} - by **${commit.author.name}**`;
      }).join('\n'); // Join multiple commits with newlines
    } else {
      commitSummary = 'No new commits.'; // In case of a push with no commits (e.g., tag creation)
    }

    // --- Construct Discord Message ---
    // Create a rich Discord embed message.
    const discordMessage = {
      username: 'GitHub Update Bot', // Name displayed for the webhook in Discord
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/25/25231.png', // URL for GitHub Octocat icon
      embeds: [
        {
          title: `🚀 Repository Update: \`${repoName}\` (\`${branch}\`)`, // Bold repo name and branch
          description: `**Pushed by:** ${pusher.name}\n\n**Commit Summary:**\n${commitSummary}`,
          color: 5814783, // A pleasant blue-green color (decimal value for hex #5865F2)
          timestamp: new Date().toISOString(), // Current time of the push
          footer: {
            text: 'Automated GitHub Notification',
            icon_url: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png',
          },
          url: repository.html_url, // Link to the repository on GitHub
        },
      ],
    };

    // --- Send to Discord ---
    const discordResponse = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordMessage),
    });

    // Check if Discord webhook call was successful.
    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error(`Failed to send Discord message: ${discordResponse.status} - ${errorText}`);
      return res.status(500).json({ message: 'Failed to send Discord notification.' });
    }

    // Respond to GitHub that the webhook was successfully processed.
    return res.status(200).json({ message: 'GitHub push event received and Discord notification sent.' });

  } catch (error) {
    // Catch any unexpected errors during payload processing or Discord sending.
    console.error('Error processing GitHub webhook event:', error);
    return res.status(500).json({ message: 'Internal server error processing webhook.' });
  }
} 