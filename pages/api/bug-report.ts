import { NextApiRequest, NextApiResponse } from 'next';

interface BugReport {
  description: string;
  contactInfo?: string;
  gameId?: string;
  playerId?: number;
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
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    const { description, contactInfo, gameId, playerId, timestamp }: BugReport = req.body;

    // Validate required fields
    if (!description || !description.trim()) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Bug description is required' 
      });
    }

    // Log to console for server monitoring
    console.log('🐛 Bug Report Received:', {
      description: description.trim(),
      contactInfo: contactInfo?.trim() || 'Not provided',
      gameId: gameId || 'N/A',
      playerId: playerId || 'N/A',
      timestamp: timestamp,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });

    // Send Discord notification if webhook URL is configured
    const discordWebhookUrl = process.env.DISCORD_BUG_WEBHOOK_URL;
    
    if (discordWebhookUrl && discordWebhookUrl !== 'your_discord_webhook_url_here' && discordWebhookUrl.startsWith('https://')) {
      try {
        // Format the timestamp for better readability
        const reportTime = new Date(timestamp);
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

        const browserInfo = getBrowserInfo(req.headers['user-agent'] || '');

        // Construct Discord embed payload
        const discordPayload: DiscordWebhookPayload = {
          embeds: [
            {
              title: '🐛 New Bug Report - Fodinha Card Game',
              description: `**Bug Description:**\n${description.trim()}`,
              color: 0xff4444, // Red color for bug reports
              fields: [
                // Add contact info if provided
                ...(contactInfo?.trim() ? [{
                  name: '📧 Contact Info',
                  value: contactInfo.trim(),
                  inline: false
                }] : []),
                // Add game context if available
                ...(gameId ? [{
                  name: '🎮 Game ID',
                  value: gameId,
                  inline: true
                }] : []),
                ...(playerId ? [{
                  name: '👤 Player ID',
                  value: playerId.toString(),
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
              timestamp: timestamp
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

        if (discordResponse.ok) {
          console.log('✅ Bug report sent to Discord successfully');
        } else {
          const errorText = await discordResponse.text();
          console.error('❌ Discord webhook error:', {
            status: discordResponse.status,
            statusText: discordResponse.statusText,
            body: errorText
          });
        }
      } catch (discordError) {
        console.error('❌ Error sending to Discord:', discordError);
        // Don't fail the entire request if Discord fails
      }
    } else {
      console.log('ℹ️ Discord webhook URL not configured - bug report logged to console only');
    }

    return res.status(200).json({ 
      status: 'success', 
      message: 'Bug report submitted successfully',
      reportId: `BUG-${Date.now()}` // Generate a simple report ID
    });
    
  } catch (error) {
    console.error('Error processing bug report:', error);
    return res.status(500).json({ 
      status: 'error', 
      message: 'Internal server error' 
    });
  }
} 