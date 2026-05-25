# Extra Grocery Items

**Date:** 2026-05-25
**Status:** Approved

## Problem

There is no way to add one-off grocery items to the weekly list. Every item must either be a recurring staple or tied to a planned recipe. Users need a lightweight way to capture things like "paper towels" or "birthday cake mix" without creating a staple entry that recurs every week.

## Design

### Data model

A new `grocery_extras` table in Supabase:

```sql
create table grocery_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target', 'other')),
  created_at timestamptz not null default now()
);

alter table grocery_extras enable row level security;
create policy "anon_all" on grocery_extras for all to anon using (true) with check (true);
```

Extras persist until the user manually removes them. "Start over" in the Planner does **not** clear extras — they are managed independently from the Manage page.

### Hook — `src/hooks/useGroceryExtras.js`

Mirrors the `useStaples` pattern:
- Subscribes to `grocery_extras` on mount, unsubscribes on unmount
- Exposes `extras: Array<{id, name, store}>`, `addExtra(name, store): Promise<void>`, `removeExtra(id): Promise<void>`
- No `clearExtras` — extras are user-managed, not session-managed

### Manage page — new "Extra Grocery Items" section

A third section on `ManagePage`, below Staple Items, following the same visual pattern (heading + description + list + add form).

**Search:** A text input above the list that filters displayed items by name (client-side substring match, no DB call). The input is only rendered when there is at least one extra item.

**List:** Each row shows name, store label, and a Remove button. No Edit — extras are simple enough to remove and re-add.

**Add form:** Name input + store dropdown (all four stores including "Other") + Add button. Submitting saves to DB and clears the form.

### Grocery tab — inline add form

The `GroceryList` header gains a small "+ Add item" pill button. Clicking it toggles an inline form (name input + store dropdown + Add button + Cancel) that appears below the header, above the store grid. Submitting saves to DB via `onAddExtra` and dismisses the form.

Extras appear in the correct store column alongside recipe ingredients and staples. Each extra item renders with a small `×` button; clicking it calls `onRemoveExtra(id)`.

### `generateGroceryList` — 4th `extras` parameter

```js
generateGroceryList(slots, recipes, staples, extras = [])
```

Extras are appended to their store bucket with:
```js
{ name, isStaple: false, isExtra: true, id, meals: [] }
```

The `isExtra: true` flag and `id` allow `GroceryList` to render the `×` remove button only on extra items.

### `PlannerPage` wiring

`useGroceryExtras` is called in `PlannerPage` (not in `GroceryList`) so the hook is always mounted. `extras`, `onAddExtra` (`addExtra`), and `onRemoveExtra` (`removeExtra`) are passed as props to `GroceryList`.

### Copy list behaviour

The "📋 Copy list" function already iterates STORES and formats each item. Extras will appear naturally in the correct store section since they are already in the list data. No change needed.

## Components changed

| File | Change |
|------|--------|
| `supabase/schema.sql` | Add `grocery_extras` table + RLS |
| `src/hooks/useGroceryExtras.js` | New hook (create) |
| `src/pages/ManagePage.jsx` | Add "Extra Grocery Items" section with search, list, add form |
| `src/pages/PlannerPage.jsx` | Call `useGroceryExtras`; pass `extras`, `onAddExtra`, `onRemoveExtra` to `GroceryList` |
| `src/components/GroceryList.jsx` | Accept new props; add "+ Add item" toggle form in header; render `×` on extras; pass `extras` to `generateGroceryList` |
| `src/utils/groceryList.js` | Add optional `extras` 4th param; append extras to store buckets |
| `tests/utils/groceryList.test.js` | Add tests for extras parameter |

## What does not change

- Staple Items section on Manage page — untouched
- "Start over" in the Planner — does not clear extras
- RecipePicker, PlannerShell, StapleChecker, PantryInput — untouched
- Grocery list copy format — extras appear naturally, no change needed
