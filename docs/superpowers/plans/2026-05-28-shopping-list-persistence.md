# Shopping List Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the week's plan (slots, selected staples, pantry items, current phase) to Supabase so the shopping list survives page reloads; newly-added staples auto-check themselves.

**Architecture:** A new `week_plan` Supabase table stores the single active plan as JSONB. A `useWeekPlan` hook loads it on mount and writes optimistically on every state transition. `PlannerPage` delegates all week-state management to the hook; local state is reduced to transient UI (`activeDay`). A pure utility `resolveSelectedStaples` handles the auto-check logic and is independently unit-tested.

**Tech Stack:** React, Supabase JS client, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/utils/weekPlan.js` | Pure logic: `resolveSelectedStaples` |
| Create | `tests/utils/weekPlan.test.js` | Unit tests for above |
| Create | `src/hooks/useWeekPlan.js` | Supabase read/write for week state |
| Modify | `src/hooks/useStaples.js` | Add `created_at` to select |
| Modify | `src/components/StapleChecker.jsx` | Add `onToggle` prop |
| Modify | `src/pages/PlannerPage.jsx` | Wire `useWeekPlan`, remove local state |

---

## Task 1: Create `week_plan` table in Supabase

**Files:** DB migration only (SQL run in Supabase dashboard)

- [ ] **Step 1: Run this SQL in the Supabase SQL editor**

```sql
create table if not exists week_plan (
  id                  uuid        primary key default gen_random_uuid(),
  slots               jsonb       not null default '{}',
  selected_staple_ids uuid[]      not null default '{}',
  pantry_items        jsonb       not null default '[]',
  phase               text        not null default 'staples',
  visited_phases      text[]      not null default '{staples}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
```

- [ ] **Step 2: Verify in Supabase Table Editor**

The `week_plan` table should appear with all seven columns. It should be empty.

---

## Task 2: Add `resolveSelectedStaples` utility + tests

**Files:**
- Create: `src/utils/weekPlan.js`
- Create: `tests/utils/weekPlan.test.js`

This function merges persisted selected IDs with auto-checked new staples (any staple added after the plan was created).

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/weekPlan.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { resolveSelectedStaples } from '../../src/utils/weekPlan.js'

const PLAN_CREATED = '2026-05-26T10:00:00.000Z'

const STAPLES = [
  { id: 'a', created_at: '2026-05-25T09:00:00.000Z' }, // before plan
  { id: 'b', created_at: '2026-05-25T09:00:00.000Z' }, // before plan
  { id: 'c', created_at: '2026-05-27T08:00:00.000Z' }, // after plan — auto-check
  { id: 'd', created_at: '2026-05-28T12:00:00.000Z' }, // after plan — auto-check
]

describe('resolveSelectedStaples', () => {
  it('returns persisted IDs unchanged when no new staples exist', () => {
    const result = resolveSelectedStaples(['a'], STAPLES.slice(0, 2), PLAN_CREATED)
    expect(result).toEqual(['a'])
  })

  it('auto-adds staples created after plan started', () => {
    const result = resolveSelectedStaples(['a'], STAPLES, PLAN_CREATED)
    expect(result).toContain('a') // persisted
    expect(result).toContain('c') // new
    expect(result).toContain('d') // new
    expect(result).not.toContain('b') // old, not selected
  })

  it('does not duplicate IDs already in persisted list', () => {
    const result = resolveSelectedStaples(['a', 'c'], STAPLES, PLAN_CREATED)
    expect(result.filter(id => id === 'c').length).toBe(1)
  })

  it('returns persisted IDs as-is when planCreatedAt is null', () => {
    const result = resolveSelectedStaples(['a', 'b'], STAPLES, null)
    expect(result).toEqual(['a', 'b'])
  })

  it('returns empty array when no persisted IDs and no new staples', () => {
    const result = resolveSelectedStaples([], STAPLES.slice(0, 2), PLAN_CREATED)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/michielu/code/dinner-planner && npm test -- tests/utils/weekPlan.test.js
```

Expected: FAIL — `resolveSelectedStaples` not found / module missing.

- [ ] **Step 3: Create `src/utils/weekPlan.js`**

```js
/**
 * Merges persisted selected staple IDs with any staples added after the plan started.
 *
 * @param {string[]} persistedIds - UUIDs previously saved to week_plan
 * @param {Array<{id: string, created_at: string}>} staples - full master staple list
 * @param {string|null} planCreatedAt - ISO timestamp of week_plan.created_at
 * @returns {string[]} resolved list of selected IDs
 */
export function resolveSelectedStaples(persistedIds, staples, planCreatedAt) {
  if (!planCreatedAt) return persistedIds
  const planDate = new Date(planCreatedAt)
  const newIds = staples
    .filter(s => new Date(s.created_at) > planDate && !persistedIds.includes(s.id))
    .map(s => s.id)
  return [...persistedIds, ...newIds]
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/michielu/code/dinner-planner && npm test -- tests/utils/weekPlan.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
cd /Users/michielu/code/dinner-planner && git add src/utils/weekPlan.js tests/utils/weekPlan.test.js && git commit -m "feat: add resolveSelectedStaples utility with tests"
```

---

## Task 3: Update `useStaples` to fetch `created_at`

**Files:**
- Modify: `src/hooks/useStaples.js`

- [ ] **Step 1: Update the select query**

In `src/hooks/useStaples.js`, change line 10 from:

```js
      .select('id, name, store, notes')
```

to:

```js
      .select('id, name, store, notes, created_at')
```

- [ ] **Step 2: Verify the app still loads**

```bash
cd /Users/michielu/code/dinner-planner && npm run dev
```

Open the app. The Staples and Manage pages should load normally. The `created_at` field will now be present on each staple object (invisible to the UI, used by `useWeekPlan`).

- [ ] **Step 3: Run existing tests to confirm nothing broke**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/michielu/code/dinner-planner && git add src/hooks/useStaples.js && git commit -m "feat: expose created_at on staple_items select"
```

---

## Task 4: Build `useWeekPlan` hook

**Files:**
- Create: `src/hooks/useWeekPlan.js`

- [ ] **Step 1: Create `src/hooks/useWeekPlan.js`**

Note: `useWeekPlan` does NOT take `staples` as a param. It stores raw (explicitly selected) IDs and exposes `planCreatedAt`. `PlannerPage` handles the auto-check resolution after both staples and plan are loaded — this avoids a timing race where the plan effect fires before staples arrive.

```js
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_SLOTS = {
  monday: null, tuesday: null, wednesday: null,
  thursday: null, friday: null, saturday: null, sunday: null,
}

const DEFAULTS = {
  slots: EMPTY_SLOTS,
  selectedStapleIds: [],
  pantryItems: [],
  phase: 'staples',
  visitedPhases: ['staples'],
}

/**
 * Owns the persisted week-plan state.
 *
 * Does NOT resolve auto-checked staples — that's done in PlannerPage using
 * resolveSelectedStaples(plan.selectedStapleIds, staples, planCreatedAt) after
 * both the plan and staples have finished loading.
 *
 * @returns {{ plan, planCreatedAt, loading, updatePlan, resetPlan }}
 *   plan: { slots, selectedStapleIds (raw), pantryItems, phase, visitedPhases }
 *   planCreatedAt: ISO string | null
 *   updatePlan(patch) — shallow-merges patch and upserts to Supabase (optimistic)
 *   resetPlan() — deletes the DB row and resets local state to DEFAULTS
 */
export function useWeekPlan() {
  const [plan, setPlan] = useState(DEFAULTS)
  const [planCreatedAt, setPlanCreatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  // Refs avoid stale-closure bugs in updatePlan/resetPlan
  const planIdRef = useRef(null)
  const planRef = useRef(DEFAULTS)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('week_plan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        planIdRef.current = data.id
        setPlanCreatedAt(data.created_at)
        const loaded = {
          slots: { ...EMPTY_SLOTS, ...(data.slots ?? {}) },
          selectedStapleIds: data.selected_staple_ids ?? [],
          pantryItems: data.pantry_items ?? [],
          phase: data.phase ?? 'staples',
          visitedPhases: data.visited_phases ?? ['staples'],
        }
        planRef.current = loaded
        setPlan(loaded)
      }
      setLoading(false)
    }
    load()
  }, []) // runs once on mount

  async function updatePlan(patch) {
    const next = { ...planRef.current, ...patch }
    planRef.current = next
    setPlan(next)

    const row = {
      slots: next.slots,
      selected_staple_ids: next.selectedStapleIds,
      pantry_items: next.pantryItems,
      phase: next.phase,
      visited_phases: next.visitedPhases,
      updated_at: new Date().toISOString(),
    }

    if (planIdRef.current) {
      // fire-and-forget update
      supabase.from('week_plan').update(row).eq('id', planIdRef.current).then(() => {})
    } else {
      // first write — insert and capture the new ID
      const { data } = await supabase
        .from('week_plan')
        .insert(row)
        .select('id, created_at')
        .single()
      if (data) {
        planIdRef.current = data.id
        setPlanCreatedAt(data.created_at)
      }
    }
  }

  async function resetPlan() {
    if (planIdRef.current) {
      await supabase.from('week_plan').delete().eq('id', planIdRef.current)
    }
    planIdRef.current = null
    planRef.current = DEFAULTS
    setPlan(DEFAULTS)
    setPlanCreatedAt(null)
  }

  return { plan, planCreatedAt, loading, updatePlan, resetPlan }
}
```

- [ ] **Step 2: Smoke-test by importing in browser console**

```bash
cd /Users/michielu/code/dinner-planner && npm run dev
```

Open the app. No console errors on load. (The hook isn't wired yet — just confirm the import compiles.)

- [ ] **Step 3: Commit**

```bash
cd /Users/michielu/code/dinner-planner && git add src/hooks/useWeekPlan.js && git commit -m "feat: add useWeekPlan hook for Supabase-persisted week state"
```

---

## Task 5: Add `onToggle` prop to `StapleChecker`

**Files:**
- Modify: `src/components/StapleChecker.jsx`

The current `toggle` function only updates local state. We add an optional `onToggle(updatedSelected)` callback so the parent can persist on every toggle without waiting for "Next."

- [ ] **Step 1: Update `StapleChecker` prop signature and `toggle` function**

In `src/components/StapleChecker.jsx`, change the function signature from:

```js
export function StapleChecker({ onNext, initialSelected = [] }) {
```

to:

```js
export function StapleChecker({ onNext, initialSelected = [], onToggle }) {
```

Then update the `toggle` function from:

```js
  function toggle(staple) {
    setSelected(prev =>
      isSelected(staple.id)
        ? prev.filter(s => s.id !== staple.id)
        : [...prev, staple]
    )
  }
```

to:

```js
  function toggle(staple) {
    setSelected(prev => {
      const next = isSelected(staple.id)
        ? prev.filter(s => s.id !== staple.id)
        : [...prev, staple]
      onToggle?.(next)
      return next
    })
  }
```

- [ ] **Step 2: Verify no regressions**

```bash
cd /Users/michielu/code/dinner-planner && npm run dev
```

Navigate to the Staples step. Toggling staples should still work exactly as before (the `onToggle` prop is optional and does nothing if not provided).

- [ ] **Step 3: Run existing tests**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/michielu/code/dinner-planner && git add src/components/StapleChecker.jsx && git commit -m "feat: add onToggle callback prop to StapleChecker"
```

---

## Task 6: Wire `PlannerPage` to `useWeekPlan`

**Files:**
- Modify: `src/pages/PlannerPage.jsx`

This is the main integration. We replace four `useState` calls with `useWeekPlan`, seed all state from the persisted plan, and call `updatePlan` at every transition.

- [ ] **Step 1: Replace `PlannerPage` with the wired version**

Replace the entire contents of `src/pages/PlannerPage.jsx` with:

```jsx
import { useState, useMemo } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useGroceryExtras } from '../hooks/useGroceryExtras'
import { useStaples } from '../hooks/useStaples'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { RecipePicker } from '../components/RecipePicker'
import { GroceryList } from '../components/GroceryList'

export default function PlannerPage() {
  const { recipes, categories, loading: recipesLoading } = useRecipes()
  const { extras, addExtra, removeExtra } = useGroceryExtras()
  const { staples, loading: staplesLoading } = useStaples()
  const { plan, planCreatedAt, loading: planLoading, updatePlan, resetPlan } = useWeekPlan()

  // Transient UI state — no need to persist
  const [activeDay, setActiveDay] = useState(null)

  const { slots, selectedStapleIds, pantryItems, phase, visitedPhases } = plan

  // Resolve: raw persisted IDs + any staples added after the plan was created.
  // useMemo means this only runs after the loading guard passes (both staples
  // and plan are fully loaded), avoiding the async timing race.
  const resolvedSelectedStapleIds = useMemo(
    () => resolveSelectedStaples(selectedStapleIds, staples, planCreatedAt),
    [selectedStapleIds, staples, planCreatedAt]
  )

  // Full staple objects for StapleChecker and GroceryList
  const selectedStaples = staples.filter(s => resolvedSelectedStapleIds.includes(s.id))

  function navigate(nextPhase) {
    const updatedVisited = visitedPhases.includes(nextPhase)
      ? visitedPhases
      : [...visitedPhases, nextPhase]
    updatePlan({ phase: nextPhase, visitedPhases: updatedVisited })
    setActiveDay(null)
  }

  function handleStaplesNext(chosen) {
    const updatedVisited = visitedPhases.includes('pantry')
      ? visitedPhases
      : [...visitedPhases, 'pantry']
    updatePlan({
      selectedStapleIds: chosen.map(s => s.id),
      phase: 'pantry',
      visitedPhases: updatedVisited,
    })
  }

  function handleStaplesToggle(updatedSelected) {
    updatePlan({ selectedStapleIds: updatedSelected.map(s => s.id) })
  }

  function handlePantryStart(items) {
    const updatedVisited = visitedPhases.includes('plan')
      ? visitedPhases
      : [...visitedPhases, 'plan']
    updatePlan({ pantryItems: items, phase: 'plan', visitedPhases: updatedVisited })
  }

  function handleSlotClick(day) {
    setActiveDay(day)
  }

  function handleSelect(slot) {
    updatePlan({ slots: { ...slots, [activeDay]: slot } })
    setActiveDay(null)
  }

  async function handleReset() {
    await resetPlan()
    setActiveDay(null)
  }

  if (recipesLoading || staplesLoading || planLoading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <PlannerShell
      phase={phase}
      visitedPhases={new Set(visitedPhases)}
      onNavigate={navigate}
      onReset={handleReset}
    >
      {activeDay && (
        <RecipePicker
          recipes={recipes}
          categories={categories}
          pantryItems={pantryItems.map(i => i.name)}
          onSelect={handleSelect}
          onClose={() => setActiveDay(null)}
          day={activeDay}
        />
      )}

      {phase === 'staples' && (
        <div className="max-w-md mx-auto p-8">
          <StapleChecker
            onNext={handleStaplesNext}
            initialSelected={selectedStaples}
            onToggle={handleStaplesToggle}
          />
        </div>
      )}

      {phase === 'pantry' && (
        <div className="max-w-md mx-auto p-8">
          <PantryInput onStart={handlePantryStart} initialSelected={pantryItems} />
        </div>
      )}

      {phase === 'plan' && (
        <div className="p-6">
          <div className="mb-6">
            <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">This Week</h1>
            {pantryItems.length > 0 && (
              <p className="text-sm text-garden-patch mt-0.5 font-bold">
                Using up: {pantryItems.map(i => i.name).join(', ')}
              </p>
            )}
          </div>

          <WeekGrid slots={slots} onSlotClick={handleSlotClick} />

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => navigate('grocery')}
              className="bg-fresh-herb text-soil-shadow font-bold px-8 py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
            >
              Grocery list →
            </button>
          </div>
        </div>
      )}

      {phase === 'grocery' && (
        <GroceryList
          slots={slots}
          recipes={recipes}
          staples={selectedStaples}
          extras={extras}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
        />
      )}
    </PlannerShell>
  )
}
```

- [ ] **Step 2: Verify the full flow end-to-end**

```bash
cd /Users/michielu/code/dinner-planner && npm run dev
```

Walk through the full flow:
1. Load the app — starts at Staples (or wherever you left off if a plan exists)
2. Select a staple → toggle it → reload the page → come back to Staples and verify it's still checked
3. Proceed through Pantry → Plan → add a meal → Grocery
4. Reload the page — should land back on Grocery with everything intact
5. Add a grocery item from the Grocery page → reload → item should still be there
6. Click "↺ Start over" → should reset to Staples with nothing selected

- [ ] **Step 3: Test auto-check for new staples**

1. With an existing plan, go to the Manage page and add a new staple
2. Navigate back to the Planner
3. Go to the Staples tab — the new staple should already be checked

- [ ] **Step 4: Run existing tests**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/michielu/code/dinner-planner && git add src/pages/PlannerPage.jsx && git commit -m "feat: persist week plan state to Supabase via useWeekPlan

- Week phase, slots, selected staples, pantry items now survive reloads
- Staples added after plan started are auto-checked on the staples page
- Reset button deletes the DB row and returns to fresh state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
