ALTER TABLE responses ADD COLUMN IF NOT EXISTS canvas_data JSONB DEFAULT '{}'::jsonb;
