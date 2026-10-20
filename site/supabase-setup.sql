-- Run this in your Supabase project's SQL Editor to set up the license database.
-- Supabase: app.supabase.com → your project → SQL Editor → paste & run.

create table if not exists licenses (
  key text primary key,
  customer_name text,
  used boolean default false,
  device_id text,
  created_at timestamptz default now(),
  activated_at timestamptz
);

-- Allow public read/write for the anon key (the app needs it for activation).
-- For tighter security, replace with RLS policies later.
alter table licenses enable row level security;

create policy "public read" on licenses for select using (true);
create policy "public insert" on licenses for insert with check (true);
create policy "public update" on licenses for update using (true);
