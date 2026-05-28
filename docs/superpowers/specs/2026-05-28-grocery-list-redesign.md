# Grocery List Redesign — Design Spec
_2026-05-28_

## Problem

The Grocery List is buried as step 4 of the planner wizard. "Extra Grocery Items" is a separate section with its own clunky add-item form. There's no way to search existing ingredients or staples to add them — you type a free-text name that isn't linked to anything in the catalog.

## Goals

- Grocery List becomes a top-level page (`/grocery`), accessible any time
- Remove the "Extra Grocery Items" section and concept
- Replace the add-item form with a unified search over the ingredient + staple catalog
- New items that don't exist in the catalog get added to the `ingredients` table
- Clean unified store-grouped list: no section headers, no checkboxes

## Decisions

- **Navigation:** own route at `/grocery`, new main nav item
- **Meal plan connection:** recipe ingredients still auto-populate
- **Data model:** `grocery_extras` table removed; replaced by `week_plan.added_ingredient_ids uuid[]`
- **New items:** become real ingredients (`ingredients` table); store chosen via inline picker in the search dropdown
- **Staples in search:** searchable; adding a staple result adds its ID to `selected_staple_ids` (not `added_ingredient_ids`)
- **Multi-meal items:** show "N meals" instead of listing meal names
- **No checkboxes:** plain item names with muted hint on right

---

## Data Model

### `week_plan` — one new column

```sql
alter table week_plan
  add column added_ingredient_ids uuid[] not null default '{}';
```

Items added via the grocery search are stored here as ingredient IDs. They are resolved to full `{id, name, store}` objects at render time by filtering the `ingredients` catalog.

### `grocery_extras` — removed

```sql
drop table if exists grocery_extras;
```

The `useGroceryExtras` hook is deleted. Any references to `extras` / `onAddExtra` / `onRemoveExtra` in `GroceryList.jsx` are removed.

---

## Navigation Changes

**`App.jsx`:**
- Add `<Route path="/grocery" element={<GroceryPage />} />`
- Add `<NavItem to="/grocery" label="Grocery List" />` in the nav bar

**`PlannerPage.jsx` + `PlannerShell.jsx`:**
- Remove the `'grocery'` phase entirely from the wizard
- Planner becomes 3 steps: Staples → Pantry → Plan
- The "Grocery list →" button in the Plan phase uses React Router's `useNavigate` to go to `/grocery`

**`useWeekPlan.js`:**
- Remove `'grocery'` from valid phases
- Add `addedIngredientIds: []` to `DEFAULTS`
- Read/write `added_ingredient_ids` alongside existing fields

---

## `generateGroceryList` utility

Replace the `extras` parameter with `addedIngredients`:

```js
// Before
generateGroceryList(slots, recipes, staples, extras)
// extras: Array<{id, name, store}>

// After
generateGroceryList(slots, recipes, staples, addedIngredients)
// addedIngredients: Array<{id, name, store}> — looked up from ingredients table by ID
```

Item shapes:
- Recipe item: `{name, isAdded: false, isStaple: false, meals: string[]}`
- Staple item: `{name, isAdded: false, isStaple: true, notes: string|null}`
- Added item: `{name, isAdded: true, isStaple: false, id: string}`

`meals.length > 1` → display "N meals"; `meals.length === 1` → display that meal's name; `meals.length === 0` → no hint.

---

## `GroceryList` component

**Props change:**

```js
// Before
GroceryList({ slots, recipes, staples, extras, onAddExtra, onRemoveExtra })

// After
GroceryList({ slots, recipes, staples, addedIngredients, onRemoveAdded })
```

**Visual changes:**
- Remove "Extra Grocery Items" section header — all items render in unified per-store columns
- Remove inline add-item form entirely (search lives in `GroceryPage`)
- No checkbox `□` prefix — plain bold item names
- Right-side hint per item:
  - Recipe item, 1 meal → meal name (muted)
  - Recipe item, 2+ meals → "2 meals" (muted)
  - Staple → "staple" (muted)
  - Added item → `×` button (calls `onRemoveAdded(item.id)`)

---

## New `GroceryPage`

**File:** `src/pages/GroceryPage.jsx`  
**Route:** `/grocery`

### Data loading

```js
const { staples } = useStaples()
const { ingredients, findOrCreate, refresh } = useIngredients()
const { plan, planCreatedAt, loading, updatePlan } = useWeekPlan()
const { recipes } = useRecipes()

// Resolved selected staples (includes auto-checked new ones)
const resolvedStapleIds = resolveSelectedStaples(plan.selectedStapleIds, staples, planCreatedAt)
const selectedStaples = staples.filter(s => resolvedStapleIds.includes(s.id))

// Added ingredients for this week
const addedIngredients = ingredients.filter(i => plan.addedIngredientIds.includes(i.id))
```

### Search

Client-side. On each keystroke, filter `[...ingredients, ...staples]` by name (case-insensitive contains). Results show:
- Store badge (`· Aldi`)
- "staple" pill for staple results
- "Add 'X' as new ingredient…" row at the bottom when query is non-empty and no exact match exists

Max 8 results shown. Dropdown closes on blur or Escape.

### Adding an item

| User action | Effect |
|---|---|
| Click existing ingredient | `updatePlan({ addedIngredientIds: [...plan.addedIngredientIds, id] })` |
| Click existing staple | `updatePlan({ selectedStapleIds: [...resolvedStapleIds, id] })` |
| Click "Add 'X' as new ingredient…" | Expand inline store picker → on confirm: `findOrCreate(name, store)` → add returned ID to `addedIngredientIds` |

Guard: do not add duplicate IDs.

### Removing an added item

```js
function handleRemoveAdded(id) {
  updatePlan({ addedIngredientIds: plan.addedIngredientIds.filter(x => x !== id) })
}
```

Passed to `GroceryList` as `onRemoveAdded`.

---

## Files Changed

| Action | File |
|--------|------|
| Create | `src/pages/GroceryPage.jsx` |
| Delete | `src/hooks/useGroceryExtras.js` |
| Modify | `src/App.jsx` — new route + nav item |
| Modify | `src/pages/PlannerPage.jsx` — remove grocery phase, navigate to `/grocery` |
| Modify | `src/components/PlannerShell.jsx` — remove Grocery tab |
| Modify | `src/hooks/useWeekPlan.js` — add `addedIngredientIds`, remove `grocery` phase |
| Modify | `src/utils/groceryList.js` — swap `extras` → `addedIngredients`, rename `isExtra` → `isAdded` |
| Modify | `src/components/GroceryList.jsx` — new props, remove extras UI, unified list |
| DB migration | add `added_ingredient_ids` to `week_plan`; drop `grocery_extras` |

---

## Error Handling

- Search failures (Supabase down): search is client-side over already-loaded data, so it always works once loaded
- `findOrCreate` failure: show inline error in the dropdown; form stays open for retry
- `updatePlan` failures are fire-and-forget (optimistic); same pattern as existing persistence

## Out of Scope

- Checking off items while shopping
- Quantity tracking
- Sharing the list with another user
