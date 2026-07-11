# Pinned Ingredients in Week Plan

**Date:** 2026-07-10  
**Status:** Approved

## Problem

Users want to plan ad-hoc cooking (e.g. "roasted vegetables") for a specific day without creating a full recipe. These one-off items still need their ingredients on the grocery list.

## Decision

Extend the existing `slots` JSONB column on `week_plan` with a new slot type: `pinned_ingredient`. No DB migration required.

## Data Model

New slot shape added to the existing `slots` record:

```json
{ "type": "pinned_ingredient", "ingredient": { "id": "uuid", "name": "broccoli", "store": "lidl" } }
```

- Stored per-day alongside `recipe`, `eating_out`, `flex` slots
- Reset wipes automatically (slots wipe = pinned ingredients wipe)
- Store is denormalized into the slot so grocery list needs no extra lookup

## DayDetail UI (Two-Zone Layout — Variant B)

`DayDetail.jsx` is replaced with a two-section layout:

**Meals section** (top)
- Shows `recipe`, `eating_out`, `flex` slots — existing behavior unchanged
- Dashed "+ Add meal" button opens the existing recipe picker

**Grocery Additions section** (bottom, separated by a divider)
- Shows `pinned_ingredient` slots as removable pills
- Dashed "+ Add ingredient" button opens an ingredient search
- Ingredient search filters the full ingredients list (from `useIngredients`)
- Already-pinned ingredients are greyed out and non-selectable
- Tapping a result calls `onAdd({ type: 'pinned_ingredient', ingredient: { id, name, store } })`
- Remove works via existing `onRemove(index)`

**New prop:** `ingredients: { id, name, store }[]` — passed from PlannerPage via `useIngredients()`  
No new callbacks needed in PlannerPage.

## WeekGrid

No changes. Pinned ingredients are only visible when tapping into a day.

## Grocery List

`generateGroceryList` is extended to handle `pinned_ingredient` slots from the flattened slots array.

New item shape:
```js
{ name, isStaple: false, isAdded: false, isPinned: true, day: 'Wednesday' }
```

`GroceryList.jsx` renders pinned items with the day label in place of meal names (same visual slot already used for recipe ingredient meal names).

## Cleanup

After implementation, delete `src/components/prototype/` and remove prototype imports/logic from `PlannerPage.jsx`.

## Files Changed

| File | Change |
|------|--------|
| `src/components/DayDetail.jsx` | Replace with two-zone layout; add `ingredients` prop |
| `src/pages/PlannerPage.jsx` | Add `useIngredients()`; pass `ingredients` to DayDetail; remove prototype code |
| `src/utils/groceryList.js` | Handle `pinned_ingredient` slot type |
| `src/components/GroceryList.jsx` | Render day label for pinned items |
| `src/components/prototype/` | Delete entirely |
