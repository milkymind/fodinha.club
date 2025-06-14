import { NextApiRequest, NextApiResponse } from 'next';

interface BugReportData {
  bugDescription: string;
  gameId?: string;
  playerId?: number;
  userAgent: string;
  timestamp: string;
}

interface DiscordWebhookPayload {
  embeds: Array<{
    title: string;
    description: string;
    color: number;
    fields: Array<{
      name: string;
      value: string;
      inline?: boolean;
    }>;
    footer: {
      text: string;
    };
    timestamp: string;
  }>;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Parse and validate the request body
    const bugReportData: BugReportData = req.body;

    // Validate required fields
    if (!bugReportData.bugDescription || !bugReportData.bugDescription.trim()) {
      return res.status(400).json({ error: 'Bug description is required.' });
    }

    // Get Discord webhook URL from environment variables
    const discordWebhookUrl = process.env.DISCORD_BUG_WEBHOOK_URL;
    
    if (!discordWebhookUrl) {
      console.error('DISCORD_BUG_WEBHOOK_URL environment variable is not set');
      return res.status(500).json({ error: 'Bug reporting service is not configured.' });
    }

    // Format the timestamp for better readability
    const reportTime = new Date(bugReportData.timestamp);
    const formattedTime = reportTime.toLocaleString('en-US', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    // Extract browser info from user agent
    const getBrowserInfo = (userAgent: string): string => {
      if (userAgent.includes('Chrome')) return 'Chrome';
      if (userAgent.includes('Firefox')) return 'Firefox';
      if (userAgent.includes('Safari')) return 'Safari';
      if (userAgent.includes('Edge')) return 'Edge';
      return 'Unknown';
    };

    const browserInfo = getBrowserInfo(bugReportData.userAgent);

    // Construct Discord embed payload
    const discordPayload: DiscordWebhookPayload = {
      embeds: [
        {
          title: '🐛 New Bug Report - Fodinha Card Game',
          description: `**Bug Description:**\n${bugReportData.bugDescription}`,
          color: 0xff4444, // Red color for bug reports
          fields: [
            // Add game context if available
            ...(bugReportData.gameId ? [{
              name: '🎮 Game ID',
              value: bugReportData.gameId,
              inline: true
            }] : []),
            ...(bugReportData.playerId ? [{
              name: '👤 Player ID',
              value: bugReportData.playerId.toString(),
              inline: true
            }] : []),
            // Technical information
            {
              name: '🌐 Browser',
              value: browserInfo,
              inline: true
            },
            {
              name: '📅 Reported At',
              value: formattedTime,
              inline: false
            }
          ],
          footer: {
            text: 'Fodinha Card Game Bug Report System'
          },
          timestamp: bugReportData.timestamp
        }
      ]
    };

    // Send the bug report to Discord
    const discordResponse = await fetch(discordWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(discordPayload),
    });

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error('Discord webhook error:', {
        status: discordResponse.status,
        statusText: discordResponse.statusText,
        body: errorText
      });
      
      return res.status(500).json({ 
        error: 'Failed to send bug report to Discord. Please try again later.' 
      });
    }

    // Log successful bug report (for server monitoring)
    console.log('Bug report sent successfully:', {
      gameId: bugReportData.gameId,
      playerId: bugReportData.playerId,
      timestamp: bugReportData.timestamp,
      browser: browserInfo
    });

    // Return success response
    return res.status(200).json({ 
      success: true, 
      message: 'Bug report sent successfully. Thank you for helping us improve the game!' 
    });

  } catch (error) {
    console.error('Error processing bug report:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error. Please try again later.' 
    });
  }
} 