# Inline Ingredient Creation in Day Detail

**Date:** 2026-08-13
**Status:** Approved

## Problem

When adding a grocery ingredient from the day detail panel (This Week → day → Add Ingredient), the user can only pick from existing ingredients. There is no way to create a new one inline — they must navigate away to Manage → Catalog first.

## Design (Variant A — Expand-in-place)

When the search term in the ingredient picker does not exactly match any existing ingredient, a dashed "+ Create '[name]'" row appears at the bottom of the results list.

Clicking the row expands it in place into a mini-form:
- The ingredient name is shown as a label (not re-editable — the user already typed it)
- A store dropdown (all user stores, same as the rest of the app)
- An **Add** button and a **✕** dismiss button

Tapping **Add**:
1. Calls `findOrCreate(name, store)` from `useIngredients` — inserts the row in Supabase and refreshes the ingredients list
2. Immediately pins the new ingredient to the day (calls `onAdd` with `type: 'pinned_ingredient'`)
3. Collapses the form and resets the search input

The create row is hidden when the search is empty or when there is an exact case-insensitive match in the existing ingredient list.

## Scope

Exactly three files change:

| File | Change |
|---|---|
| `src/hooks/useIngredients.js` | No change — `findOrCreate` already exists |
| `src/pages/PlannerPage.jsx` | Pass `findOrCreate` to `DayDetail` as `onCreateIngredient` |
| `src/components/DayDetail.jsx` | Add create row UI + `expanded` / `createStore` state in the ingredient picker panel |

Prototype file `src/pages/PrototypeIngredientCreate.jsx` and its route in `App.jsx` are deleted after implementation.

## Out of scope

- Editing the name in the create form (user can rename later in Manage)
- Creating ingredients from the meal picker
- Any change to how existing ingredients are picked or pinned
