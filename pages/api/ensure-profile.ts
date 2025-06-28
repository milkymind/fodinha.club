import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { ensureUserProfile } from '../../lib/gameTracking';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Ensure user profile exists and is up to date
    const profile = await ensureUserProfile(userId);
    
    if (profile) {
      return res.status(200).json({ 
        success: true, 
        profile,
        message: 'Profile ensured successfully' 
      });
    } else {
      return res.status(200).json({ 
        success: true, 
        profile: null,
        message: 'Profile creation skipped (guest user)' 
      });
    }
  } catch (error) {
    console.error('Error ensuring profile:', error);
    return res.status(500).json({ 
      error: 'Failed to ensure profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 