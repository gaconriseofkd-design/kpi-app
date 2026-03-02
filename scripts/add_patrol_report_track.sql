-- Add columns to track weekly patrol report and its specific settings
ALTER TABLE mqaa_settings ADD COLUMN IF NOT EXISTS last_patrol_report_monday DATE;
ALTER TABLE mqaa_settings ADD COLUMN IF NOT EXISTS patrol_zalo_group TEXT;
ALTER TABLE mqaa_settings ADD COLUMN IF NOT EXISTS patrol_report_time TEXT;
