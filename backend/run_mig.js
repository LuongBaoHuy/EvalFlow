const pool = require('./config/db');
pool.query(`ALTER TABLE responses ADD COLUMN IF NOT EXISTS canvas_data JSONB DEFAULT '{}'::jsonb;`)
  .then(() => {
    console.log('Migration done');
    process.exit(0);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
