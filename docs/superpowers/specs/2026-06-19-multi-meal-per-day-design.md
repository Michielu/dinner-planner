# Multi-Meal Per Day

**Date:** 2026-06-19
**Status:** Approved — ready for implementation

## Problem

Each day in the week planner currently holds exactly one meal slot. Users can't record two dishes made together (e.g. chili + corn bread on the same night).

## Decision

Each day's slot changes from `slot | null` to `slot[] | null`. The shape of an individual slot is unchanged. Backward-compatible: any legacy bare-object slot is wrapped in an array on load.

## Data model

`slots` in `week_plan` (JSONB) currently stores:

```json
{ "monday": { "type": "recipe", "recipe": { "id": "...", "name": "Chili" } } }
```

After this change:

```json
{ "monday": [
    { "type": "recipe", "recipe": { "id": "...", "name": "Chili" } },
    { "type": "recipe", "recipe": { "id": "...", "name": "Corn Bread" } }
  ]
}
```

Empty day is `null`. No DB migration required — `slots` is JSONB and accepts either shape. Normalization happens in `useWeekPlan.js` on load.

## Components

### `useWeekPlan.js`
- On load: for each day in `slots`, if the value is a non-null non-array, wrap it in `[...]`.
- No other changes to the hook's interface.

### `WeekGrid.jsx`
- Accepts `slots: Record<string, slot[] | null>`.
- Renders recipe names joined with `+` (e.g. "Chili + Corn Bread") as a single line. If only one recipe, same as before.
- Shows a small count badge when there are 2+ meals.

### `DayDetail.jsx` (new component)
- Bottom sheet modal (Variant B from prototype).
- Props: `day`, `slots: slot[]`, `onClose`, `onAdd`, `onRemove(index)`.
- Renders each slot as a removable pill. Tapping a pill removes it.
- "Add meal" button calls `onAdd`, which opens `RecipePicker`.
- Has a drag-handle indicator at the top. Backdrop tap closes.

### `PlannerPage.jsx`
- `handleSlotClick(day)`: if day has existing slots → open `DayDetail`; if empty → open `RecipePicker` directly.
- `handleAddToDay(slot)`: appends to the day's array and calls `updatePlan`.
- `handleRemoveFromDay(day, index)`: filters slot out; sets day to `null` if array empties.

### `RecipePicker.jsx`
- Unchanged. Still returns a single selection.

### `groceryList.js`
- `generateGroceryList`: the `slots` parameter changes from a flat array of slot objects to `Object.values(slots).flat()` before the existing loop. Alternatively, update the caller to flatten before passing.

## Interaction flow

1. **Empty day** → tap row → `RecipePicker` opens → pick recipe → slot array set to `[selection]`.
2. **Filled day** → tap row → `DayDetail` bottom sheet opens → shows current meals as pills.
   - Tap a pill → recipe removed from array (day → null if last one).
   - Tap "Add meal" → `RecipePicker` opens → pick recipe → appended to array → back to `DayDetail`.
3. **Eating out / flex** → behave as before; the slot array holds a single `{type: 'eating_out'}` or `{type: 'flex'}` entry.

## Prototype

Three variants were built and evaluated (`src/pages/proto/MultiMealProto.jsx`). Variant B (bottom sheet) was chosen for being the most mobile-friendly. Delete the prototype file after implementation is complete.
