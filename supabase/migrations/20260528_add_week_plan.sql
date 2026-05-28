-- Migration: add week_plan table + created_at to staple_items
-- Run this in the Supabase SQL editor.

-- 1. Add created_at to staple_items (existing rows get the current timestamp)
alter table staple_items
  add column if not exists created_at timestamptz not null default now();

-- 2. Create the week_plan table
create table if not exists week_plan (
  id                  uuid        primary key default gen_random_uuid(),
  slots               jsonb       not null default '{}',
  selected_staple_ids uuid[]      not null default '{}',
  pantry_items        jsonb       not null default '[]',
  phase               text        not null default 'staples',
  visited_phases      text[]      not null default '{staples}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table week_plan enable row level security;
create policy "anon_all" on week_plan for all to anon using (true) with check (true);
