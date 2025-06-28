// Test environment variable loading
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Testing environment variable loading...\n');

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.log('❌ DATABASE_URL not found in environment variables');
  console.log('Available env vars:', Object.keys(process.env).filter(k => k.includes('DATABASE')));
} else {
  console.log('✅ DATABASE_URL found in environment');
  // Hide password for security
  const safeUrl = databaseUrl.replace(/:[^:@]*@/, ':****@');
  console.log('URL format:', safeUrl);
  
  // Test postgres connection
  const postgres = require('postgres');
  
  async function testConnection() {
    try {
      const sql = postgres(databaseUrl);
      const result = await sql`SELECT 1 as test`;
      console.log('✅ Database connection successful!');
      console.log('Test result:', result[0]);
      await sql.end();
    } catch (error) {
      console.log('❌ Database connection failed:', error.message);
    }
  }
  
  testConnection();
} 