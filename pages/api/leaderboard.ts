import type { NextApiRequest, NextApiResponse } from 'next';
import { getLeaderboard } from '../../lib/metricsCalculation';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  try {
    const { metric, limit } = req.query;

    // Validate metric parameter
    const validMetrics = [
      'perfectPredictionRate',
      'avgBetAccuracyScore', 
      'avgSurvivalRate',
      'multiplierEfficiency',
      'lastPlayerWinRate',
      'highPressureAccuracy'
    ];

    if (!metric || !validMetrics.includes(metric as string)) {
      return res.status(400).json({
        status: 'error',
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`
      });
    }

    // Parse limit parameter
    const limitNum = limit ? parseInt(limit as string) : 10;
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        status: 'error',
        error: 'Limit must be a number between 1 and 100'
      });
    }

    // Get leaderboard data
    const leaderboard = await getLeaderboard(
      metric as 'perfectPredictionRate' | 'avgBetAccuracyScore' | 'avgSurvivalRate' | 'multiplierEfficiency' | 'lastPlayerWinRate' | 'highPressureAccuracy',
      limitNum
    );

    // Format the response with metric descriptions
    const metricDescriptions = {
      perfectPredictionRate: 'Perfect Prediction Rate (%)',
      avgBetAccuracyScore: 'Bet Accuracy Score (lower is better)',
      avgSurvivalRate: 'Survival Rate (%)',
      multiplierEfficiency: 'Multiplier Efficiency (%)',
      lastPlayerWinRate: 'Last Player Performance (%)',
      highPressureAccuracy: 'High-Pressure Accuracy (%)'
    };

    return res.status(200).json({
      status: 'success',
      metric: metric,
      description: metricDescriptions[metric as keyof typeof metricDescriptions],
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        username: entry.username,
        value: entry.metricValue,
        gamesPlayed: entry.totalGamesPlayed,
        lastUpdated: entry.lastCalculatedAt
      }))
    });

  } catch (error) {
    console.error('Error in leaderboard API:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to get leaderboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 