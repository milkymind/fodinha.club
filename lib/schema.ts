// User Profile Types for Fodinha Card Game
// This defines the structure for user profiles without payment/membership features

export interface UserProfile {
    userId: string;           // Clerk user ID (primary key)
    username: string;         // Display name for the user
    gamesPlayed: number;      // Total number of games played
    gamesWon: number;         // Total number of games won
    createdAt: Date;          // When the profile was created
    updatedAt: Date;          // When the profile was last updated
}

// For creating new profiles (some fields optional/auto-generated)
export interface CreateUserProfile {
    userId: string;
    username: string;
    gamesPlayed?: number;     // Optional, defaults to 0
    gamesWon?: number;        // Optional, defaults to 0
}

// For updating existing profiles (all fields optional except userId)
export interface UpdateUserProfile {
    userId: string;
    username?: string;
    gamesPlayed?: number;
    gamesWon?: number;
    updatedAt?: Date;
}

// Drizzle ORM Schema
import { pgTable, text, timestamp, integer, serial, boolean, numeric } from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
    userId: text("user_id").primaryKey().notNull(), 
    username: text("username").notNull(),
    gamesPlayed: integer("games_played").notNull().default(0),
    gamesWon: integer("games_won").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

// Games table - stores overall game information
export const games = pgTable("games", {
  gameId: text("game_id").primaryKey().notNull(),
  hostUserId: text("host_user_id").notNull(),
  maxPlayers: integer("max_players").notNull(),
  initialLives: integer("initial_lives").notNull(),
  startFrom: text("start_from").notNull(), // 'one' or 'max'
  gameStatus: text("game_status").notNull(), // 'waiting', 'active', 'completed'
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Game participants - links users to games
export const gameParticipants = pgTable("game_participants", {
  id: serial("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.gameId),
  userId: text("user_id").notNull().references(() => profiles.userId),
  playerId: integer("player_id").notNull(), // The in-game player ID (1, 2, 3, etc.)
  playerName: text("player_name").notNull(), // Name used in this specific game
  finalPosition: integer("final_position"), // 1st, 2nd, 3rd place etc. (null if game not finished)
  livesRemaining: integer("lives_remaining"), // Lives left when eliminated (or at game end)
  isWinner: boolean("is_winner").default(false),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  eliminatedAt: timestamp("eliminated_at"),
});

// Hands table - stores each hand within a game
export const gameHands = pgTable("game_hands", {
  id: serial("id").primaryKey(),
  gameId: text("game_id").notNull().references(() => games.gameId),
  handNumber: integer("hand_number").notNull(), // 1, 2, 3, etc.
  cardsPerPlayer: integer("cards_per_player").notNull(), // How many cards each player had
  dealerPlayerId: integer("dealer_player_id").notNull(),
  middleCard: text("middle_card"), // The card that determines manilha
  manilha: text("manilha").notNull(), // The manilha value for this hand
  totalBets: integer("total_bets").notNull(), // Sum of all player bets
  isMultiplierHand: boolean("is_multiplier_hand").default(false), // If bets matched cards
  multiplierValue: integer("multiplier_value").default(1),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Rounds table - stores each round within a hand
export const gameRounds = pgTable("game_rounds", {
  id: serial("id").primaryKey(),
  handId: integer("hand_id").notNull().references(() => gameHands.id),
  roundNumber: integer("round_number").notNull(), // 1, 2, 3, etc. within the hand
  winnerPlayerId: integer("winner_player_id"), // Who won this round
  winningCard: text("winning_card"), // The card that won
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Player bets - stores each player's bet for each hand
export const playerBets = pgTable("player_bets", {
  id: serial("id").primaryKey(),
  handId: integer("hand_id").notNull().references(() => gameHands.id),
  playerId: integer("player_id").notNull(),
  userId: text("user_id").notNull().references(() => profiles.userId),
  betValue: integer("bet_value").notNull(), // How many tricks they bet they'd win
  actualTricks: integer("actual_tricks"), // How many they actually won (filled at hand end)
  isLastToBet: boolean("is_last_to_bet").default(false), // Important for last player performance
  livesBeforeBet: integer("lives_before_bet").notNull(), // For high-pressure analysis
  isPerfectPrediction: boolean("is_perfect_prediction"), // bet === actual (calculated)
  betAccuracyScore: integer("bet_accuracy_score"), // abs(bet - actual) (calculated)
  betTimestamp: timestamp("bet_timestamp").notNull().defaultNow(),
});

// Card plays - stores every card played
export const cardPlays = pgTable("card_plays", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").notNull().references(() => gameRounds.id),
  playerId: integer("player_id").notNull(),
  userId: text("user_id").notNull().references(() => profiles.userId),
  cardPlayed: text("card_played").notNull(),
  playOrder: integer("play_order").notNull(), // 1st, 2nd, 3rd to play in this round
  isWinningCard: boolean("is_winning_card").default(false),
  playTimestamp: timestamp("play_timestamp").notNull().defaultNow(),
});

// Player statistics - aggregated metrics (calculated periodically)
export const playerStats = pgTable("player_stats", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => profiles.userId),
  
  // Core Performance Metrics
  perfectPredictionRate: numeric("perfect_prediction_rate", { precision: 5, scale: 2 }), // Percentage
  avgBetAccuracyScore: numeric("avg_bet_accuracy_score", { precision: 5, scale: 2 }), // Lower is better
  avgSurvivalRate: numeric("avg_survival_rate", { precision: 5, scale: 2 }), // Rounds/hands survived
  multiplierEfficiency: numeric("multiplier_efficiency", { precision: 5, scale: 2 }), // Performance in multiplier situations
  lastPlayerWinRate: numeric("last_player_win_rate", { precision: 5, scale: 2 }), // Win rate when betting last
  highPressureAccuracy: numeric("high_pressure_accuracy", { precision: 5, scale: 2 }), // Accuracy with 1-2 lives
  
  // Supporting Data
  totalGamesPlayed: integer("total_games_played").default(0),
  totalHandsPlayed: integer("total_hands_played").default(0),
  totalRoundsPlayed: integer("total_rounds_played").default(0),
  totalPerfectPredictions: integer("total_perfect_predictions").default(0),
  totalMultiplierHands: integer("total_multiplier_hands").default(0),
  totalLastPlayerBets: integer("total_last_player_bets").default(0),
  totalHighPressureBets: integer("total_high_pressure_bets").default(0),
  
  lastCalculatedAt: timestamp("last_calculated_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().$onUpdate(() => new Date()),
});

export type InsertProfile = typeof profiles.$inferInsert;
export type SelectProfile = typeof profiles.$inferSelect; 