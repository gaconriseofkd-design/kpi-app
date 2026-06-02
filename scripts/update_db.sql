ALTER TABLE system_settings
ADD COLUMN IF NOT EXISTS is_daily_report_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_hang_bu_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_delay_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_wip_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS is_mqaa_patrol_enabled boolean DEFAULT true;
