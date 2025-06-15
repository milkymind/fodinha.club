import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import { profiles } from './schema';
import type { CreateUserProfile, UpdateUserProfile, SelectProfile } from './schema';

// Create a new user profile
export async function createUserProfile(data: CreateUserProfile): Promise<SelectProfile> {
  const [profile] = await db.insert(profiles).values({
    userId: data.userId,
    username: data.username,
    gamesPlayed: data.gamesPlayed ?? 0,
    gamesWon: data.gamesWon ?? 0,
  }).returning();
  
  return profile;
}

// Get user profile by userId
export async function getUserProfile(userId: string): Promise<SelectProfile | null> {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId));
  return profile || null;
}

// Update user profile
export async function updateUserProfile(data: UpdateUserProfile): Promise<SelectProfile | null> {
  const [profile] = await db.update(profiles)
    .set({
      username: data.username,
      gamesPlayed: data.gamesPlayed,
      gamesWon: data.gamesWon,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, data.userId))
    .returning();
    
  return profile || null;
}

// Increment games played count
export async function incrementGamesPlayed(userId: string): Promise<void> {
  await db.update(profiles)
    .set({
      gamesPlayed: sql`${profiles.gamesPlayed} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId));
}

// Increment games won count
export async function incrementGamesWon(userId: string): Promise<void> {
  await db.update(profiles)
    .set({
      gamesWon: sql`${profiles.gamesWon} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(profiles.userId, userId));
}

// Get all profiles (for leaderboard)
export async function getAllProfiles(): Promise<SelectProfile[]> {
  return await db.select().from(profiles);
}

// Delete user profile
export async function deleteUserProfile(userId: string): Promise<void> {
  await db.delete(profiles).where(eq(profiles.userId, userId));
} 