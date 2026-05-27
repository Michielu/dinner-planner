# Ingredient Autocomplete: Staples + Extras Auto-Add

**Date:** 2026-05-26
**Status:** Approved

## Problem

When creating a recipe, the ingredient autocomplete only searches the `ingredients` table. Staple items (from `staple_items`) are invisible to the recipe form, so users must retype them. Additionally, typing a brand-new ingredient name creates a permanent `ingredients` entry but does not add it to the current week's grocery extras — the user has to add it there manually.

## Design

### Autocomplete changes — `IngredientRow`

`IngredientRow` receives a new `staples` prop (`Array<{id, name, store, notes}>`).

Suggestions are built by merging both lists when the user types:

1. Filter `allIngredients` by the typed text (case-insensitive substring).
2. Filter `staples` by the typed text, then **remove any staple whose name matches an entry already in `allIngredients`** (case-insensitive exact match). This prevents duplicates when a staple has also been used as a recipe ingredient before.
3. Concatenate: ingredient matches first, then deduplicated staple matches. Slice to 8 results.

Each suggestion row in the dropdown renders:
- Bold name + store label (existing style)
- Staple-only items also show a small `staple` badge (green text, `text-xs`), rendered to the right of the store label

### Row state — `fromStaple` flag

Each ingredient row object gains `fromStaple: boolean` (default `false`).

- Selecting from the **ingredient** section of the dropdown: sets `existingId`, `fromStaple: false` (existing behaviour).
- Selecting from the **staple** section: sets `name` and `store` from the staple, sets `fromStaple: true`, leaves `existingId: null` (staples are not yet in the `ingredients` table).
- Typing manually: `existingId` and `fromStaple` remain as they were reset on each keystroke (`existingId: null`, `fromStaple: false`).

### Save logic — `RecipeForm.handleSubmit`

For each non-empty ingredient row, one of three paths applies:

| Condition | Action |
|---|---|
| `existingId` is set | Use it directly. No extras. |
| `fromStaple: true` | `findOrCreate(name, store)` → get/create ingredient entry. No extras (already a recurring staple on the grocery list). |
| `existingId` null + `fromStaple: false` | `findOrCreate(name, store)`. Then check if the name exists in either `allIngredients` or `staples` (case-insensitive exact match). If found in neither → also call `onAddExtra(name, store)`. If already known → no extras. |

The "already known" check prevents adding extras when a user types an ingredient name without clicking a suggestion (e.g. they type "ground beef" manually — it already exists so no extra is created).

### Component wiring

**`RecipesPage.jsx`**
- Add `import { useStaples } from '../hooks/useStaples'`
- Add `import { useGroceryExtras } from '../hooks/useGroceryExtras'`
- Call `const { staples } = useStaples()` and `const { addExtra } = useGroceryExtras()`
- Pass `staples={staples}` and `onAddExtra={addExtra}` to `<RecipeForm />`

**`RecipeForm.jsx`**
- Accept two new props: `staples: Array<{id, name, store, notes}>` and `onAddExtra: (name: string, store: string) => Promise<void>`
- Pass `staples` and `allIngredients` down to each `<IngredientRow />`
- Update `handleSubmit` with the three-path logic described above

**`IngredientAutocomplete.jsx`** (`IngredientRow`)
- Accept `staples` prop
- Build merged suggestion list on each keystroke
- Add `fromStaple` to row state; set it on staple selection

### No DB or hook changes

No schema changes. No new hooks. `useStaples` and `useGroceryExtras` already exist and are used elsewhere.

## Components changed

| File | Change |
|---|---|
| `src/pages/RecipesPage.jsx` | Call `useStaples` + `useGroceryExtras`; pass `staples` + `onAddExtra` to RecipeForm |
| `src/components/RecipeForm.jsx` | Accept `staples` + `onAddExtra` props; update `handleSubmit` with extras logic; pass `staples` + `allIngredients` to IngredientRow |
| `src/components/IngredientAutocomplete.jsx` | Accept `staples` prop; build merged suggestion list; add `fromStaple` flag to row state; show staple badge in dropdown |

## What does not change

- `useIngredients` hook — `findOrCreate` signature and return type unchanged
- `useStaples`, `useGroceryExtras` — no changes
- DB schema — no new tables or columns
- All other pages and components
