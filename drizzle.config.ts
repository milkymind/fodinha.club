import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
  throw new Error(
    '❌ DATABASE_URL not found!\n\n' +
    '💡 Please create a .env.local file in your project root with:\n' +
    'DATABASE_URL=postgresql://username:password@host:port/database\n\n' +
    '🔗 Get your URL from Supabase Dashboard → Settings → Database'
  );
}

export default {
  schema: './lib/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
} satisfies Config; 