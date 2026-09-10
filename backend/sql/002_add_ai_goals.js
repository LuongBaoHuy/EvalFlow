const pool = require('../config/db');

async function migrate() {
  try {
    console.log('Running migration: adding ai_goals to surveys and survey_campaigns...');
    await pool.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ai_goals JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS ai_goals JSONB DEFAULT '[]'::jsonb;`);
    console.log('✅ Migration successful: ai_goals columns created.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

migrate();
