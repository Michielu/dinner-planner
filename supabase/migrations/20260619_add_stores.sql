-- Migration: add stores table for user-managed store list
-- Run this in the Supabase SQL editor.

create table if not exists stores (
  id         uuid    primary key default gen_random_uuid(),
  value      text    not null unique,
  label      text    not null,
  sort_order integer not null default 0
);

alter table stores enable row level security;
create policy "anon_all" on stores for all to anon using (true) with check (true);

-- Seed with the existing hardcoded stores so current data stays valid
insert into stores (value, label, sort_order) values
  ('sams_club', 'Sam''s Club', 0),
  ('aldi',      'Aldi',        1),
  ('target',    'Target',      2),
  ('other',     'Other',       3)
on conflict (value) do nothing;
