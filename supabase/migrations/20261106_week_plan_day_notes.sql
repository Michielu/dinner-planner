-- Migration: per-day notes on the week plan, e.g. {"monday": "Soccer practice, eat early"}
-- Run this in the Supabase SQL editor. Notes are cleared with the week plan row.

alter table week_plan
  add column if not exists day_notes jsonb not null default '{}';
