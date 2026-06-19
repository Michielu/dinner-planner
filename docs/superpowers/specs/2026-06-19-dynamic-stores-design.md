# Dynamic Stores Design

**Date:** 2026-06-19  
**Status:** Approved

## Goal

Replace the hardcoded `STORES` constant with a user-managed list of stores persisted in Supabase. Users can add and remove stores from the Catalog page.

## Scope

- New `stores` Supabase table, seeded with the current 4 stores
- New `useStores()` hook (same shape as `useStaples`)
- New "Stores" tab in ManagePage
- Replace all static `STORES` imports with dynamic data from the hook
- No changes to `ingredients` or `staples` table schemas
- No store rename (YAGNI)

---

## 1. Data Model

### New table: `stores`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | uuid | PK, default gen_random_uuid() |
| `value` | text | unique, not null |
| `label` | text | not null |
| `sort_order` | integer | not null, default 0 |

`value` is the string already stored in `ingredients.store` and `staples.store`. No migration of those tables is needed.

### Seed data

```sql
insert into stores (value, label, sort_order) values
  ('sams_club', 'Sam''s Club', 0),
  ('aldi',      'Aldi',        1),
  ('target',    'Target',      2),
  ('other',     'Other',       3);
```

### Slug generation

When a user adds a new store with label `L`, the `value` slug is:

```
L.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
```

If the resulting slug collides with an existing `value`, append `_2`, `_3`, etc. until unique.

### Delete constraint

Before deleting a store, the app checks whether any `ingredients` or `staples` row has `store = value`. If so, deletion is blocked and an error is returned. No database-level foreign key is added (store is a plain text column on those tables).

---

## 2. New Hook: `src/hooks/useStores.js`

Returns: `{ stores, loading, addStore, deleteStore }`

- `stores` — array of `{ id, value, label, sort_order }`, ordered by `sort_order`
- `loading` — boolean
- `addStore({ label })` — slugifies label, inserts row, refetches
- `deleteStore(value)` — queries ingredients + staples for usage, throws `{ inUse: true }` if found, otherwise deletes row and refetches

---

## 3. Data Flow

Each page that needs stores calls `useStores()` and passes `stores` down as props. This follows the existing pattern for `categories` (fetched in `useRecipes`, passed as props).

### Pages that call `useStores()`

| Page | Why |
|------|-----|
| `ManagePage` | Dropdowns + new Stores tab |
| `RecipesPage` | Show store label next to ingredients; passes to RecipeForm, RecipeImport |
| `GroceryPage` | New-item store dropdown; passes to GroceryList |
| `PlannerPage` | Passes to StapleChecker, PantryInput |

### Components that receive `stores` as a prop

| Component | Current source | Prop from |
|-----------|---------------|-----------|
| `RecipeForm` | `import { STORES }` | RecipesPage |
| `RecipeImport` | `import { STORES }` | RecipesPage |
| `GroceryList` | `import { STORES }` | GroceryPage |
| `StapleChecker` | `import { STORES }` | PlannerPage |
| `PantryInput` | `import { STORES }` | PlannerPage |
| `IngredientAutocomplete` (`IngredientRow`) | `import { STORES }` | RecipeForm (already gets stores prop) |

ManagePage's internal forms read from the hook directly (same file).

### Utility changes

**`src/utils/groceryList.js`** — `generateGroceryList` currently imports `STORES` to initialise store buckets. Change signature to accept `stores` as a parameter:

```js
// Before
export function generateGroceryList(slots, recipes, staples, addedIngredients)

// After
export function generateGroceryList(slots, recipes, staples, addedIngredients, stores)
```

Call site is `GroceryPage.jsx` — pass `stores` from `useStores()`.

**`src/utils/stores.js`** — no longer imported by components. File can be deleted once hook is wired up; the seed data lives in the Supabase migration.

---

## 4. ManagePage — Stores Tab

Add **"Stores"** as a 4th tab in the `TABS` array (after Staples, Ingredients, Categories).

### Tab content

- **List** of current stores in `sort_order` order
  - Each row: store label + **Remove** button
  - If the store is in use, Remove is disabled and shows: *"In use — reassign items first"*
- **Add form** at the bottom: one `<input>` for the label + "Add" button
  - Slug is derived silently from the label
  - Duplicate label check: if slug collides, suffix is auto-appended
- Error handling: show Toast on unexpected save/delete failures (same pattern as other tabs)

### In-use check flow

1. User clicks Remove on a store
2. Hook queries `ingredients` where `store = value` and `staples` where `store = value`
3. If any rows exist: return `{ inUse: true }` — UI shows inline error, no deletion
4. If no rows exist: delete row, refetch

---

## Files Changed

| File | Action |
|------|--------|
| Supabase migration | **New** — create `stores` table + seed |
| `src/hooks/useStores.js` | **New** |
| `src/pages/ManagePage.jsx` | Add Stores tab, call `useStores()` |
| `src/pages/RecipesPage.jsx` | Call `useStores()`, pass to RecipeForm/RecipeImport |
| `src/pages/GroceryPage.jsx` | Call `useStores()`, pass to GroceryList, update generateGroceryList call |
| `src/components/GroceryList.jsx` | Accept `stores` prop instead of importing |
| `src/components/RecipeForm.jsx` | Accept `stores` prop instead of importing |
| `src/components/RecipeImport.jsx` | Accept `stores` prop instead of importing |
| `src/utils/groceryList.js` | Accept `stores` parameter |
| `src/components/StapleChecker.jsx` | Accept `stores` prop instead of importing |
| `src/components/PantryInput.jsx` | Accept `stores` prop instead of importing |
| `src/components/IngredientAutocomplete.jsx` | Accept `stores` prop instead of importing |
| `src/pages/PlannerPage.jsx` | Call `useStores()`, pass to StapleChecker + PantryInput |
| `src/utils/stores.js` | **Delete** |

---

## Non-Goals

- Store rename / reorder UI
- Database-level foreign key constraints on `ingredients.store` / `staples.store`
- Multi-user / per-user store lists
- Icon or colour per store
