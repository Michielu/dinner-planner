-- Migration: recipes are shared by default; share every existing original recipe
-- Run this in the Supabase SQL editor. (Applied on 2026-11-06.)

alter table recipes alter column is_shared set default true;

-- Copies of someone else's recipe stay private so they don't duplicate the original
update recipes set is_shared = true where copied_from_recipe_id is null;
