-- FIX MQAA Settings Persistence
-- 1. Ensure table exists
CREATE TABLE IF NOT EXISTS mqaa_settings (
  id integer primary key default 1,
  report_time text default '08:00',
  zalo_group text default 'MQAA',
  image_limit integer default 10,
  last_run_date date,
  updated_at timestamp with time zone default now()
);

-- 2. Ensure the setting row exists
INSERT INTO mqaa_settings (id, report_time, zalo_group, image_limit)
VALUES (1, '08:00', 'MQAA', 10)
ON CONFLICT (id) DO NOTHING;

-- 3. Reset RLS Policies to ensure write access is allowed
ALTER TABLE mqaa_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if any (to avoid conflicts)
DROP POLICY IF EXISTS "Allow public access for settings" ON mqaa_settings;
DROP POLICY IF EXISTS "Allow all for settings" ON mqaa_settings;

-- Create a permissive policy for Select, Insert, Update
CREATE POLICY "Allow all for settings" ON mqaa_settings
FOR ALL
USING (true)
WITH CHECK (true);

-- Verify: Update the timestamp to currently confirm it works
UPDATE mqaa_settings SET updated_at = now() WHERE id = 1;

-- Thêm quyền cho storage nếu chưa có (phòng hờ lỗi upload ảnh)
INSERT INTO storage.buckets (id, name, public) VALUES ('mqaa-images', 'mqaa-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access MQAA Images" ON storage.objects
FOR ALL USING (bucket_id = 'mqaa-images') WITH CHECK (bucket_id = 'mqaa-images');
