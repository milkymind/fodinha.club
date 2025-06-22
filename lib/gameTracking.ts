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
    // Ensure the user profile exists (create a stub profile if it doesn't)
    const [existingProfile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    if (!existingProfile) {
      // For guest users we may only have a temporary userId like "anonymous" or "guest_xxx"
      // Create a minimal profile so that foreign-key inserts succeed.
      await db.insert(profiles).values({
        userId,
        username: playerName || userId, // Fallback to userId if no name provided
        gamesPlayed: 0,
        gamesWon: 0,
      });
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
export async function markGameAsStarted(gameId: string) {
  try {
    await db.update(games)
      .set({
        gameStatus: 'active',
        startedAt: new Date(),
      })
      .where(eq(games.gameId, gameId));
    
    console.log(`Game ${gameId} marked as started`);
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
  isMultiplierHand: boolean;
  multiplierValue: number;
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
  handId: number;
  roundNumber: number;
}) {
  try {
    const [roundRecord] = await db.insert(gameRounds).values({
      ...roundData,
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
  roundId: number;
  playerId: number;
  userId: string;
  cardPlayed: string;
  playOrder: number;
}) {
  try {
    const [cardRecord] = await db.insert(cardPlays).values({
      ...cardData,
      playTimestamp: new Date(),
    }).returning();
    
    console.log('Recorded card play:', cardRecord);
    return cardRecord;
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
        winnerPlayerId,
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