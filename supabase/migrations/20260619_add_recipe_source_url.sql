-- Migration: add source_url to recipes for saving reference links
-- Run this in the Supabase SQL editor.

alter table recipes add column if not exists source_url text;
