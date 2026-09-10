-- Migration 005: Make evaluator_id nullable and add guest_name and guest_email columns to responses table

ALTER TABLE responses ALTER COLUMN evaluator_id DROP NOT NULL;

ALTER TABLE responses ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
ALTER TABLE responses ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);
