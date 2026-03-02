-- Add column for custom patrol report days
ALTER TABLE mqaa_settings ADD COLUMN IF NOT EXISTS patrol_report_days TEXT DEFAULT 'Friday,Saturday';
