import { NextApiRequest, NextApiResponse } from 'next';

interface BugReport {
  description: string;
  contactInfo?: string;
  gameId?: string;
  playerId?: number;
  timestamp: string;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
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

    // In a real application, you would:
    // 1. Save to database
    // 2. Send email notification
    // 3. Create a ticket in your bug tracking system
    // 4. Log the bug report

    // For now, we'll just log it to the console
    console.log('🐛 Bug Report Received:', {
      description: description.trim(),
      contactInfo: contactInfo?.trim() || 'Not provided',
      gameId: gameId || 'N/A',
      playerId: playerId || 'N/A',
      timestamp: timestamp,
      userAgent: req.headers['user-agent'],
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
    });

    // You could also save to a file or database here
    // Example: appendToFile('bug-reports.log', JSON.stringify(bugReport))

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