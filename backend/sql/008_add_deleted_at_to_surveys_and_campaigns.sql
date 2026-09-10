-- EvalFlow - Migration 008: Add deleted_at column to surveys and survey_campaigns tables
ALTER TABLE surveys ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;
