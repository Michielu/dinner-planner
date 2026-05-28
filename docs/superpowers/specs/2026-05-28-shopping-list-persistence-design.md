# Shopping List Persistence — Design Spec
_2026-05-28_

## Problem

All week-plan state (selected staples, meal slots, pantry items, current phase) lives in React `useState` and is lost on page reload. Only `grocery_extras` already persists to Supabase. The user wants to add grocery items throughout the week and have everything intact when they return Thursday/Friday to finalise the list. Any staples added to the master list during the week should be automatically checked when the staples page is visited.

## Decisions

- **Storage:** Supabase (consistent with existing extras persistence; cross-device)
- **Reset:** Manual only — the existing Reset button clears the plan; no automatic weekly expiry
- **Granularity:** One active plan at a time, stored as a single row with JSONB fields

---

## Data Model

### New table: `week_plan`

```sql
create table week_plan (
  id                   uuid        primary key default gen_random_uuid(),
  slots                jsonb       not null default '{}',
  selected_staple_ids  uuid[]      not null default '{}',
  pantry_items         jsonb       not null default '[]',
  phase                text        not null default 'staples',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
```

One row = one active plan. The app always reads the single latest row. Reset deletes the row; the hook re-creates it on the next write.

### Existing table: `staple_items`

Add `created_at` to the select in `useStaples` — the column already exists (Supabase default), it just hasn't been fetched. This timestamp powers the auto-check logic.

---

## New Hook: `useWeekPlan`

**File:** `src/hooks/useWeekPlan.js`

**Interface:**

```js
useWeekPlan(staples)
// Returns:
{
  plan: {
    slots,              // Record<string, slot | null>
    selectedStapleIds,  // uuid[] — resolved: persisted + any new staples auto-checked
    pantryItems,        // Array<{name}>
    phase,              // 'staples' | 'pantry' | 'plan' | 'grocery'
  },
  loading,
  updatePlan(patch),   // shallow-merges patch and upserts to Supabase (optimistic)
  resetPlan(),         // deletes the row; next updatePlan re-creates it
}
```

**Read:** On mount, `select * from week_plan order by created_at desc limit 1`. If no row, defaults apply.

**Write:** `updatePlan(patch)` merges into local state immediately (optimistic), then upserts to Supabase in the background. No debounce — writes happen at natural transition points (tab changes, slot selection, staple toggles), not on every keystroke.

**Auto-check logic:** After loading the plan, any staple whose `created_at > plan.created_at` is added to `selectedStapleIds` automatically. Covers staples added mid-week from any page.

---

## PlannerPage Changes

- Replaces individual `useState` calls for `slots`, `phase`, `selectedStaples`, `pantryItems`, `visitedPhases` with data from `useWeekPlan`.
- On load: if a persisted plan exists, the user lands on the saved phase (e.g. `'grocery'`).
- Each handler calls `updatePlan` with the changed slice:
  - `handleStaplesNext(chosen)` → `{ selectedStapleIds: chosen.map(s=>s.id), phase: 'pantry' }`
  - `handlePantryStart(items)` → `{ pantryItems: items, phase: 'plan' }`
  - `handleSelect(slot)` → `{ slots: { ...slots, [activeDay]: slot } }`
  - `navigate(nextPhase)` → `{ phase: nextPhase }`
- Staple toggles in `StapleChecker` persist immediately via a new `onToggle` callback prop.
- `handleReset` calls `resetPlan()` and navigates to `'staples'`.

## StapleChecker Changes

- Receives new `onToggle(staple)` prop; called on every checkbox toggle so the selection is written to Supabase without waiting for "Next."
- `initialSelected` continues to be seeded externally (from `useWeekPlan`'s resolved `selectedStapleIds`).

## useStaples Changes

- Add `created_at` to the select query (one-line change).

---

## Error Handling

- Supabase write failures are silent (fire-and-forget). Local state is always authoritative; a failed write means the DB may be slightly stale but the session is unaffected.
- On load failure, defaults apply (empty plan, start at `'staples'`).

## Out of Scope

- Multi-user / multi-plan support
- Conflict resolution for concurrent edits across devices
- Automatic weekly reset
