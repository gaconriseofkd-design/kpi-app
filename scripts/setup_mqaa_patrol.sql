-- Create the mqaa_patrol_logs table
create table if not exists mqaa_patrol_logs (
  id uuid primary key default uuid_generate_v4(),
  date date not null default current_date,
  section text not null, -- Lamination, Prefitting, Molding, Leanline_DC, Leanline_Molded
  auditor_name text not null,
  auditor_id text not null,
  overall_performance numeric,
  total_score integer,
  total_level integer,
  evaluation_data jsonb, -- Stores the list of criteria with scores, levels, images, descriptions
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table mqaa_patrol_logs enable row level security;

-- Create policies (Allow all for internal project use)
create policy "Allow all for mqaa_patrol_logs" on mqaa_patrol_logs for all using (true) with check (true);

-- Ensure storage bucket exists (mqaa-images) and has policies
-- This was already mentioned in setup_mqaa.sql
-- If adding a new folder structure, policies usually apply to the whole bucket.

-- Create table for Auditor list (Pre-defined)
create table if not exists mqaa_patrol_auditors (
  id text primary key, -- MSNV
  name text not null,
  created_at timestamp with time zone default now()
);

-- Enable RLS for auditors
alter table mqaa_patrol_auditors enable row level security;
create policy "Allow all for auditors" on mqaa_patrol_auditors for all using (true) with check (true);
