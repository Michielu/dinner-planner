# Recipe Tags Design — Favorite, Quick, Easy

**Date:** 2026-06-23

## Summary

Add three boolean flags to recipes: `is_favorite` (heart toggle), `is_quick`, and `is_easy`. Each flag is independent. They appear as toggles in the recipe form, as badge pills on recipe cards, and as filter controls in the recipe list.

## Database

Add three non-null boolean columns defaulting to `false` on the `recipes` table:

```sql
alter table recipes
  add column is_favorite boolean not null default false,
  add column is_quick    boolean not null default false,
  add column is_easy     boolean not null default false;
```

Migration file: `supabase/migrations/20260623_recipe_tags.sql`

## Data Layer — `useRecipes`

- Include `is_favorite, is_quick, is_easy` in the `select` query
- `addRecipe` and `updateRecipe` accept and persist `{ isFavorite, isQuick, isEasy }` (camelCase in JS, snake_case in DB)
- New `toggleFlag(id, field, value)` function does a single-column `update` for the heart button (toggling favorite without opening the edit form)

## UI — `RecipeForm`

- Three toggle buttons added as a row below the source URL field
- Labels: `♥ Favorite`, `⚡ Quick`, `✓ Easy`
- Styling matches existing category pills: active = `bg-garden-patch text-fresh-herb`, inactive = `bg-willow-mist text-stone-grey`
- `onSave` payload gains `{ isFavorite, isQuick, isEasy }`
- `initial` prop gains these three fields for edit mode

## UI — `RecipesPage`

**Filter pills:** Three new pills appended after the category pills — `♥ Favorites`, `⚡ Quick`, `✓ Easy`. Multiple flags can be active simultaneously. Filtering uses AND logic: a recipe must satisfy the selected category AND all active flag filters.

**Recipe cards:** Small inline badge pills (`♥`, `⚡`, `✓`) appear next to the category badge for whichever flags are set. The heart badge doubles as a click target to toggle `is_favorite` directly (calls `toggleFlag`).

## Decisions

- Three separate booleans on `recipes` (not a tags array or join table) — consistent with existing schema, type-safe, simple to query
- AND logic for multi-filter: most useful behaviour (narrow down, not broaden)
- Heart is toggleable from the card without opening edit form — common pattern for favorites
