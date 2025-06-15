import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { getUserProfile } from '../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authenticated user from Clerk
    const { userId } = getAuth(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get user profile
    const profile = await getUserProfile(userId);

    return res.status(200).json({ 
      hasProfile: !!profile,
      profile: profile || null 
    });

  } catch (error) {
    console.error('Error getting profile:', error);
    return res.status(500).json({ 
      error: 'Failed to get profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 