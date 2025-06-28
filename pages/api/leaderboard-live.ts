import type { NextApiRequest, NextApiResponse } from 'next';
import { getLeaderboard, getWinPercentageLeaderboard, calculatePlayerMetrics } from '../../lib/metricsCalculation';
import { db } from '../../lib/db';
import { playerStats, profiles } from '../../lib/schema';
import { eq, and, sql, desc } from 'drizzle-orm';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ status: 'error', error: 'Method not allowed' });
  }

  try {
    const { 
      metric = 'winPercentage', 
      limit = '10',
      refresh = 'false',
      format = 'standard'
    } = req.query;

    // Validate parameters
    const validMetrics = [
      'winPercentage',
      'perfectPredictionRate',
      'avgBetAccuracyScore', 
      'avgSurvivalRate',
      'multiplierEfficiency',
      'lastPlayerWinRate',
      'highPressureAccuracy'
    ];

    if (!validMetrics.includes(metric as string)) {
      return res.status(400).json({
        status: 'error',
        error: `Invalid metric. Must be one of: ${validMetrics.join(', ')}`
      });
    }

    const limitNum = parseInt(limit as string);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        status: 'error',
        error: 'Limit must be a number between 1 and 100'
      });
    }

    // If refresh requested, recalculate metrics for all users
    if (refresh === 'true') {
      console.log('Refreshing leaderboard metrics...');
      // Only refresh for authenticated users (exclude guests)
      const authenticatedUsers = await db.select({ userId: profiles.userId })
        .from(profiles)
        .where(and(
          sql`${profiles.userId} NOT LIKE 'guest_%'`,
          sql`${profiles.userId} != 'anonymous'`
        ));

      for (const user of authenticatedUsers) {
        try {
          await calculatePlayerMetrics(user.userId);
        } catch (error) {
          console.error(`Failed to refresh metrics for user ${user.userId}:`, error);
        }
      }
    }

    // Get leaderboard data
    let leaderboard;
    if (metric === 'winPercentage') {
      leaderboard = await getWinPercentageLeaderboard(limitNum);
    } else {
      leaderboard = await getLeaderboard(
        metric as 'perfectPredictionRate' | 'avgBetAccuracyScore' | 'avgSurvivalRate' | 'multiplierEfficiency' | 'lastPlayerWinRate' | 'highPressureAccuracy',
        limitNum
      );
    }

    // Get additional statistics for comprehensive view
    const totalPlayers = await db.select({ count: sql`count(*)` })
      .from(profiles)
      .where(and(
        sql`${profiles.userId} NOT LIKE 'guest_%'`,
        sql`${profiles.userId} != 'anonymous'`,
        sql`${profiles.gamesPlayed} > 0`
      ));

    const metricDescriptions = {
      winPercentage: {
        name: 'Win Percentage',
        description: 'Percentage of games won',
        unit: '%',
        betterWhen: 'higher'
      },
      perfectPredictionRate: {
        name: 'Perfect Prediction Rate',
        description: 'Percentage of bets that exactly matched tricks won',
        unit: '%',
        betterWhen: 'higher'
      },
      avgBetAccuracyScore: {
        name: 'Bet Accuracy Score',
        description: 'Average difference between predicted and actual tricks (lower is better)',
        unit: 'points',
        betterWhen: 'lower'
      },
      avgSurvivalRate: {
        name: 'Survival Rate',
        description: 'Percentage of initial lives retained on average',
        unit: '%',
        betterWhen: 'higher'
      },
      multiplierEfficiency: {
        name: 'Multiplier Efficiency',
        description: 'Performance during tied rounds (multiplier situations)',
        unit: '%',
        betterWhen: 'higher'
      },
      lastPlayerWinRate: {
        name: 'Last Player Performance',
        description: 'Success rate when betting last (with constraint rule)',
        unit: '%',
        betterWhen: 'higher'
      },
      highPressureAccuracy: {
        name: 'High-Pressure Accuracy',
        description: 'Betting accuracy when down to 1-2 lives',
        unit: '%',
        betterWhen: 'higher'
      }
    };

    // Format response based on requested format
    if (format === 'comprehensive') {
      return res.status(200).json({
        status: 'success',
        leaderboard: {
          metric: metric,
          metricInfo: metricDescriptions[metric as keyof typeof metricDescriptions],
          totalPlayers: totalPlayers[0]?.count || 0,
          lastUpdated: new Date().toISOString(),
          rankings: leaderboard.map((entry, index) => ({
            rank: index + 1,
            username: entry.username,
            value: parseFloat(typeof entry.metricValue === 'string' ? entry.metricValue || '0' : (entry.metricValue || 0).toString()),
            gamesPlayed: 'gamesPlayed' in entry ? entry.gamesPlayed : entry.totalGamesPlayed,
            lastCalculated: 'lastCalculatedAt' in entry ? entry.lastCalculatedAt : null,
            percentile: Math.round(((limitNum - index) / limitNum) * 100)
          }))
        }
      });
    }

    // Standard format (backward compatible)
    return res.status(200).json({
      status: 'success',
      metric: metric,
      description: metricDescriptions[metric as keyof typeof metricDescriptions].name,
      totalPlayers: totalPlayers[0]?.count || 0,
      leaderboard: leaderboard.map((entry, index) => ({
        rank: index + 1,
        username: entry.username,
        value: entry.metricValue,
        gamesPlayed: 'gamesPlayed' in entry ? entry.gamesPlayed : entry.totalGamesPlayed,
        lastUpdated: 'lastCalculatedAt' in entry ? entry.lastCalculatedAt : null
      }))
    });

  } catch (error) {
    console.error('Error in live leaderboard API:', error);
    return res.status(500).json({
      status: 'error',
      error: 'Failed to get leaderboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 