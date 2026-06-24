-- Migration: add favorite/quick/easy flags to recipes
-- Run this in the Supabase SQL editor.

alter table recipes
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_quick    boolean not null default false,
  add column if not exists is_easy     boolean not null default false;
