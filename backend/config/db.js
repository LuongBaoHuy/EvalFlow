const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('connect', () => {
  console.log('Database connected successfully');
});

// Run lightweight auto-migration for missing columns/constraints/types
(async () => {
  try {
    await pool.query('ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;');
    await pool.query('ALTER TABLE surveys ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;');
    await pool.query('ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS version INT DEFAULT 1;');
    await pool.query(`ALTER TABLE surveys ADD COLUMN IF NOT EXISTS ai_goals JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS ai_goals JSONB DEFAULT '[]'::jsonb;`);
    await pool.query(`ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS ai_goals_result JSONB DEFAULT NULL;`);
    await pool.query(`ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS ai_goals_updated_at TIMESTAMP DEFAULT NULL;`);
    await pool.query('ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS assignment_file_url VARCHAR(500) DEFAULT NULL;');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_responses_target_user ON responses(target_user_id);');
    await pool.query('ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;');
    await pool.query('ALTER TABLE responses ALTER COLUMN evaluator_id DROP NOT NULL;');
    await pool.query('ALTER TABLE responses ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);');
    await pool.query('ALTER TABLE responses ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);');
    await pool.query(`
      DO $$
      BEGIN
          IF EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'survey_campaigns' AND column_name = 'start_date' AND data_type = 'date'
          ) THEN
              ALTER TABLE survey_campaigns 
                ALTER COLUMN start_date TYPE TIMESTAMPTZ USING start_date::TIMESTAMP WITH TIME ZONE,
                ALTER COLUMN end_date TYPE TIMESTAMPTZ USING (end_date::TIMESTAMP + INTERVAL '23 hours 59 minutes 59 seconds')::TIMESTAMPTZ;
          END IF;
      END $$;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id VARCHAR(100),
        details JSONB DEFAULT '{}'::jsonb,
        ip_address VARCHAR(45),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);
  } catch (err) {
    console.warn('Auto-migration warning:', err.message);
  }
})();

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;
