-- Migration 003: Add Anomaly Detection Tracking Columns to responses table
ALTER TABLE responses ADD COLUMN IF NOT EXISTS is_anomaly BOOLEAN DEFAULT FALSE;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS anomaly_reason TEXT;
