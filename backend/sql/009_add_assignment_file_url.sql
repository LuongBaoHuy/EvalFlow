-- Migration 009: Add assignment_file_url column to survey_campaigns
ALTER TABLE survey_campaigns ADD COLUMN IF NOT EXISTS assignment_file_url VARCHAR(500) DEFAULT NULL;
