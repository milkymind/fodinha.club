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
import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

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

export type InsertProfile = typeof profiles.$inferInsert;
export type SelectProfile = typeof profiles.$inferSelect; 