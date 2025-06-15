import { NextApiRequest, NextApiResponse } from 'next';
import { getAuth } from '@clerk/nextjs/server';
import { createUserProfile, getUserProfile } from '../../lib/database';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get the authenticated user from Clerk
    const { userId } = getAuth(req);
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    // Check if profile already exists
    const existingProfile = await getUserProfile(userId);
    
    if (existingProfile) {
      return res.status(200).json({ 
        message: 'Profile already exists', 
        profile: existingProfile 
      });
    }

    // Create new profile
    const newProfile = await createUserProfile({
      userId,
      username: username.trim(),
      gamesPlayed: 0,
      gamesWon: 0,
    });

    return res.status(201).json({ 
      message: 'Profile created successfully', 
      profile: newProfile 
    });

  } catch (error) {
    console.error('Error creating profile:', error);
    return res.status(500).json({ 
      error: 'Failed to create profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 