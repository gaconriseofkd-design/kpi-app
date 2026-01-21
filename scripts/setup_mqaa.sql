-- Create the mqaa_logs table
create table if not exists mqaa_logs (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  section text, -- Thêm cột Bộ phận (Leanline_DC, Leanline_Molded, Lamination, Prefitting, Molding, Hàng bù)
  shift text, -- Thêm cột Ca (Ca 1, Ca 2, Ca 3, Ca HC)
  line text not null,
  worker_id text, -- Chuyển thành nullable
  worker_name text,
  leader_name text,
  issue_type text check (issue_type in ('Tuân thủ', 'Chất lượng', 'Bất thường')),
  description text,
  image_url text[],
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table mqaa_logs enable row level security;

-- Create policies (Allowing all for now as per project context if needed, but normally more restrictive)
create policy "Allow all for mqaa_logs" on mqaa_logs for all using (true) with check (true);

-- Storage Setup (Bucket creation usually via UI, but here's how to set up policies if bucket exists)
-- Note: Replace 'mqaa-images' with your actual bucket name.
-- Ensure the bucket is created through the Supabase dashboard first.

-- Policies for mqaa-images bucket
-- (Assumes the bucket is named 'mqaa-images')
-- Allow public read access
create policy "Public Read Access" on storage.objects for select using (bucket_id = 'mqaa-images');

-- Allow public upload access
create policy "Public Upload Access" on storage.objects for insert with check (bucket_id = 'mqaa-images');

-- Bảng lưu cấu hình MQAA
create table if not exists mqaa_settings (
  id integer primary key default 1,
  report_time text default '08:00',
  zalo_group text default 'MQAA',
  image_limit integer default 10,
  last_run_date date,
  updated_at timestamp with time zone default now()
);

-- Chèn dữ liệu mặc định
insert into mqaa_settings (id, report_time, zalo_group, image_limit)
values (1, '08:00', 'MQAA', 10)
on conflict (id) do nothing;

alter table mqaa_settings enable row level security;
create policy "Allow public access for settings" on mqaa_settings for all using (true);
