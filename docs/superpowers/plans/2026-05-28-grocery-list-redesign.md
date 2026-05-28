# Grocery List Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the wizard-step grocery list with a first-class `/grocery` page featuring a unified search-based add flow, removing the "Extra Grocery Items" concept entirely.

**Architecture:** `grocery_extras` table is dropped; `week_plan` gets `added_ingredient_ids uuid[]` instead. A new `GroceryPage` owns the search UI and data loading. `GroceryList` becomes a pure display component (no add form). The planner wizard shrinks to 3 steps; its "Grocery list →" button navigates to `/grocery` via React Router.

**Tech Stack:** React, React Router, Supabase JS, Vitest

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| DB migration | `supabase/migrations/20260528_grocery_list_redesign.sql` | Add `added_ingredient_ids`; drop `grocery_extras` |
| Modify | `src/utils/groceryList.js` | `extras` → `addedIngredients`; `isExtra` → `isAdded` |
| Modify | `tests/utils/groceryList.test.js` | Match renamed params + flags |
| Modify | `src/hooks/useWeekPlan.js` | Add `addedIngredientIds`; normalize invalid phase |
| Modify | `src/components/GroceryList.jsx` | New props; unified store grid; no add form |
| Modify | `src/components/PlannerShell.jsx` | Remove Grocery tab |
| Modify | `src/pages/PlannerPage.jsx` | Remove grocery phase; nav button → `/grocery` |
| Create | `src/pages/GroceryPage.jsx` | New page: search + list |
| Modify | `src/App.jsx` | Add route + nav item |
| Delete | `src/hooks/useGroceryExtras.js` | Removed entirely |

---

## Task 1: DB migration

**Files:**
- Create: `supabase/migrations/20260528_grocery_list_redesign.sql`
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260528_grocery_list_redesign.sql`:

```sql
-- Migration: grocery list redesign
-- Run this in the Supabase SQL editor.

-- 1. Add added_ingredient_ids to week_plan
alter table week_plan
  add column if not exists added_ingredient_ids uuid[] not null default '{}';

-- 2. Drop grocery_extras (replaced by added_ingredient_ids)
drop table if exists grocery_extras;
```

- [ ] **Step 2: Update schema.sql to reflect the new state**

In `supabase/schema.sql`, remove the `grocery_extras` table block entirely and add `added_ingredient_ids` to the `week_plan` table definition so the schema stays in sync with production:

In `week_plan`, add after `visited_phases`:
```sql
  added_ingredient_ids uuid[]      not null default '{}',
```

And delete the entire `grocery_extras` block:
```sql
-- One-off grocery items — added manually, not recurring staples
create table grocery_extras (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target', 'other')),
  created_at timestamptz not null default now()
);

alter table grocery_extras enable row level security;
create policy "anon_all" on grocery_extras for all to anon using (true) with check (true);
```

- [ ] **Step 3: Run the migration in Supabase SQL editor**

Paste and execute `supabase/migrations/20260528_grocery_list_redesign.sql` in the Supabase dashboard.

Verify: `week_plan` table now has `added_ingredient_ids` column. `grocery_extras` table is gone.

- [ ] **Step 4: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add supabase/
git commit -m "feat: add added_ingredient_ids to week_plan; drop grocery_extras"
```

---

## Task 2: Update `generateGroceryList` utility + tests

**Files:**
- Modify: `src/utils/groceryList.js`
- Modify: `tests/utils/groceryList.test.js`

Rename the fourth param from `extras` to `addedIngredients` and the flag from `isExtra` to `isAdded`. No logic change — purely a rename.

- [ ] **Step 1: Update the tests first (TDD — they'll fail until the util is updated)**

Replace the entire contents of `tests/utils/groceryList.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { generateGroceryList } from '../../src/utils/groceryList.js'

const RECIPES = [
  {
    id: 'r1',
    name: 'Pasta Bolognese',
    ingredients: [
      { id: 'i1', name: 'pasta', store: 'aldi' },
      { id: 'i2', name: 'ground beef', store: 'sams_club' },
    ],
  },
  {
    id: 'r2',
    name: 'Chicken Stir Fry',
    ingredients: [
      { id: 'i3', name: 'chicken breast', store: 'sams_club' },
      { id: 'i1', name: 'pasta', store: 'aldi' }, // duplicate ingredient
    ],
  },
]

const STAPLES = [
  { id: 's1', name: 'yogurt', store: 'sams_club', notes: 'check if running low' },
  { id: 's2', name: 'fruit', store: 'aldi', notes: null },
]

describe('generateGroceryList', () => {
  it('groups recipe ingredients by store', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    expect(result.aldi).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'pasta', isStaple: false, isAdded: false }),
    ]))
    expect(result.sams_club).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'ground beef', isStaple: false, isAdded: false }),
    ]))
    expect(result.target).toEqual([])
  })

  it('deduplicates ingredients used in multiple recipes', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
      { day: 'tuesday', type: 'recipe', recipeId: 'r2' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    const aldiNames = result.aldi.map(i => i.name)
    expect(aldiNames.filter(n => n === 'pasta')).toHaveLength(1)
  })

  it('tracks meals for each ingredient', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
      { day: 'tuesday', type: 'recipe', recipeId: 'r2' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    const pasta = result.aldi.find(i => i.name === 'pasta')
    expect(pasta.meals).toEqual(expect.arrayContaining(['Pasta Bolognese', 'Chicken Stir Fry']))
    const beef = result.sams_club.find(i => i.name === 'ground beef')
    expect(beef.meals).toEqual(['Pasta Bolognese'])
  })

  it('skips eating_out and flex slots', () => {
    const slots = [
      { day: 'monday', type: 'eating_out' },
      { day: 'tuesday', type: 'flex' },
    ]
    const result = generateGroceryList(slots, RECIPES, [])
    expect(result.sams_club).toEqual([])
    expect(result.aldi).toEqual([])
    expect(result.target).toEqual([])
  })

  it('always includes staples marked as isStaple: true', () => {
    const slots = []
    const result = generateGroceryList(slots, RECIPES, STAPLES)
    expect(result.sams_club).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'yogurt', isStaple: true, isAdded: false, notes: 'check if running low' }),
    ]))
    expect(result.aldi).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'fruit', isStaple: true, isAdded: false, notes: null }),
    ]))
  })

  it('includes both recipe ingredients and staples together', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
    ]
    const result = generateGroceryList(slots, RECIPES, STAPLES)
    expect(result.sams_club).toHaveLength(2) // ground beef + yogurt
    expect(result.aldi).toHaveLength(2) // pasta + fruit
  })

  it('includes other: [] in empty result', () => {
    const result = generateGroceryList([], [], [])
    expect(result).toEqual({ sams_club: [], aldi: [], target: [], other: [] })
  })

  it('appends addedIngredients into their store bucket with isAdded: true and id', () => {
    const addedIngredients = [
      { id: 'e1', name: 'Paper towels', store: 'sams_club' },
    ]
    const result = generateGroceryList([], [], [], addedIngredients)
    expect(result.sams_club).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Paper towels', isAdded: true, id: 'e1', isStaple: false }),
      ])
    )
  })

  it('creates store bucket dynamically if store key is missing (e.g. "other")', () => {
    const addedIngredients = [{ id: 'e2', name: 'Specialty sauce', store: 'other' }]
    const result = generateGroceryList([], [], [], addedIngredients)
    expect(result.other).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Specialty sauce', isAdded: true, id: 'e2' }),
      ])
    )
  })

  it('addedIngredients coexist in the same store bucket as recipe ingredients', () => {
    const slots = [{ day: 'monday', type: 'recipe', recipeId: 'r1' }]
    const addedIngredients = [{ id: 'e1', name: 'Paper towels', store: 'sams_club' }]
    const result = generateGroceryList(slots, RECIPES, [], addedIngredients)
    expect(result.sams_club).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'ground beef', isAdded: false }),
        expect.objectContaining({ name: 'Paper towels', isAdded: true, id: 'e1' }),
      ])
    )
  })

  it('groups ingredients with store "other" into result.other', () => {
    const recipesWithOther = [
      {
        id: 'r3',
        name: 'Mystery Meal',
        ingredients: [{ id: 'i4', name: 'specialty sauce', store: 'other' }],
      },
    ]
    const slots = [{ day: 'monday', type: 'recipe', recipeId: 'r3' }]
    const result = generateGroceryList(slots, recipesWithOther, [])
    expect(result.other).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'specialty sauce', isStaple: false }),
      ])
    )
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/michielu/code/dinner-planner && npm test -- tests/utils/groceryList.test.js
```

Expected: multiple FAIL — `isAdded` not found, `isExtra` still returned.

- [ ] **Step 3: Update `src/utils/groceryList.js`**

Replace the entire file:

```js
import { STORES } from './stores.js'

/**
 * Generates a grocery list grouped by store.
 *
 * @param {Array<{day: string, type: 'recipe'|'eating_out'|'flex', recipeId?: string}>} slots
 * @param {Array<{id: string, name: string, ingredients: Array<{id: string, name: string, store: string}>}>} recipes
 * @param {Array<{id: string, name: string, store: string, notes: string|null}>} staples
 * @param {Array<{id: string, name: string, store: string}>} addedIngredients
 * @returns {Record<string, Array>} — one key per store; each holds an array of items
 *   Recipe item:  {name, isStaple: false, isAdded: false, meals: string[]}
 *   Staple item:  {name, isStaple: true,  isAdded: false, notes: string|null}
 *   Added item:   {name, isStaple: false, isAdded: true,  id: string}
 */
export function generateGroceryList(slots, recipes, staples, addedIngredients = []) {
  const recipeMap = new Map(recipes.map(r => [r.id, r]))

  // ingredient id → {name, store, meals: string[]}
  const ingredientMap = new Map()

  for (const slot of slots) {
    if (slot.type !== 'recipe' || !slot.recipeId) continue
    const recipe = recipeMap.get(slot.recipeId)
    if (!recipe) continue
    for (const ing of recipe.ingredients) {
      if (!ingredientMap.has(ing.id)) {
        ingredientMap.set(ing.id, { name: ing.name, store: ing.store, meals: [] })
      }
      const entry = ingredientMap.get(ing.id)
      if (!entry.meals.includes(recipe.name)) {
        entry.meals.push(recipe.name)
      }
    }
  }

  const result = Object.fromEntries(STORES.map(s => [s.value, []]))

  for (const item of ingredientMap.values()) {
    if (!result[item.store]) result[item.store] = []
    result[item.store].push({ name: item.name, isStaple: false, isAdded: false, meals: item.meals })
  }

  for (const staple of staples) {
    if (!result[staple.store]) result[staple.store] = []
    result[staple.store].push({ name: staple.name, isStaple: true, isAdded: false, notes: staple.notes ?? null })
  }

  for (const ing of addedIngredients) {
    if (!result[ing.store]) result[ing.store] = []
    result[ing.store].push({ name: ing.name, isStaple: false, isAdded: true, id: ing.id })
  }

  return result
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd /Users/michielu/code/dinner-planner && npm test -- tests/utils/groceryList.test.js
```

Expected: 11 tests pass.

- [ ] **Step 5: Run full suite**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all 35 tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/utils/groceryList.js tests/utils/groceryList.test.js
git commit -m "feat: rename extras→addedIngredients, isExtra→isAdded in groceryList"
```

---

## Task 3: Update `useWeekPlan`

**Files:**
- Modify: `src/hooks/useWeekPlan.js`

Add `addedIngredientIds` to the persisted state. Also normalize any persisted `phase: 'grocery'` to `'plan'` (users with an old persisted plan won't get stuck).

- [ ] **Step 1: Replace `src/hooks/useWeekPlan.js`**

```js
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_SLOTS = {
  monday: null, tuesday: null, wednesday: null,
  thursday: null, friday: null, saturday: null, sunday: null,
}

const VALID_PHASES = ['staples', 'pantry', 'plan']

const DEFAULTS = {
  slots: EMPTY_SLOTS,
  selectedStapleIds: [],
  pantryItems: [],
  addedIngredientIds: [],
  phase: 'staples',
  visitedPhases: ['staples'],
}

/**
 * Owns the persisted week-plan state.
 *
 * @returns {{ plan, planCreatedAt, loading, updatePlan, resetPlan }}
 *   plan: { slots, selectedStapleIds, pantryItems, addedIngredientIds, phase, visitedPhases }
 *   planCreatedAt: ISO string | null
 *   updatePlan(patch) — shallow-merges patch and upserts to Supabase (optimistic)
 *   resetPlan() — deletes the DB row and resets local state to DEFAULTS
 */
export function useWeekPlan() {
  const [plan, setPlan] = useState(DEFAULTS)
  const [planCreatedAt, setPlanCreatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
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
          addedIngredientIds: data.added_ingredient_ids ?? [],
          // normalize stale 'grocery' phase from old data
          phase: VALID_PHASES.includes(data.phase) ? data.phase : 'plan',
          visitedPhases: (data.visited_phases ?? ['staples']).filter(p => VALID_PHASES.includes(p)),
        }
        planRef.current = loaded
        setPlan(loaded)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function updatePlan(patch) {
    const next = { ...planRef.current, ...patch }
    planRef.current = next
    setPlan(next)

    const row = {
      slots: next.slots,
      selected_staple_ids: next.selectedStapleIds,
      pantry_items: next.pantryItems,
      added_ingredient_ids: next.addedIngredientIds,
      phase: next.phase,
      visited_phases: next.visitedPhases,
      updated_at: new Date().toISOString(),
    }

    if (planIdRef.current) {
      supabase.from('week_plan').update(row).eq('id', planIdRef.current).then(() => {})
    } else {
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

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: all 35 tests pass (hook has no unit tests, but nothing should break).

- [ ] **Step 3: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/hooks/useWeekPlan.js
git commit -m "feat: add addedIngredientIds to useWeekPlan; normalize stale grocery phase"
```

---

## Task 4: Update `GroceryList` component

**Files:**
- Modify: `src/components/GroceryList.jsx`

Remove the add-item form, extras props, and section headers. Swap in the new unified store grid with per-item hints.

- [ ] **Step 1: Replace `src/components/GroceryList.jsx`**

```jsx
import { useState } from 'react'
import { generateGroceryList } from '../utils/groceryList'
import { STORES } from '../utils/stores'

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 *   addedIngredients: Array<{id, name, store}>
 *   onRemoveAdded: (id: string) => void
 */
export function GroceryList({ slots, recipes, staples, addedIngredients = [], onRemoveAdded }) {
  const [copyStatus, setCopyStatus] = useState(null)

  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples, addedIngredients)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  const storeColumns = STORES
    .map(s => ({ store: s, items: list[s.value] ?? [] }))
    .filter(col => col.items.length > 0)

  async function copyList() {
    const lines = []
    for (const { store, items } of storeColumns) {
      lines.push(store.label)
      for (const item of items) {
        const hint = item.isStaple
          ? (item.notes ? ` — ${item.notes}` : '')
          : item.meals?.length > 1
          ? ` (${item.meals.length} meals)`
          : item.meals?.length === 1
          ? ` (${item.meals[0]})`
          : ''
        lines.push(`  ${item.name}${hint}`)
      }
      lines.push('')
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n').trim())
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch {
      setCopyStatus('error')
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Store grid */}
      <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
        {total === 0 ? (
          <p className="text-center text-stone-grey py-8">No meals planned yet — nothing to buy.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {storeColumns.map(({ store, items }) => (
              <div key={store.value}>
                <h4 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h4>
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={item.isAdded ? item.id : i} className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                      {item.isAdded && onRemoveAdded ? (
                        <button
                          onClick={() => onRemoveAdded(item.id)}
                          className="text-stone-grey hover:text-red-500 text-base leading-none transition-colors shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          ×
                        </button>
                      ) : item.isStaple ? (
                        <span className="text-xs text-stone-grey shrink-0">staple</span>
                      ) : item.meals?.length > 1 ? (
                        <span className="text-xs text-stone-grey shrink-0">{item.meals.length} meals</span>
                      ) : item.meals?.length === 1 ? (
                        <span className="text-xs text-stone-grey shrink-0 truncate max-w-[120px]">{item.meals[0]}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-willow-mist flex justify-end">
        <button
          onClick={copyList}
          className={`px-5 py-2.5 text-sm font-bold rounded-pill shadow-card transition-opacity ${
            copyStatus === 'error'
              ? 'bg-red-400 text-white'
              : 'bg-fresh-herb text-soil-shadow hover:opacity-90'
          }`}
        >
          {copyStatus === 'copied' ? '✓ Copied!' : copyStatus === 'error' ? 'Copy failed' : '📋 Copy list'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: 35 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/components/GroceryList.jsx
git commit -m "feat: update GroceryList to unified store grid; remove extras UI"
```

---

## Task 5: Update `PlannerShell` and `PlannerPage`

**Files:**
- Modify: `src/components/PlannerShell.jsx`
- Modify: `src/pages/PlannerPage.jsx`

Remove the Grocery tab from the wizard. The "Grocery list →" button now uses React Router's `useNavigate` to go to `/grocery`.

- [ ] **Step 1: Update `src/components/PlannerShell.jsx`**

Remove `{ key: 'grocery', label: 'Grocery' }` from the TABS array. Change the line:

```js
const TABS = [
  { key: 'staples', label: 'Staples' },
  { key: 'pantry',  label: 'Pantry'  },
  { key: 'plan',    label: 'Plan'    },
  { key: 'grocery', label: 'Grocery' },
]
```

to:

```js
const TABS = [
  { key: 'staples', label: 'Staples' },
  { key: 'pantry',  label: 'Pantry'  },
  { key: 'plan',    label: 'Plan'    },
]
```

- [ ] **Step 2: Replace `src/pages/PlannerPage.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { RecipePicker } from '../components/RecipePicker'

export default function PlannerPage() {
  const navigate = useNavigate()
  const { recipes, categories, loading: recipesLoading } = useRecipes()
  const { staples, loading: staplesLoading } = useStaples()
  const { plan, planCreatedAt, loading: planLoading, updatePlan, resetPlan } = useWeekPlan()

  const [activeDay, setActiveDay] = useState(null)

  const { slots, selectedStapleIds, pantryItems, phase, visitedPhases } = plan

  const resolvedSelectedStapleIds = useMemo(
    () => resolveSelectedStaples(selectedStapleIds, staples, planCreatedAt),
    [selectedStapleIds, staples, planCreatedAt]
  )
  const selectedStaples = staples.filter(s => resolvedSelectedStapleIds.includes(s.id))

  function navigatePlanner(nextPhase) {
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
      onNavigate={navigatePlanner}
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
              onClick={() => navigate('/grocery')}
              className="bg-fresh-herb text-soil-shadow font-bold px-8 py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
            >
              Grocery list →
            </button>
          </div>
        </div>
      )}
    </PlannerShell>
  )
}
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: 35 tests pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/components/PlannerShell.jsx src/pages/PlannerPage.jsx
git commit -m "feat: remove grocery tab from planner; Grocery list button navigates to /grocery"
```

---

## Task 6: Create `GroceryPage`

**Files:**
- Create: `src/pages/GroceryPage.jsx`

New standalone page. Owns the search bar, data loading, and renders `GroceryList`.

- [ ] **Step 1: Create `src/pages/GroceryPage.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useIngredients } from '../hooks/useIngredients'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { GroceryList } from '../components/GroceryList'
import { STORES } from '../utils/stores'

export default function GroceryPage() {
  const { recipes, loading: recipesLoading } = useRecipes()
  const { staples, loading: staplesLoading } = useStaples()
  const { ingredients, loading: ingredientsLoading, findOrCreate } = useIngredients()
  const { plan, planCreatedAt, loading: planLoading, updatePlan } = useWeekPlan()

  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newItemStore, setNewItemStore] = useState('aldi')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const { slots, selectedStapleIds, addedIngredientIds } = plan

  const resolvedStapleIds = useMemo(
    () => resolveSelectedStaples(selectedStapleIds, staples, planCreatedAt),
    [selectedStapleIds, staples, planCreatedAt]
  )
  const selectedStaples = staples.filter(s => resolvedStapleIds.includes(s.id))
  const addedIngredients = ingredients.filter(i => addedIngredientIds.includes(i.id))

  // Search: combine ingredients + staples, filter by query, exclude already-added items
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const seen = new Set()
    const ingredientHits = ingredients
      .filter(i => i.name.toLowerCase().includes(q) && !addedIngredientIds.includes(i.id))
      .map(i => ({ ...i, isStaple: false }))
    const stapleHits = staples
      .filter(s => s.name.toLowerCase().includes(q) && !resolvedStapleIds.includes(s.id))
      .map(s => ({ ...s, isStaple: true }))
    return [...ingredientHits, ...stapleHits]
      .filter(r => { if (seen.has(r.name.toLowerCase())) return false; seen.add(r.name.toLowerCase()); return true })
      .slice(0, 8)
  }, [query, ingredients, staples, addedIngredientIds, resolvedStapleIds])

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return false
    return ingredients.some(i => i.name.toLowerCase() === q) || staples.some(s => s.name.toLowerCase() === q)
  }, [query, ingredients, staples])

  function handleAddExisting(item) {
    if (item.isStaple) {
      if (!resolvedStapleIds.includes(item.id)) {
        updatePlan({ selectedStapleIds: [...resolvedStapleIds, item.id] })
      }
    } else {
      if (!addedIngredientIds.includes(item.id)) {
        updatePlan({ addedIngredientIds: [...addedIngredientIds, item.id] })
      }
    }
    setQuery('')
    setShowDropdown(false)
    setAddingNew(false)
  }

  async function handleAddNew() {
    if (!query.trim()) return
    setSaving(true)
    setSaveError(false)
    try {
      const id = await findOrCreate(query.trim(), newItemStore)
      updatePlan({ addedIngredientIds: [...addedIngredientIds, id] })
      setQuery('')
      setNewItemStore('aldi')
      setAddingNew(false)
      setShowDropdown(false)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  function handleRemoveAdded(id) {
    updatePlan({ addedIngredientIds: addedIngredientIds.filter(x => x !== id) })
  }

  const loading = recipesLoading || staplesLoading || ingredientsLoading || planLoading

  if (loading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-willow-mist rounded-card shadow-card overflow-hidden">

        {/* Header */}
        <div className="px-6 py-5 border-b border-willow-mist flex items-center justify-between gap-4">
          <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">Grocery List</h1>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-willow-mist relative">
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setShowDropdown(true)
              setAddingNew(false)
              setSaveError(false)
            }}
            onFocus={() => setShowDropdown(true)}
            onBlur={() => setTimeout(() => { setShowDropdown(false); setAddingNew(false) }, 150)}
            onKeyDown={e => { if (e.key === 'Escape') { setShowDropdown(false); setAddingNew(false) } }}
            placeholder="Search to add an item…"
            className="w-full border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />

          {showDropdown && query.trim() && (
            <div className="absolute left-6 right-6 border border-willow-mist border-t-0 rounded-b-xl bg-field-cream z-10 overflow-hidden shadow-card">

              {searchResults.map(item => (
                <button
                  key={item.id}
                  onMouseDown={() => handleAddExisting(item)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-willow-mist/50 border-b border-willow-mist last:border-0"
                >
                  <span>
                    <span className="font-bold text-soil-shadow">{item.name}</span>
                    <span className="text-stone-grey ml-2 text-xs">
                      · {STORES.find(s => s.value === item.store)?.label}
                    </span>
                    {item.isStaple && (
                      <span className="ml-2 text-xs bg-willow-mist text-garden-patch px-1.5 py-0.5 rounded-full">staple</span>
                    )}
                  </span>
                  <span className="text-garden-patch text-xs font-bold shrink-0 ml-2">+ Add</span>
                </button>
              ))}

              {!hasExactMatch && (
                addingNew ? (
                  <div className="px-3 py-2.5 flex gap-2 items-center bg-fresh-herb/10 border-t border-willow-mist flex-wrap">
                    <span className="text-sm font-bold text-soil-shadow flex-1 min-w-0 truncate">"{query.trim()}"</span>
                    <select
                      value={newItemStore}
                      onChange={e => setNewItemStore(e.target.value)}
                      className="border border-willow-mist rounded-lg px-2 py-1 text-sm bg-field-cream focus:outline-none"
                    >
                      {STORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button
                      onMouseDown={handleAddNew}
                      disabled={saving}
                      className="bg-fresh-herb text-soil-shadow font-bold px-3 py-1 rounded-lg text-sm disabled:opacity-50"
                    >
                      {saving ? '…' : 'Add'}
                    </button>
                    <button
                      onMouseDown={() => setAddingNew(false)}
                      className="text-stone-grey text-sm px-1"
                    >
                      Cancel
                    </button>
                    {saveError && <span className="text-red-500 text-xs w-full">Failed to save — try again</span>}
                  </div>
                ) : (
                  <button
                    onMouseDown={() => setAddingNew(true)}
                    className="w-full px-3 py-2.5 text-sm text-left text-garden-patch font-bold hover:bg-willow-mist/50 border-t border-willow-mist"
                  >
                    ✚ Add "{query.trim()}" as new ingredient…
                  </button>
                )
              )}
            </div>
          )}
        </div>

        {/* List */}
        <GroceryList
          slots={slots}
          recipes={recipes}
          staples={selectedStaples}
          addedIngredients={addedIngredients}
          onRemoveAdded={handleRemoveAdded}
        />

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run full test suite**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: 35 tests pass.

- [ ] **Step 3: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/pages/GroceryPage.jsx
git commit -m "feat: create GroceryPage with search-based add flow"
```

---

## Task 7: Wire `App.jsx` + delete `useGroceryExtras`

**Files:**
- Modify: `src/App.jsx`
- Delete: `src/hooks/useGroceryExtras.js`

- [ ] **Step 1: Replace `src/App.jsx`**

```jsx
import { Routes, Route, NavLink } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'
import PlannerPage from './pages/PlannerPage'
import RecipesPage from './pages/RecipesPage'
import ManagePage from './pages/ManagePage'
import GroceryPage from './pages/GroceryPage'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-pill text-sm font-bold tracking-wide transition-colors ${
          isActive
            ? 'bg-garden-patch text-fresh-herb'
            : 'text-stone-grey hover:text-soil-shadow'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-field-cream font-body text-soil-shadow">
      <ConnectionBanner />
      <nav className="bg-willow-mist shadow-card px-6 py-4 flex items-center gap-3">
        <span className="font-display font-light text-2xl tracking-tight text-garden-patch mr-4">
          Dinner Planner
        </span>
        <NavItem to="/" label="This Week" />
        <NavItem to="/recipes" label="Recipes" />
        <NavItem to="/grocery" label="Grocery List" />
        <NavItem to="/manage" label="Staples & Categories" />
      </nav>
      <main className="max-w-4xl mx-auto">
        <Routes>
          <Route path="/" element={<PlannerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/manage" element={<ManagePage />} />
        </Routes>
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Delete `src/hooks/useGroceryExtras.js`**

```bash
rm /Users/michielu/code/dinner-planner/src/hooks/useGroceryExtras.js
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/michielu/code/dinner-planner && npm test
```

Expected: 35 tests pass.

- [ ] **Step 4: Start dev server and do a manual end-to-end check**

```bash
cd /Users/michielu/code/dinner-planner && npm run dev
```

Verify:
1. Nav shows: This Week | Recipes | Grocery List | Staples & Categories
2. "This Week" planner has 3 tabs (Staples, Pantry, Plan) — no Grocery tab
3. "Grocery list →" button on Plan step navigates to `/grocery`
4. `/grocery` page loads, shows the list (empty if no plan) with search bar
5. Searching an existing ingredient shows it in the dropdown; clicking "+ Add" adds it to the list
6. Searching something new shows "✚ Add … as new ingredient…"; clicking it shows store picker; confirming creates the ingredient and adds it to the list
7. Clicking × on a manually-added item removes it from the list
8. Reload the page — the list is still there (persisted via `week_plan`)

- [ ] **Step 5: Commit**

```bash
cd /Users/michielu/code/dinner-planner
git add src/App.jsx
git commit -m "feat: add /grocery route and nav item; remove useGroceryExtras

- GroceryPage accessible directly from main nav
- Planner wizard is now 3 steps (Staples, Pantry, Plan)
- grocery_extras concept fully replaced by addedIngredientIds

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
