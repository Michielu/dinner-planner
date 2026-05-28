-- Migration: grocery list redesign
-- Run this in the Supabase SQL editor.

-- 1. Add added_ingredient_ids to week_plan
alter table week_plan
  add column if not exists added_ingredient_ids uuid[] not null default '{}';

-- 2. Drop grocery_extras (replaced by added_ingredient_ids)
drop table if exists grocery_extras;
