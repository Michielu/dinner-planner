# Recipe Source URL Design

**Date:** 2026-06-19  
**Status:** Approved

## Goal

Add an optional `source_url` field to each recipe so users can save the web page that helped them make the meal. The URL is pre-filled automatically when importing via the URL importer and can be edited at any time via the recipe edit form.

---

## 1. Data Model

### Change: `recipes` table

Add one nullable column:

| Column | Type | Constraints |
|--------|------|-------------|
| `source_url` | text | nullable |

No migration of existing rows — null means no URL.

### Migration SQL

```sql
alter table recipes add column if not exists source_url text;
```

---

## 2. Data Flow

### `useRecipes` hook

- Add `source_url` to the `.select(...)` query on `recipes`
- `addRecipe({ name, categoryId, ingredientIds, sourceUrl })` — include `source_url: sourceUrl ?? null` in the insert
- `updateRecipe(id, { name, categoryId, ingredientIds, sourceUrl })` — include `source_url: sourceUrl ?? null` in the update

### `RecipeForm`

- Accepts `sourceUrl` in the `initial` prop (pre-filled when editing)
- Renders an optional "Source URL" text input below the recipe name field
- Passes `sourceUrl` to `onSave({ name, categoryId, ingredientIds, sourceUrl })`

### `RecipeImport`

- Already holds the fetched `url` string in local state
- Passes it to `addRecipe` as `sourceUrl: url.trim()`

### `RecipesPage`

- Passes `initial.sourceUrl` to `RecipeForm` in edit mode
- Renders a small "Source ↗" link on each recipe card when `recipe.source_url` is set (opens in new tab, `rel="noopener noreferrer"`)

---

## 3. UI Details

### RecipeForm — URL input

Sits below the recipe name input, above the category chips:

```
[ Recipe name input                    ]
[ Source URL (optional)                ]
[ Category chips... ]
```

- Placeholder: `Source URL (optional)`
- Type: `text` (not `url`) so the user can paste any string without browser validation noise
- No required constraint — field is always optional

### RecipesPage — recipe card link

When `recipe.source_url` is non-null and non-empty:

```
Pasta Bolognese          [edit] [delete]
Italian · Source ↗
```

The link is small (`text-xs`), muted (`text-stone-grey`), and sits on the same line as the category label. Opens in a new tab.

---

## Files Changed

| File | Action |
|------|--------|
| `supabase/migrations/20260619_add_recipe_source_url.sql` | **New** — add column |
| `src/hooks/useRecipes.js` | Modify — select + add/update |
| `src/components/RecipeForm.jsx` | Modify — add URL input, sourceUrl prop |
| `src/components/RecipeImport.jsx` | Modify — pass url to addRecipe |
| `src/pages/RecipesPage.jsx` | Modify — pass sourceUrl to RecipeForm edit, render link on cards |

---

## Non-Goals

- URL validation (no http/https enforcement — user may paste partial URLs or notes)
- Multiple URLs per recipe
- Fetching a page title or favicon from the URL
- Displaying the URL anywhere other than the recipe card and edit form
