import { db } from './db';
import { 
  playerBets, 
  playerStats, 
  gameHands, 
  gameParticipants,
  games,
  profiles
} from './schema';
import { eq, and, sql, avg, count, sum } from 'drizzle-orm';

// ⚠️ CRITICAL: GUEST METRICS AGGREGATION ISSUE ⚠️
// 
// All guest players currently share userId: 'anonymous'
// This creates a "super guest" profile with combined metrics from ALL guests
// 
// Example problematic scenario:
// - Guest A: Expert player, 90% accuracy, 20 games
// - Guest B: Beginner player, 30% accuracy, 5 games  
// - Guest C: Average player, 60% accuracy, 10 games
// 
// Result: userId 'anonymous' shows ~60% accuracy, 35 games
// This makes guest metrics meaningless for individual skill assessment
//
// Impact on leaderboards: 'anonymous' may appear as top player due to 
// volume of games rather than individual skill
//
// TODO: Fix by generating unique guest IDs in API endpoints

// Calculate all metrics for a specific user
export async function calculatePlayerMetrics(userId: string): Promise<void> {
  try {
    console.log(`Calculating metrics for user ${userId}`);
    
    // ⚠️ WARNING: If userId is 'anonymous', this aggregates ALL guest data
    if (userId === 'anonymous') {
      console.warn('⚠️ Calculating metrics for userId "anonymous" - this aggregates ALL guest players!');
    }
    
    // Get all the raw data we need for calculations
    const playerData = await getPlayerRawData(userId);
    
    if (playerData.totalGames === 0) {
      console.log(`No games found for user ${userId}, skipping metrics calculation`);
      return;
    }
    
    // Calculate each metric
    const metrics = {
      // 1. Perfect Prediction Rate - percentage of bets that exactly matched tricks won
      perfectPredictionRate: calculatePerfectPredictionRate(playerData),
      
      // 2. Bet Accuracy Score - average difference between predicted and actual tricks
      avgBetAccuracyScore: calculateBetAccuracyScore(playerData),
      
      // 3. Survival Rate - average game length before elimination
      avgSurvivalRate: calculateSurvivalRate(playerData),
      
      // 4. Multiplier Efficiency - performance during tied rounds (multiplier situations)
      multiplierEfficiency: calculateMultiplierEfficiency(playerData),
      
      // 5. Last Player Performance - win rate when betting last (constraint rule)
      lastPlayerWinRate: calculateLastPlayerWinRate(playerData),
      
      // 6. High-Pressure Performance - accuracy when down to 1-2 lives
      highPressureAccuracy: calculateHighPressureAccuracy(playerData),
    };
    
    // Save the calculated metrics
    await savePlayerMetrics(userId, metrics, playerData);
    
    console.log(`Successfully calculated metrics for user ${userId}:`, metrics);
    
  } catch (error) {
    console.error(`Error calculating metrics for user ${userId}:`, error);
    throw error;
  }
}

// Get all raw data needed for metric calculations
async function getPlayerRawData(userId: string) {
  // Get all bets made by this player
  const bets = await db.select({
    betValue: playerBets.betValue,
    actualTricks: playerBets.actualTricks,
    isPerfectPrediction: playerBets.isPerfectPrediction,
    betAccuracyScore: playerBets.betAccuracyScore,
    isLastToBet: playerBets.isLastToBet,
    livesBeforeBet: playerBets.livesBeforeBet,
    handId: playerBets.handId,
  })
  .from(playerBets)
  .where(eq(playerBets.userId, userId));

  // Get all hands this player participated in
  const hands = await db.select({
    id: gameHands.id,
    gameId: gameHands.gameId,
    isMultiplierHand: gameHands.isMultiplierHand,
    multiplierValue: gameHands.multiplierValue,
    cardsPerPlayer: gameHands.cardsPerPlayer,
  })
  .from(gameHands)
  .innerJoin(playerBets, eq(gameHands.id, playerBets.handId))
  .where(eq(playerBets.userId, userId));

  // Get all games this player participated in
  const gameResults = await db.select({
    gameId: gameParticipants.gameId,
    finalPosition: gameParticipants.finalPosition,
    livesRemaining: gameParticipants.livesRemaining,
    isWinner: gameParticipants.isWinner,
    initialLives: games.initialLives,
  })
  .from(gameParticipants)
  .innerJoin(games, eq(gameParticipants.gameId, games.gameId))
  .where(eq(gameParticipants.userId, userId));

  return {
    bets,
    hands,
    gameResults,
    totalGames: gameResults.length,
    totalHands: hands.length,
    totalBets: bets.length,
  };
}

// 1. Perfect Prediction Rate - percentage of rounds where bet exactly matched tricks won
function calculatePerfectPredictionRate(data: any): number {
  const completedBets = data.bets.filter((bet: any) => bet.actualTricks !== null);
  if (completedBets.length === 0) return 0;
  
  const perfectPredictions = completedBets.filter((bet: any) => bet.isPerfectPrediction).length;
  return (perfectPredictions / completedBets.length) * 100;
}

// 2. Bet Accuracy Score - average difference between predicted and actual tricks won
function calculateBetAccuracyScore(data: any): number {
  const completedBets = data.bets.filter((bet: any) => bet.actualTricks !== null && bet.betAccuracyScore !== null);
  if (completedBets.length === 0) return 0;
  
  const totalAccuracyScore = completedBets.reduce((sum: number, bet: any) => sum + bet.betAccuracyScore, 0);
  return totalAccuracyScore / completedBets.length;
}

// 3. Survival Rate - average game length before elimination (normalized)
function calculateSurvivalRate(data: any): number {
  if (data.gameResults.length === 0) return 0;
  
  // Calculate survival as percentage of initial lives retained
  let totalSurvivalRate = 0;
  
  for (const game of data.gameResults) {
    const initialLives = game.initialLives || 3;
    const livesRemaining = game.livesRemaining || 0;
    const survivalRate = (livesRemaining / initialLives) * 100;
    totalSurvivalRate += survivalRate;
  }
  
  return totalSurvivalRate / data.gameResults.length;
}

// 4. Multiplier Efficiency - performance during tied rounds (multiplier situations)
function calculateMultiplierEfficiency(data: any): number {
  const multiplierBets = data.bets.filter((bet: any) => {
    const hand = data.hands.find((h: any) => h.id === bet.handId);
    return hand && hand.isMultiplierHand;
  });
  
  if (multiplierBets.length === 0) return 0;
  
  const perfectMultiplierPredictions = multiplierBets.filter((bet: any) => bet.isPerfectPrediction).length;
  return (perfectMultiplierPredictions / multiplierBets.length) * 100;
}

// 5. Last Player Performance - win rate when betting last (constraint rule)
function calculateLastPlayerWinRate(data: any): number {
  const lastPlayerBets = data.bets.filter((bet: any) => bet.isLastToBet);
  
  if (lastPlayerBets.length === 0) return 0;
  
  const perfectLastPlayerBets = lastPlayerBets.filter((bet: any) => bet.isPerfectPrediction).length;
  return (perfectLastPlayerBets / lastPlayerBets.length) * 100;
}

// 6. High-Pressure Performance - accuracy when down to 1-2 lives
function calculateHighPressureAccuracy(data: any): number {
  const highPressureBets = data.bets.filter((bet: any) => 
    bet.livesBeforeBet <= 2 && bet.livesBeforeBet > 0
  );
  
  if (highPressureBets.length === 0) return 0;
  
  const perfectHighPressureBets = highPressureBets.filter((bet: any) => bet.isPerfectPrediction).length;
  return (perfectHighPressureBets / highPressureBets.length) * 100;
}

// Save calculated metrics to the database
async function savePlayerMetrics(userId: string, metrics: any, rawData: any) {
  // Count supporting data
  const supportingData = {
    totalGamesPlayed: rawData.totalGames,
    totalHandsPlayed: rawData.totalHands,
    totalRoundsPlayed: rawData.totalBets, // Each bet represents a round
    totalPerfectPredictions: rawData.bets.filter((bet: any) => bet.isPerfectPrediction).length,
    totalMultiplierHands: rawData.hands.filter((hand: any) => hand.isMultiplierHand).length,
    totalLastPlayerBets: rawData.bets.filter((bet: any) => bet.isLastToBet).length,
    totalHighPressureBets: rawData.bets.filter((bet: any) => bet.livesBeforeBet <= 2 && bet.livesBeforeBet > 0).length,
  };

  // Check if stats record exists
  const existingStats = await db.select()
    .from(playerStats)
    .where(eq(playerStats.userId, userId))
    .limit(1);

  if (existingStats.length > 0) {
    // Update existing record
    await db.update(playerStats)
      .set({
        perfectPredictionRate: metrics.perfectPredictionRate.toString(),
        avgBetAccuracyScore: metrics.avgBetAccuracyScore.toString(),
        avgSurvivalRate: metrics.avgSurvivalRate.toString(),
        multiplierEfficiency: metrics.multiplierEfficiency.toString(),
        lastPlayerWinRate: metrics.lastPlayerWinRate.toString(),
        highPressureAccuracy: metrics.highPressureAccuracy.toString(),
        ...supportingData,
        lastCalculatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(playerStats.userId, userId));
  } else {
    // Create new record
    await db.insert(playerStats).values({
      userId,
      perfectPredictionRate: metrics.perfectPredictionRate.toString(),
      avgBetAccuracyScore: metrics.avgBetAccuracyScore.toString(),
      avgSurvivalRate: metrics.avgSurvivalRate.toString(),
      multiplierEfficiency: metrics.multiplierEfficiency.toString(),
      lastPlayerWinRate: metrics.lastPlayerWinRate.toString(),
      highPressureAccuracy: metrics.highPressureAccuracy.toString(),
      ...supportingData,
      lastCalculatedAt: new Date(),
    });
  }
}

// Calculate metrics for all users (batch operation)
export async function calculateAllPlayerMetrics(): Promise<void> {
  try {
    console.log('Starting batch metrics calculation for all users...');
    
    // Get all users who have played games
    const users = await db.select({ userId: playerBets.userId })
      .from(playerBets)
      .groupBy(playerBets.userId);
    
    console.log(`Found ${users.length} users with game data`);
    
    // ⚠️ WARNING: This will include 'anonymous' which aggregates ALL guest data
    const anonymousUser = users.find(u => u.userId === 'anonymous');
    if (anonymousUser) {
      console.warn('⚠️ Found "anonymous" user - this represents aggregated data from ALL guests!');
    }
    
    // Calculate metrics for each user
    for (const user of users) {
      try {
        await calculatePlayerMetrics(user.userId);
      } catch (error) {
        console.error(`Failed to calculate metrics for user ${user.userId}:`, error);
        // Continue with other users
      }
    }
    
    console.log('Completed batch metrics calculation');
    
  } catch (error) {
    console.error('Error in batch metrics calculation:', error);
    throw error;
  }
}

// Get calculated metrics for a user
export async function getPlayerMetrics(userId: string) {
  try {
    const [metrics] = await db.select()
      .from(playerStats)
      .where(eq(playerStats.userId, userId))
      .limit(1);
    
    return metrics || null;
  } catch (error) {
    console.error(`Error getting metrics for user ${userId}:`, error);
    return null;
  }
}

// Get leaderboard data for all metrics
export async function getLeaderboard(metric: 'perfectPredictionRate' | 'avgBetAccuracyScore' | 'avgSurvivalRate' | 'multiplierEfficiency' | 'lastPlayerWinRate' | 'highPressureAccuracy', limit: number = 10) {
  try {
    const orderBy = metric === 'avgBetAccuracyScore' 
      ? sql`${playerStats[metric]} ASC` // Lower is better for accuracy score
      : sql`${playerStats[metric]} DESC`; // Higher is better for others
    
    // Only include authenticated users (exclude all guest users from leaderboard)
    const leaderboard = await db.select({
      userId: playerStats.userId,
      username: profiles.username,
      metricValue: playerStats[metric],
      totalGamesPlayed: playerStats.totalGamesPlayed,
      lastCalculatedAt: playerStats.lastCalculatedAt,
    })
    .from(playerStats)
    .innerJoin(profiles, eq(playerStats.userId, profiles.userId))
    .where(and(
      sql`${playerStats[metric]} IS NOT NULL`,
      sql`${playerStats.userId} NOT LIKE 'guest_%'`, // Exclude all guest users
      sql`${playerStats.userId} != 'anonymous'` // Exclude legacy anonymous users
    ))
    .orderBy(orderBy)
    .limit(limit);
    
    return leaderboard;
  } catch (error) {
    console.error(`Error getting leaderboard for ${metric}:`, error);
    return [];
  }
} 