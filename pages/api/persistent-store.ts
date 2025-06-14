import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { Memory } from 'lowdb';
import path from 'path';
import fs from 'fs';

type Lobby = {
  gameId: string;
  players: { id: number; name: string }[];
  maxPlayers: number;
  lives: number;
  startFrom?: 'one' | 'max';
  gameStarted?: boolean;
  gameState?: any;
  lastUpdated?: string; // ISO string of the last update time
};

type Data = {
  lobbies: Record<string, Lobby>;
};

// Add a memory cache with TTL
interface CachedLobby extends Lobby {
  cachedAt: number;
}

// Memory caches
let memoryLobbies: Record<string, Lobby> = {};
const lobbyCache: Map<string, CachedLobby> = new Map();
const LOBBY_CACHE_TTL = 30 * 1000; // 30 seconds cache lifetime

// Add connection pooling support
let db: Low<Data>;
let dbInitialized = false;
let lastDbInitTime = 0;
const DB_INIT_TTL = 5000; // Only reinitialize DB every 5 seconds maximum
let pendingDbInit: Promise<void> | null = null;

// Cache for all lobbies to avoid repeated initialization
let allLobbiesCache: Record<string, Lobby> | null = null;
let allLobbiesCacheTime = 0;
const ALL_LOBBIES_CACHE_TTL = 20 * 1000; // 20 seconds

// Check if we're in production (Vercel) or development environment
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // In production, use in-memory storage with a shared memory object
  const defaultData: Data = { lobbies: {} };
  db = new Low<Data>(new Memory(), defaultData);
} else {
  // In development, use file storage
  const dbPath = path.join(process.cwd(), 'db.json');

  // Ensure the db.json file exists with default data
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ lobbies: {} }));
  }

  const adapter = new JSONFile<Data>(dbPath);
  const defaultData: Data = { lobbies: {} };
  db = new Low<Data>(adapter, defaultData);
}

// Initialize db with empty lobbies if not present - now with connection pooling
async function init() {
  const now = Date.now();
  
  // Skip initialization if recent
  if (dbInitialized && now - lastDbInitTime < DB_INIT_TTL) {
    return;
  }
  
  // If initialization is already in progress, wait for it
  if (pendingDbInit) {
    await pendingDbInit;
    return;
  }
  
  // Set the pending initialization promise
  pendingDbInit = (async () => {
    try {
      console.log('Initializing database connection');
      
      // For development mode with file storage, verify the file exists and is valid
      if (!isProduction) {
        const dbPath = path.join(process.cwd(), 'db.json');
        
        if (!fs.existsSync(dbPath)) {
          console.log('Database file not found, creating new one');
          fs.writeFileSync(dbPath, JSON.stringify({ lobbies: {} }));
        } else {
          // Verify file is valid JSON
          try {
            const content = fs.readFileSync(dbPath, 'utf8');
            if (!content || content.trim() === '') {
              console.log('Database file empty, initializing with default data');
              fs.writeFileSync(dbPath, JSON.stringify({ lobbies: {} }));
            } else {
              // Test if it's valid JSON
              try {
                JSON.parse(content);
              } catch (e) {
                console.error('Database file contains invalid JSON, reinitializing');
                fs.writeFileSync(dbPath, JSON.stringify({ lobbies: {} }));
              }
            }
          } catch (e) {
            console.error('Error reading database file:', e);
            fs.writeFileSync(dbPath, JSON.stringify({ lobbies: {} }));
          }
        }
      }
      
      await db.read();
      
      if (!db.data) {
        console.log('No data in database, initializing with empty structure');
        db.data = { lobbies: {} };
      }
      if (!db.data.lobbies) {
        console.log('No lobbies in database, initializing with empty object');
        db.data.lobbies = {};
      }
      
      // In production, synchronize with our shared memory object
      if (isProduction) {
        // We need to merge the in-memory lobbies with the db's lobbies
        db.data.lobbies = { ...db.data.lobbies, ...memoryLobbies };
      }
      
      // Update the cache of all lobbies
      allLobbiesCache = { ...db.data.lobbies };
      allLobbiesCacheTime = now;
      
      console.log(`Database initialized with ${Object.keys(db.data.lobbies).length} lobbies`);
      
      // Mark as initialized and update timestamp
      dbInitialized = true;
      lastDbInitTime = now;
    } catch (error) {
      console.error('Error during db initialization:', error);
      // Create default data structure if read fails
      db.data = { lobbies: {} };
      dbInitialized = false;
    } finally {
      pendingDbInit = null;
    }
  })();
  
  await pendingDbInit;
}

export async function getLobby(gameId: string): Promise<Lobby | undefined> {
  if (!gameId) {
    console.error('getLobby called with empty gameId');
    return undefined;
  }

  console.log(`Attempting to get lobby for game: ${gameId}`);
  
  // Check memory cache first
  const cachedLobby = lobbyCache.get(gameId);
  const now = Date.now();
  
  if (cachedLobby && now - cachedLobby.cachedAt < LOBBY_CACHE_TTL) {
    console.log(`Retrieved lobby ${gameId} from memory cache`);
    return cachedLobby;
  }
  
  // Try up to 3 times in case of file system errors
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // For production/Vercel, also check the memory cache
      if (isProduction && memoryLobbies[gameId]) {
        console.log(`Retrieved lobby ${gameId} from memory cache`);
        
        // Update the cache
        const lobby = memoryLobbies[gameId];
        lobbyCache.set(gameId, { ...lobby, cachedAt: now });
        
        return lobby;
      }
      
      await init();
      if (!db.data || !db.data.lobbies) {
        console.error('Database not properly initialized');
        return undefined;
      }
      
      const lobby = db.data.lobbies[gameId];
      
      if (lobby) {
        console.log(`Successfully retrieved lobby ${gameId} from database`);
        // Cache the result in memory for faster access
        if (isProduction) {
          memoryLobbies[gameId] = JSON.parse(JSON.stringify(lobby)); // Deep copy
        }
        
        // Update our TTL cache
        lobbyCache.set(gameId, { ...lobby, cachedAt: now });
        
        return lobby;
      } else {
        console.log(`Lobby ${gameId} not found in database`);
        return undefined;
      }
    } catch (error) {
      console.error(`Error getting lobby ${gameId} (attempt ${attempt + 1}/3):`, error);
      
      // Add small delay between retries
      const delay = 100 * (attempt + 1);
      console.log(`Retrying after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`Failed to get lobby ${gameId} after multiple attempts`);
  return undefined;
}

export async function setLobby(lobby: Lobby): Promise<boolean> {
  if (!lobby || !lobby.gameId) {
    console.error('setLobby called with invalid lobby data');
    return false;
  }

  console.log(`Attempting to save lobby ${lobby.gameId}`);
  
  // Update the lastUpdated timestamp
  lobby.lastUpdated = new Date().toISOString();
  
  // Update our TTL cache immediately
  lobbyCache.set(lobby.gameId, { ...lobby, cachedAt: Date.now() });
  
  // Try up to 3 times in case of file system errors
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      // Save to memory cache first for Vercel
      if (isProduction) {
        memoryLobbies[lobby.gameId] = JSON.parse(JSON.stringify(lobby)); // Deep clone to avoid reference issues
      }
      
      await init();
      if (!db.data || !db.data.lobbies) {
        console.error('Database not properly initialized');
        return false;
      }
      
      db.data.lobbies[lobby.gameId] = lobby;
      
      // Add small random delay to avoid race conditions
      await new Promise(resolve => setTimeout(resolve, Math.random() * 50));
      
      await db.write();
      
      // Invalidate the all lobbies cache
      allLobbiesCache = null; 
      
      console.log(`Successfully saved lobby ${lobby.gameId}`);
      return true;
    } catch (error) {
      console.error(`Error saving lobby ${lobby.gameId} (attempt ${attempt + 1}/3):`, error);
      
      // Add small delay between retries
      const delay = 200 * (attempt + 1);
      console.log(`Retrying after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  console.error(`Failed to save lobby ${lobby.gameId} after multiple attempts`);
  return false;
}

export async function getAllLobbies(): Promise<Record<string, Lobby>> {
  const now = Date.now();
  
  // Use cache if available and recent
  if (allLobbiesCache && now - allLobbiesCacheTime < ALL_LOBBIES_CACHE_TTL) {
    return allLobbiesCache;
  }
  
  try {
    await init();
    
    // Update cache
    allLobbiesCache = { ...db.data.lobbies };
    allLobbiesCacheTime = now;
    
    return db.data.lobbies;
  } catch (error) {
    console.error('Error getting all lobbies:', error);
    return {};
  }
}

export async function deleteLobby(gameId: string): Promise<boolean> {
  try {
    // Remove from all caches
    lobbyCache.delete(gameId);
    allLobbiesCache = null;
    
    // Remove from memory cache for Vercel
    if (isProduction) {
      delete memoryLobbies[gameId];
    }
    
    await init();
    delete db.data.lobbies[gameId];
    await db.write();
    return true;
  } catch (error) {
    console.error('Error deleting lobby:', error);
    return false;
  }
}

// Garbage collect expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  
  // Clean up lobby cache
  lobbyCache.forEach((cachedLobby, gameId) => {
    if (now - cachedLobby.cachedAt > LOBBY_CACHE_TTL) {
      lobbyCache.delete(gameId);
    }
  });
}, 60000); // Run every minute
