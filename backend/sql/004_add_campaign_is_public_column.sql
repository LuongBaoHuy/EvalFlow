-- Migration 004: Add is_public column to survey_campaigns and allow NULL password_hash for Google SSO Guest users
ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
