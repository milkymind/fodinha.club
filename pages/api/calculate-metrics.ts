import type { NextApiRequest, NextApiResponse } from 'next';
import { calculatePlayerMetrics, calculateAllPlayerMetrics, getPlayerMetrics } from '../../lib/metricsCalculation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  try {
    const { userId, action } = req.body;

    if (action === 'calculate-all') {
      // Calculate metrics for all users (batch operation)
      console.log('Starting batch metrics calculation...');
      await calculateAllPlayerMetrics();
      
      return res.status(200).json({
        status: 'success',
        message: 'Metrics calculated for all users'
      });
    }

    if (action === 'calculate-user' && userId) {
      // Calculate metrics for a specific user
      console.log(`Calculating metrics for user: ${userId}`);
      await calculatePlayerMetrics(userId);
      
      // Get the calculated metrics to return
      const metrics = await getPlayerMetrics(userId);
      
      return res.status(200).json({
        status: 'success',
        message: `Metrics calculated for user ${userId}`,
        metrics
      });
    }

    if (action === 'get-user' && userId) {
      // Just get existing metrics for a user
      const metrics = await getPlayerMetrics(userId);
      
      if (!metrics) {
        return res.status(404).json({
          status: 'error',
          error: 'No metrics found for this user'
        });
      }
      
      return res.status(200).json({
        status: 'success',
        metrics
      });
    }

    return res.status(400).json({
      status: 'error',
      error: 'Invalid action or missing userId. Use action: "calculate-all", "calculate-user", or "get-user"'
    });

  } catch (error) {
    console.error('Error in metrics calculation API:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to calculate metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 