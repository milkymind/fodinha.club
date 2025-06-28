// Test database connection
const postgres = require('postgres');

// Test URL with proper escaping
const testUrls = [
  // Original URL with quotes
  'postgresql://postgres.ztxspdjazaeveoxixhdk:IQVIAbms14$@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  // URL encoded version
  'postgresql://postgres.ztxspdjazaeveoxixhdk:IQVIAbms14%24@aws-0-us-east-2.pooler.supabase.com:6543/postgres'
];

async function testConnection(url, index) {
  try {
    console.log(`\nTesting connection ${index + 1}:`);
    console.log(`URL: ${url.replace(/:[^:@]*@/, ':****@')}`); // Hide password in logs
    
    const sql = postgres(url);
    const result = await sql`SELECT version()`;
    
    console.log('✅ Connection successful!');
    console.log('Database version:', result[0].version);
    
    await sql.end();
    return true;
  } catch (error) {
    console.log('❌ Connection failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing database connections...\n');
  
  for (let i = 0; i < testUrls.length; i++) {
    const success = await testConnection(testUrls[i], i);
    if (success) {
      console.log(`\n✨ Use this URL format in your .env.local file:`);
      console.log(`DATABASE_URL="${testUrls[i]}"`);
      break;
    }
  }
}

main().catch(console.error); 