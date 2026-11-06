-- Migration: share recipes with everyone and copy shared recipes into your own list
-- Run this in the Supabase SQL editor.

alter table recipes
  add column if not exists is_shared             boolean not null default false,
  add column if not exists copied_from_recipe_id uuid references recipes(id) on delete set null,
  add column if not exists copied_from_email     text;

create index if not exists recipes_is_shared_idx on recipes (is_shared) where is_shared;
create index if not exists recipes_copied_from_idx on recipes (copied_from_recipe_id);
