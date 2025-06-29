require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

// Database setup
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in environment variables');
  console.error('Available env vars:', Object.keys(process.env).filter(key => key.includes('DATABASE')));
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function fixDatabaseIssues() {
  console.log('🔧 Starting database fixes...\n');

  try {
    // 1. Populate game_id in player_bets table
    console.log('1. Populating game_id in player_bets...');
    const betUpdate = await sql`
      UPDATE player_bets 
      SET game_id = game_hands.game_id 
      FROM game_hands 
      WHERE player_bets.hand_id = game_hands.id 
      AND (player_bets.game_id IS NULL OR player_bets.game_id = '')
    `;
    console.log(`   ✅ Updated ${betUpdate.count} player_bets records`);

    // 2. Populate game_id in game_rounds table
    console.log('2. Populating game_id in game_rounds...');
    const roundUpdate = await sql`
      UPDATE game_rounds 
      SET game_id = game_hands.game_id 
      FROM game_hands 
      WHERE game_rounds.hand_id = game_hands.id 
      AND (game_rounds.game_id IS NULL OR game_rounds.game_id = '')
    `;
    console.log(`   ✅ Updated ${roundUpdate.count} game_rounds records`);

    // 3. Populate game_id in card_plays table
    console.log('3. Populating game_id in card_plays...');
    const cardUpdate = await sql`
      UPDATE card_plays 
      SET game_id = game_hands.game_id 
      FROM game_hands 
      WHERE card_plays.hand_id = game_hands.id 
      AND (card_plays.game_id IS NULL OR card_plays.game_id = '')
    `;
    console.log(`   ✅ Updated ${cardUpdate.count} card_plays records`);

    // 4. Fix is_multiplier_round values based on multiplier_value
    console.log('4. Fixing is_multiplier_round values...');
    const multiplierFix = await sql`
      UPDATE game_rounds 
      SET is_multiplier_round = true 
      WHERE multiplier_value > 1 
      AND is_multiplier_round = false
    `;
    console.log(`   ✅ Fixed ${multiplierFix.count} multiplier round records`);

    // 5. Show summary of current data
    console.log('\n📊 Database Summary:');
    
    const [gameCount] = await sql`SELECT COUNT(*) as count FROM games`;
    console.log(`   Games: ${gameCount.count}`);
    
    const [handsCount] = await sql`SELECT COUNT(*) as count FROM game_hands`;
    console.log(`   Hands: ${handsCount.count}`);
    
    const [roundsCount] = await sql`SELECT COUNT(*) as count FROM game_rounds`;
    console.log(`   Rounds: ${roundsCount.count}`);
    
    const [betsCount] = await sql`SELECT COUNT(*) as count FROM player_bets`;
    console.log(`   Bets: ${betsCount.count}`);
    
    const [playsCount] = await sql`SELECT COUNT(*) as count FROM card_plays`;
    console.log(`   Card Plays: ${playsCount.count}`);

    const [multiplierRounds] = await sql`
      SELECT COUNT(*) as count 
      FROM game_rounds 
      WHERE is_multiplier_round = true
    `;
    console.log(`   Multiplier Rounds: ${multiplierRounds.count}`);

    // 6. Verify game_id population
    console.log('\n🔍 Verification:');
    
    const [nullGameIds] = await sql`
      SELECT 
        (SELECT COUNT(*) FROM player_bets WHERE game_id IS NULL OR game_id = '') as null_bets,
        (SELECT COUNT(*) FROM game_rounds WHERE game_id IS NULL OR game_id = '') as null_rounds,
        (SELECT COUNT(*) FROM card_plays WHERE game_id IS NULL OR game_id = '') as null_plays
    `;
    
    if (nullGameIds.null_bets == 0 && nullGameIds.null_rounds == 0 && nullGameIds.null_plays == 0) {
      console.log('   ✅ All game_id fields are populated');
    } else {
      console.log(`   ⚠️  Still have null game_ids: bets=${nullGameIds.null_bets}, rounds=${nullGameIds.null_rounds}, plays=${nullGameIds.null_plays}`);
    }

    console.log('\n🎉 Database fixes completed successfully!');

  } catch (error) {
    console.error('❌ Error fixing database:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run the fixes
fixDatabaseIssues()
  .then(() => {
    console.log('✨ All database issues have been fixed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Failed to fix database issues:', error);
    process.exit(1);
  }); 