-- ============================================================
-- EvalFlow - Migration 006: Upgrade start_date and end_date to TIMESTAMPTZ
-- ============================================================

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
