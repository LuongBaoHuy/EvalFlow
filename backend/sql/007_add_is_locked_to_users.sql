-- EvalFlow - Migration 007: Add is_locked column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
