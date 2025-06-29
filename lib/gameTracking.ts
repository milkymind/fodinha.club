import { db } from './db';
import { 
  games, 
  gameParticipants, 
  gameHands, 
  gameRounds, 
  playerBets, 
  cardPlays,
  playerStats,
  profiles
} from './schema';
import { eq, and, sql } from 'drizzle-orm';
import { clerkClient } from '@clerk/nextjs/server';

// ⚠️ IMPORTANT: GUEST USER METRICS LIMITATION ⚠️
// Currently all guest players share the same userId: 'anonymous'
// This means all guest game data gets aggregated into a single profile
// Impact on metrics:
// - Perfect Prediction Rate: Combined across all guests
// - Bet Accuracy: Average of all guest bets combined  
// - Survival Rate: Average across all guest games
// - All other metrics: Mixed data from different guest players
// 
// To fix: Generate unique guest IDs in create-game.ts and join-game.ts
// Example: `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`

// 1. Start tracking a new game
export async function createGameRecord(gameData: {
  gameId: string;
  hostUserId: string;
  maxPlayers: number;
  initialLives: number;
  startFrom: 'one' | 'max';
}) {
  try {
    const [gameRecord] = await db.insert(games).values({
      gameId: gameData.gameId,
      hostUserId: gameData.hostUserId,
      maxPlayers: gameData.maxPlayers,
      initialLives: gameData.initialLives,
      startFrom: gameData.startFrom,
      gameStatus: 'waiting',
    }).returning();
    
    console.log('Created game record:', gameRecord);
    return gameRecord;
  } catch (error) {
    console.error('Error creating game record:', error);
    throw error;
  }
}

// 2. Add a player to a game
export async function addPlayerToGame(gameId: string, userId: string, playerId: number, playerName: string) {
  try {
    // Handle authenticated vs guest users differently
    if (userId.startsWith('guest_') || userId === 'anonymous') {
      // For guest users, create a temporary profile that won't appear in leaderboards
      const [existingProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (!existingProfile) {
        await db.insert(profiles).values({
          userId,
          username: playerName || `Guest Player`, // Use player name or fallback
          gamesPlayed: 0,
          gamesWon: 0,
        });
      }
    } else {
      // For authenticated users, ensure profile exists and auto-create if needed
      const [existingProfile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId))
        .limit(1);

      if (!existingProfile) {
        // Get Clerk user info for authenticated users
        let clerkUsername = playerName; // fallback to player name
        try {
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(userId);
          clerkUsername = clerkUser.firstName || clerkUser.username || playerName || 'New Player';
        } catch (error) {
          console.error(`Failed to get Clerk user info for ${userId}:`, error);
          // Continue with fallback username
        }

        // Auto-create profile for authenticated user with Clerk username
        await db.insert(profiles).values({
          userId,
          username: clerkUsername, // Use Clerk username instead of game username
          gamesPlayed: 0,
          gamesWon: 0,
        });
        console.log(`Auto-created profile for authenticated user ${userId} with username: ${clerkUsername}`);
      } else {
        // Update existing profile with current Clerk username if it's different
        try {
          const client = await clerkClient();
          const clerkUser = await client.users.getUser(userId);
          const clerkUsername = clerkUser.firstName || clerkUser.username || existingProfile.username;
          
          if (clerkUsername !== existingProfile.username) {
            await db.update(profiles)
              .set({
                username: clerkUsername,
                updatedAt: new Date(),
              })
              .where(eq(profiles.userId, userId));
            console.log(`Updated profile username for ${userId} to: ${clerkUsername}`);
          }
        } catch (error) {
          console.error(`Failed to update username for ${userId}:`, error);
          // Continue without updating username
        }
      }
    }

    const [participant] = await db.insert(gameParticipants).values({
      gameId,
      userId,
      playerId,
      playerName,
    }).returning();

    console.log('Added player to game:', participant);
    return participant;
  } catch (error) {
    console.error('Error adding player to game:', error);
    throw error;
  }
}

// 3. Mark game as started
export async function markGameAsStarted(gameId: string, firstHandData?: {
  handNumber: number;
  cardsPerPlayer: number;
  dealerPlayerId: number;
  middleCard?: string;
  manilha: string;
}) {
  try {
    await db.update(games)
      .set({
        gameStatus: 'active',
        startedAt: new Date(),
      })
      .where(eq(games.gameId, gameId));
    
    console.log(`Game ${gameId} marked as started`);
    
    // Create the first hand record if provided
    if (firstHandData) {
      const handRecord = await createHandRecord({
        gameId,
        ...firstHandData,
        totalBets: 0, // Will be updated when all bets are placed
      });
      console.log(`Created first hand record for game ${gameId}:`, handRecord);
      return handRecord;
    }
  } catch (error) {
    console.error('Error marking game as started:', error);
    throw error;
  }
}

// 4. Start a new hand
export async function createHandRecord(handData: {
  gameId: string;
  handNumber: number;
  cardsPerPlayer: number;
  dealerPlayerId: number;
  middleCard?: string;
  manilha: string;
  totalBets: number;
}) {
  try {
    const [handRecord] = await db.insert(gameHands).values({
      ...handData,
      startedAt: new Date(),
    }).returning();
    
    console.log('Created hand record:', handRecord);
    return handRecord;
  } catch (error) {
    console.error('Error creating hand record:', error);
    throw error;
  }
}

// 5. Record a player's bet
export async function recordPlayerBet(betData: {
  gameId: string;
  handId: number;
  playerId: number;
  userId: string;
  betValue: number;
  isLastToBet: boolean;
  livesBeforeBet: number;
}) {
  try {
    const [betRecord] = await db.insert(playerBets).values({
      ...betData,
      betTimestamp: new Date(),
    }).returning();
    
    console.log('Recorded player bet:', betRecord);
    return betRecord;
  } catch (error) {
    console.error('Error recording player bet:', error);
    throw error;
  }
}

// 6. Start a new round
export async function createRoundRecord(roundData: {
  gameId: string;
  handId: number;
  roundNumber: number;
  multiplierValue?: number;
  isMultiplierRound?: boolean;
}) {
  try {
    const [roundRecord] = await db.insert(gameRounds).values({
      ...roundData,
      multiplierValue: roundData.multiplierValue || 1,
      isMultiplierRound: roundData.isMultiplierRound || false,
      startedAt: new Date(),
    }).returning();
    
    console.log('Created round record:', roundRecord);
    return roundRecord;
  } catch (error) {
    console.error('Error creating round record:', error);
    throw error;
  }
}

// 7. Record a card play
export async function recordCardPlay(cardData: {
  gameId: string;
  handId: number;
  roundId: number;
  playerId: number;
  userId: string;
  cardPlayed: string;
  playOrder: number;
  isWinningCard?: boolean;
}) {
  try {
    const [cardPlayRecord] = await db.insert(cardPlays).values({
      ...cardData,
      isWinningCard: cardData.isWinningCard || false,
      playTimestamp: new Date(),
    }).returning();
    
    console.log('Recorded card play:', cardPlayRecord);
    return cardPlayRecord;
  } catch (error) {
    console.error('Error recording card play:', error);
    throw error;
  }
}

// 8. Complete a round (mark winner)
export async function completeRound(roundId: number, winnerPlayerId: number, winningCard: string) {
  try {
    // Update the round with winner info
    await db.update(gameRounds)
      .set({
        winnerPlayerId: winnerPlayerId.toString(), // Convert to string to match new schema
        winningCard,
        completedAt: new Date(),
      })
      .where(eq(gameRounds.id, roundId));

    // Mark the winning card in card_plays
    await db.update(cardPlays)
      .set({ isWinningCard: true })
      .where(and(
        eq(cardPlays.roundId, roundId),
        eq(cardPlays.cardPlayed, winningCard)
      ));

    console.log(`Round ${roundId} completed, winner: ${winnerPlayerId}`);
  } catch (error) {
    console.error('Error completing round:', error);
    throw error;
  }
}

// 8b. Complete a tied round (mark as TIED)
export async function completeTiedRound(roundId: number) {
  try {
    // Update the round with TIED info
    await db.update(gameRounds)
      .set({
        winnerPlayerId: 'TIED', // Show "TIED" instead of null for tied rounds
        winningCard: 'TIED',
        completedAt: new Date(),
      })
      .where(eq(gameRounds.id, roundId));

    console.log(`Tied round ${roundId} completed and marked as TIED`);
  } catch (error) {
    console.error('Error completing tied round:', error);
    throw error;
  }
}

// 9. Complete a hand (calculate bet accuracy)
export async function completeHand(handId: number, tricksWonByPlayer: { [playerId: number]: number }) {
  try {
    // Update hand completion time
    await db.update(gameHands)
      .set({ completedAt: new Date() })
      .where(eq(gameHands.id, handId));

    // Update all bets with actual tricks and calculate accuracy
    for (const [playerId, actualTricks] of Object.entries(tricksWonByPlayer)) {
      const playerIdNum = parseInt(playerId);
      
      // Get the bet for this player
      const [betRecord] = await db.select()
        .from(playerBets)
        .where(and(
          eq(playerBets.handId, handId),
          eq(playerBets.playerId, playerIdNum)
        ));

      if (betRecord) {
        const isPerfectPrediction = betRecord.betValue === actualTricks;
        const betAccuracyScore = Math.abs(betRecord.betValue - actualTricks);

        await db.update(playerBets)
          .set({
            actualTricks,
            isPerfectPrediction,
            betAccuracyScore,
          })
          .where(eq(playerBets.id, betRecord.id));
      }
    }

    console.log(`Hand ${handId} completed with tricks:`, tricksWonByPlayer);
  } catch (error) {
    console.error('Error completing hand:', error);
    throw error;
  }
}

// 10. Complete a game
export async function completeGame(gameId: string, finalResults: {
  playerId: number;
  userId: string;
  finalPosition: number;
  livesRemaining: number;
  isWinner: boolean;
}[]) {
  try {
    // Update game status
    await db.update(games)
      .set({
        gameStatus: 'completed',
        completedAt: new Date(),
      })
      .where(eq(games.gameId, gameId));

    // Update all participants with final results
    for (const result of finalResults) {
      await db.update(gameParticipants)
        .set({
          finalPosition: result.finalPosition,
          livesRemaining: result.livesRemaining,
          isWinner: result.isWinner,
          eliminatedAt: result.livesRemaining === 0 ? new Date() : null,
        })
        .where(and(
          eq(gameParticipants.gameId, gameId),
          eq(gameParticipants.playerId, result.playerId)
        ));
    }

    // Update profiles with games played and games won for authenticated users only
    for (const result of finalResults) {
      // Skip guest users (they start with 'guest_' or are 'anonymous')
      if (result.userId.startsWith('guest_') || result.userId === 'anonymous') {
        continue;
      }

      try {
        // Increment games played for all authenticated users
        await db.update(profiles)
          .set({
            gamesPlayed: sql`${profiles.gamesPlayed} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(profiles.userId, result.userId));

        // Increment games won for winners only
        if (result.isWinner) {
          await db.update(profiles)
            .set({
              gamesWon: sql`${profiles.gamesWon} + 1`,
              updatedAt: new Date(),
            })
            .where(eq(profiles.userId, result.userId));
        }
      } catch (error) {
        console.error(`Error updating profile for user ${result.userId}:`, error);
        // Continue with other users even if one fails
      }
    }

    // Calculate player statistics for all authenticated participants
    console.log('Triggering metrics calculation for game participants...');
    for (const result of finalResults) {
      // Skip guest users for metrics calculation
      if (result.userId.startsWith('guest_') || result.userId === 'anonymous') {
        continue;
      }

      try {
        // Import the metrics calculation function dynamically to avoid circular imports
        const { calculatePlayerMetrics } = await import('./metricsCalculation');
        await calculatePlayerMetrics(result.userId);
        console.log(`Metrics calculated for user ${result.userId}`);
      } catch (error) {
        console.error(`Error calculating metrics for user ${result.userId}:`, error);
        // Continue with other users even if one fails
      }
    }

    console.log(`Game ${gameId} completed with results:`, finalResults);
  } catch (error) {
    console.error('Error completing game:', error);
    throw error;
  }
}

// 11. Get current hand ID for a game (helper function)
export async function getCurrentHandId(gameId: string): Promise<number | null> {
  try {
    const [currentHand] = await db.select()
      .from(gameHands)
      .where(and(
        eq(gameHands.gameId, gameId),
        sql`${gameHands.completedAt} IS NULL`
      ))
      .orderBy(gameHands.handNumber)
      .limit(1);

    return currentHand?.id || null;
  } catch (error) {
    console.error('Error getting current hand ID:', error);
    return null;
  }
}

// 12. Get current round ID for a hand (helper function)
export async function getCurrentRoundId(handId: number): Promise<number | null> {
  try {
    const [currentRound] = await db.select()
      .from(gameRounds)
      .where(and(
        eq(gameRounds.handId, handId),
        sql`${gameRounds.completedAt} IS NULL`
      ))
      .orderBy(gameRounds.roundNumber)
      .limit(1);

    return currentRound?.id || null;
  } catch (error) {
    console.error('Error getting current round ID:', error);
    return null;
  }
}

// 13. Get user ID from game participant (helper function)
export async function getUserIdFromGame(gameId: string, playerId: number): Promise<string | null> {
  try {
    const [participant] = await db.select()
      .from(gameParticipants)
      .where(and(
        eq(gameParticipants.gameId, gameId),
        eq(gameParticipants.playerId, playerId)
      ))
      .limit(1);

    return participant?.userId || null;
  } catch (error) {
    console.error('Error getting user ID from game:', error);
    return null;
  }
}

// 14. Check if user can reconnect to a game
export async function canUserReconnect(userId: string, gameId: string): Promise<{
  canReconnect: boolean;
  participant?: any;
  gameStatus?: string;
}> {
  try {
    // Get game info
    const [game] = await db.select()
      .from(games)
      .where(eq(games.gameId, gameId))
      .limit(1);

    if (!game || game.gameStatus === 'completed') {
      return { canReconnect: false };
    }

    // Check if user was a participant
    const [participant] = await db.select()
      .from(gameParticipants)
      .where(and(
        eq(gameParticipants.gameId, gameId),
        eq(gameParticipants.userId, userId)
      ))
      .limit(1);

    if (!participant) {
      return { canReconnect: false };
    }

    // User can reconnect if:
    // 1. Game is still active
    // 2. User was a participant
    // 3. User wasn't eliminated (has lives remaining or game just started)
    const canReconnect = game.gameStatus === 'active' && 
                        (participant.livesRemaining === null || participant.livesRemaining > 0);

    return {
      canReconnect,
      participant,
      gameStatus: game.gameStatus
    };
  } catch (error) {
    console.error('Error checking reconnection eligibility:', error);
    return { canReconnect: false };
  }
}

// 15. Mark player as disconnected (but don't remove from game)
export async function markPlayerDisconnected(gameId: string, userId: string) {
  try {
    await db.update(gameParticipants)
      .set({
        disconnectedAt: new Date(),
        isConnected: false
      })
      .where(and(
        eq(gameParticipants.gameId, gameId),
        eq(gameParticipants.userId, userId)
      ));
    
    console.log(`Marked player ${userId} as disconnected from game ${gameId}`);
  } catch (error) {
    console.error('Error marking player as disconnected:', error);
  }
}

// 16. Mark player as reconnected
export async function markPlayerReconnected(gameId: string, userId: string) {
  try {
    await db.update(gameParticipants)
      .set({
        reconnectedAt: new Date(),
        isConnected: true
      })
      .where(and(
        eq(gameParticipants.gameId, gameId),
        eq(gameParticipants.userId, userId)
      ));
    
    console.log(`Marked player ${userId} as reconnected to game ${gameId}`);
  } catch (error) {
    console.error('Error marking player as reconnected:', error);
  }
}

// 17. Get active games for a user (for reconnection UI)
export async function getActiveGamesForUser(userId: string) {
  try {
    const activeGames = await db.select({
      gameId: games.gameId,
      gameStatus: games.gameStatus,
      startedAt: games.startedAt,
      playerId: gameParticipants.playerId,
      playerName: gameParticipants.playerName,
      livesRemaining: gameParticipants.livesRemaining,
      isConnected: gameParticipants.isConnected
    })
    .from(gameParticipants)
    .innerJoin(games, eq(gameParticipants.gameId, games.gameId))
    .where(and(
      eq(gameParticipants.userId, userId),
      eq(games.gameStatus, 'active'),
      // Only include if player has lives or game just started
      sql`(${gameParticipants.livesRemaining} IS NULL OR ${gameParticipants.livesRemaining} > 0)`
    ));

    return activeGames;
  } catch (error) {
    console.error('Error getting active games for user:', error);
    return [];
  }
}

// Update hand total bets when all bets are complete
export async function updateHandTotalBets(handId: number, totalBets: number) {
  try {
    await db.update(gameHands)
      .set({ totalBets })
      .where(eq(gameHands.id, handId));
    
    console.log(`Updated hand ${handId} total bets: ${totalBets}`);
  } catch (error) {
    console.error('Error updating hand total bets:', error);
    throw error;
  }
}

// Auto-create or update user profile (should be called on any user access)
export async function ensureUserProfile(userId: string): Promise<any> {
  try {
    if (userId === 'anonymous' || userId.startsWith('guest_')) {
      // Skip profile creation for anonymous/guest users
      return null;
    }

    // Check if profile already exists
    const [existingProfile] = await db.select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!existingProfile) {
      // Create new profile with Clerk username
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const clerkUsername = clerkUser.firstName || clerkUser.username || `User ${userId.slice(-4)}`;
        
        const [newProfile] = await db.insert(profiles).values({
          userId,
          username: clerkUsername,
          gamesPlayed: 0,
          gamesWon: 0,
        }).returning();
        
        console.log(`Auto-created profile for user ${userId} with username: ${clerkUsername}`);
        return newProfile;
      } catch (error) {
        console.error(`Failed to get Clerk user data for ${userId}:`, error);
        // Fallback to a generic username
        const [newProfile] = await db.insert(profiles).values({
          userId,
          username: `User ${userId.slice(-4)}`,
          gamesPlayed: 0,
          gamesWon: 0,
        }).returning();
        
        console.log(`Auto-created profile for user ${userId} with fallback username`);
        return newProfile;
      }
    } else {
      // Update existing profile with current Clerk username if needed
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(userId);
        const clerkUsername = clerkUser.firstName || clerkUser.username || existingProfile.username;
        
        if (clerkUsername !== existingProfile.username) {
          await db.update(profiles)
            .set({
              username: clerkUsername,
              updatedAt: new Date(),
            })
            .where(eq(profiles.userId, userId));
          console.log(`Updated profile username for ${userId} to: ${clerkUsername}`);
        }
      } catch (error) {
        console.error(`Failed to update username for ${userId}:`, error);
        // Continue without updating username
      }
      
      return existingProfile;
    }
  } catch (error) {
    console.error('Error ensuring user profile:', error);
    return null;
  }
} 