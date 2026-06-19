# Multi-Meal Per Day Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to assign multiple recipes to a single day in the week planner.

**Architecture:** Each day's slot changes from `slot | null` to `slot[] | null` in the `week_plan.slots` JSONB column. Two pure utility functions (`normalizeSlots`, `slotsToFlatArray`) handle backward-compat on load and grocery-list flattening. A new `DayDetail` bottom-sheet component (Variant B from the UI prototype) handles viewing, removing, and adding meals for a filled day. Empty days continue to open `RecipePicker` directly.

**Tech Stack:** React 18, React Router v7, Supabase (JSONB — no migration required), Vitest, Tailwind CSS

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/utils/weekPlan.js` | Add `normalizeSlots` and `slotsToFlatArray` |
| Modify | `tests/utils/weekPlan.test.js` | Tests for the two new utilities |
| Modify | `src/hooks/useWeekPlan.js` | Call `normalizeSlots` on load |
| Modify | `src/components/WeekGrid.jsx` | Render `slot[] \| null` per day; show multi-recipe display |
| Create | `src/components/DayDetail.jsx` | Bottom-sheet: view / remove / add meals for a filled day |
| Modify | `src/pages/PlannerPage.jsx` | Wire `DayDetail`; separate `pickerDay` / `detailDay` state; remove prototype code |
| Modify | `src/components/GroceryList.jsx` | Use `slotsToFlatArray` instead of manual `.map` |
| Delete | `src/pages/proto/MultiMealProto.jsx` | Prototype answered its question — delete it |

---

## Task 1: Add slot utility functions and tests

**Files:**
- Modify: `src/utils/weekPlan.js`
- Modify: `tests/utils/weekPlan.test.js`

- [ ] **Step 1: Write the failing tests**

First, update the import at line 2 of `tests/utils/weekPlan.test.js` to add the new exports:

```js
import { resolveSelectedStaples, normalizeSlots, slotsToFlatArray } from '../../src/utils/weekPlan.js'
```

Then append the following at the end of the file (after the closing `})` of the `resolveSelectedStaples` describe block):

```js
describe('normalizeSlots', () => {
  it('leaves null days as null', () => {
    const result = normalizeSlots({ monday: null, tuesday: null })
    expect(result).toEqual({ monday: null, tuesday: null })
  })

  it('wraps a bare slot object in an array', () => {
    const slot = { type: 'recipe', recipe: { id: 'r1', name: 'Chili' } }
    const result = normalizeSlots({ monday: slot, tuesday: null })
    expect(result.monday).toEqual([slot])
    expect(result.tuesday).toBeNull()
  })

  it('leaves an already-array slot unchanged', () => {
    const slot = { type: 'recipe', recipe: { id: 'r1', name: 'Chili' } }
    const result = normalizeSlots({ monday: [slot] })
    expect(result.monday).toEqual([slot])
  })

  it('handles mixed legacy and array slots', () => {
    const bare = { type: 'eating_out' }
    const arr = [{ type: 'recipe', recipe: { id: 'r2', name: 'Pasta' } }]
    const result = normalizeSlots({ monday: bare, tuesday: arr, wednesday: null })
    expect(result.monday).toEqual([bare])
    expect(result.tuesday).toEqual(arr)
    expect(result.wednesday).toBeNull()
  })
})

describe('slotsToFlatArray', () => {
  it('returns empty array when all days are null', () => {
    const result = slotsToFlatArray({ monday: null, tuesday: null })
    expect(result).toEqual([])
  })

  it('maps a single-recipe day to one flat entry with recipeId', () => {
    const slots = {
      monday: [{ type: 'recipe', recipe: { id: 'r1', name: 'Chili' } }],
      tuesday: null,
    }
    const result = slotsToFlatArray(slots)
    expect(result).toEqual([
      { day: 'monday', type: 'recipe', recipe: { id: 'r1', name: 'Chili' }, recipeId: 'r1' },
    ])
  })

  it('flattens two recipes on the same day into two entries', () => {
    const slots = {
      monday: [
        { type: 'recipe', recipe: { id: 'r1', name: 'Chili' } },
        { type: 'recipe', recipe: { id: 'r2', name: 'Corn Bread' } },
      ],
    }
    const result = slotsToFlatArray(slots)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ day: 'monday', recipeId: 'r1' })
    expect(result[1]).toMatchObject({ day: 'monday', recipeId: 'r2' })
  })

  it('includes eating_out slot with recipeId undefined', () => {
    const slots = { monday: [{ type: 'eating_out' }] }
    const result = slotsToFlatArray(slots)
    expect(result).toEqual([{ day: 'monday', type: 'eating_out', recipeId: undefined }])
  })
})
```

- [ ] **Step 2: Run tests — confirm they fail**

```bash
npm test 2>&1 | grep -A3 "normalizeSlots\|slotsToFlatArray"
```

Expected: errors about `normalizeSlots is not a function` and `slotsToFlatArray is not a function`.

- [ ] **Step 3: Add the two functions to `src/utils/weekPlan.js`**

Append after the existing `resolveSelectedStaples` function:

```js
/**
 * Normalizes a slots object from Supabase so each day's value is slot[] | null.
 * Legacy plans store a bare slot object; this wraps it in an array.
 */
export function normalizeSlots(slots) {
  return Object.fromEntries(
    Object.entries(slots).map(([day, val]) => [
      day,
      val === null ? null : Array.isArray(val) ? val : [val],
    ])
  )
}

/**
 * Flattens a slots object into the array format expected by generateGroceryList.
 * Each entry gets a `recipeId` field extracted from slot.recipe?.id.
 */
export function slotsToFlatArray(slots) {
  return Object.entries(slots)
    .filter(([, val]) => val !== null)
    .flatMap(([day, slotArr]) =>
      slotArr.map(slot => ({ day, ...slot, recipeId: slot?.recipe?.id }))
    )
}
```

- [ ] **Step 4: Run tests — confirm they pass**

```bash
npm test 2>&1 | grep -E "PASS|FAIL|normalizeSlots|slotsToFlatArray"
```

Expected: all `normalizeSlots` and `slotsToFlatArray` tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/weekPlan.js tests/utils/weekPlan.test.js
git commit -m "feat: add normalizeSlots and slotsToFlatArray utilities"
```

---

## Task 2: Update `useWeekPlan.js` to normalize slots on load

**Files:**
- Modify: `src/hooks/useWeekPlan.js`

- [ ] **Step 1: Add import at top of `src/hooks/useWeekPlan.js`**

Change:
```js
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
```

To:
```js
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeSlots } from '../utils/weekPlan'
```

- [ ] **Step 2: Call `normalizeSlots` in the load function**

In the `load` function inside `useEffect`, change:
```js
const loaded = {
  slots: { ...EMPTY_SLOTS, ...(data.slots ?? {}) },
```

To:
```js
const loaded = {
  slots: normalizeSlots({ ...EMPTY_SLOTS, ...(data.slots ?? {}) }),
```

- [ ] **Step 3: Verify the app still builds**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useWeekPlan.js
git commit -m "feat: normalize legacy slots to arrays on load"
```

---

## Task 3: Update `WeekGrid.jsx` for array slots

**Files:**
- Modify: `src/components/WeekGrid.jsx`

- [ ] **Step 1: Replace the full contents of `src/components/WeekGrid.jsx`**

```jsx
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SLOT_SPECIAL = {
  eating_out: { label: '🍽️ Eating Out', style: 'text-stone-grey italic' },
  flex:        { label: '🎲 Flex Night',  style: 'text-stone-grey italic' },
}

/**
 * Props:
 *   slots: Record<string, slot[] | null>
 *   onSlotClick: (day: string) => void
 */
export function WeekGrid({ slots, onSlotClick }) {
  return (
    <div className="space-y-2">
      {DAYS.map(day => {
        const key = day.toLowerCase()
        const slotArr = slots[key] ?? []
        const recipes = slotArr.filter(s => s.type === 'recipe')
        const special = slotArr.find(s => s.type !== 'recipe')

        return (
          <button
            key={day}
            onClick={() => onSlotClick(key)}
            className="w-full flex items-center gap-4 bg-willow-mist rounded-2xl px-5 py-4 shadow-card hover:opacity-90 transition-opacity text-left"
          >
            <span className="w-24 text-sm text-stone-grey font-bold tracking-wide shrink-0">{day}</span>
            <div className="flex-1 min-w-0">
              {special ? (
                <span className={`text-sm ${SLOT_SPECIAL[special.type].style}`}>
                  {SLOT_SPECIAL[special.type].label}
                </span>
              ) : recipes.length > 0 ? (
                <span className="text-sm text-soil-shadow font-bold">
                  {recipes.map(s => s.recipe?.name).join(' + ')}
                </span>
              ) : (
                <span className="text-sm text-stone-grey/50">+ pick meal</span>
              )}
            </div>
            {recipes.length > 1 && (
              <span className="text-xs bg-garden-patch/20 text-garden-patch rounded-full px-2 py-0.5 font-bold shrink-0">
                {recipes.length}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/WeekGrid.jsx
git commit -m "feat: update WeekGrid to render slot arrays per day"
```

---

## Task 4: Create `DayDetail.jsx`

**Files:**
- Create: `src/components/DayDetail.jsx`

- [ ] **Step 1: Create `src/components/DayDetail.jsx`**

```jsx
import { useState } from 'react'

const SLOT_LABEL = {
  eating_out: '🍽️ Eating Out',
  flex: '🎲 Flex Night',
}

/**
 * Bottom-sheet modal for viewing/editing meals assigned to a single day.
 *
 * Props:
 *   day: string — e.g. 'monday'
 *   slots: slot[] — current array of slots for this day
 *   recipes: Array<{id, name, category, ingredients: [{id, name}]}>
 *   categories: Array<{id, name}>
 *   pantryItems: string[]
 *   onAdd: (slot: {type, recipe?}) => void
 *   onRemove: (index: number) => void
 *   onClose: () => void
 */
export function DayDetail({ day, slots, recipes, categories, pantryItems, onAdd, onRemove, onClose }) {
  const [picking, setPicking] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  const normalised = pantryItems.map(p => p.toLowerCase())

  function matchesPantry(recipe) {
    if (normalised.length === 0) return false
    return recipe.ingredients.some(ing =>
      normalised.some(p => ing.name.toLowerCase().includes(p))
    )
  }

  const bySearch = search.trim()
    ? recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : recipes

  const byCategory = filterCategory === 'all'
    ? bySearch
    : bySearch.filter(r => r.category?.id === filterCategory)

  const pantryMatches = byCategory.filter(matchesPantry)
  const rest = byCategory.filter(r => !matchesPantry(r))

  function handlePick(slot) {
    onAdd(slot)
    setPicking(false)
    setSearch('')
    setFilterCategory('all')
  }

  function handleBackdropClick() {
    if (picking) {
      setPicking(false)
      setSearch('')
      setFilterCategory('all')
    } else {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-grain-sand rounded-t-3xl sm:rounded-3xl shadow-card w-full sm:max-w-sm flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-willow-mist rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-willow-mist">
          {picking ? (
            <button
              onClick={() => { setPicking(false); setSearch(''); setFilterCategory('all') }}
              className="text-sm text-stone-grey hover:text-soil-shadow"
            >
              ← Back
            </button>
          ) : (
            <p className="font-display font-light text-2xl tracking-tight text-soil-shadow capitalize">{day}</p>
          )}
          <button onClick={onClose} className="text-stone-grey hover:text-soil-shadow text-2xl leading-none hidden sm:block">
            &times;
          </button>
        </div>

        {!picking ? (
          <>
            {/* Meal pills */}
            <div className="overflow-y-auto px-4 pt-4 pb-2 flex flex-wrap gap-2">
              {slots.map((s, i) => (
                <button
                  key={i}
                  onClick={() => onRemove(i)}
                  className="flex items-center gap-1.5 bg-fresh-herb/30 hover:bg-red-100 text-soil-shadow hover:text-red-600 rounded-full px-3 py-2 text-sm font-bold transition-colors group"
                >
                  {s.type === 'recipe' ? s.recipe?.name : SLOT_LABEL[s.type]}
                  <span className="text-xs opacity-50 group-hover:opacity-100">✕</span>
                </button>
              ))}
            </div>
            <p className="px-5 text-xs text-stone-grey/60 mb-3">tap a meal to remove it</p>
            <div className="px-4 pb-5">
              <button
                onClick={() => setPicking(true)}
                className="w-full bg-garden-patch text-fresh-herb font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity"
              >
                + Add meal
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Quick options */}
            <div className="px-4 pt-3 pb-2 flex gap-2 border-b border-willow-mist">
              <button
                onClick={() => handlePick({ type: 'eating_out' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
              >
                🍽️ Eating Out
              </button>
              <button
                onClick={() => handlePick({ type: 'flex' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
              >
                🎲 Flex Night
              </button>
            </div>

            {/* Search */}
            <div className="px-4 pt-3 pb-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search recipes…"
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>

            {/* Category filter */}
            <div className="px-4 pb-2 flex gap-2 flex-wrap border-b border-willow-mist">
              {[{ id: 'all', name: 'All' }, ...categories].map(c => (
                <button
                  key={c.id}
                  onClick={() => setFilterCategory(c.id)}
                  className={`px-3 py-1 rounded-pill text-xs font-bold transition-colors ${
                    filterCategory === c.id
                      ? 'bg-garden-patch text-fresh-herb'
                      : 'bg-willow-mist text-stone-grey hover:bg-garden-patch/10'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>

            {/* Recipe list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {pantryMatches.length > 0 && (
                <>
                  <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Uses what you have</p>
                  {pantryMatches.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handlePick({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                      className="w-full text-left px-4 py-3 rounded-2xl bg-fresh-herb/30 border border-fresh-herb/50 hover:bg-fresh-herb/50 transition-colors shadow-card"
                    >
                      <span className="text-sm font-bold text-soil-shadow">{r.name}</span>
                      <span className="text-xs text-garden-patch ml-2">
                        {r.ingredients
                          .filter(i => normalised.some(p => i.name.toLowerCase().includes(p)))
                          .map(i => i.name)
                          .join(', ')}
                      </span>
                    </button>
                  ))}
                  {rest.length > 0 && <hr className="border-willow-mist my-2" />}
                </>
              )}
              {rest.map(r => (
                <button
                  key={r.id}
                  onClick={() => handlePick({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors"
                >
                  <span className="text-sm font-bold text-soil-shadow">{r.name}</span>
                </button>
              ))}
              {byCategory.length === 0 && (
                <p className="text-center text-stone-grey text-sm py-6">No recipes found.</p>
              )}
              <a
                href="/recipes"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-3 rounded-2xl border-2 border-dashed border-willow-mist text-stone-grey text-sm font-bold hover:border-garden-patch hover:text-garden-patch transition-colors"
              >
                + Add new recipe ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/DayDetail.jsx
git commit -m "feat: add DayDetail bottom-sheet component"
```

---

## Task 5: Update `PlannerPage.jsx`

**Files:**
- Modify: `src/pages/PlannerPage.jsx`

- [ ] **Step 1: Replace the full contents of `src/pages/PlannerPage.jsx`**

```jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { useStores } from '../hooks/useStores'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { RecipePicker } from '../components/RecipePicker'
import { DayDetail } from '../components/DayDetail'

export default function PlannerPage() {
  const navigate = useNavigate()
  const { recipes, categories, loading: recipesLoading } = useRecipes()
  const { staples, loading: staplesLoading } = useStaples()
  const { plan, planCreatedAt, loading: planLoading, updatePlan } = useWeekPlan()
  const { stores, loading: storesLoading } = useStores()

  // pickerDay: empty day → open RecipePicker directly
  // detailDay: filled day → open DayDetail bottom sheet
  const [pickerDay, setPickerDay] = useState(null)
  const [detailDay, setDetailDay] = useState(null)

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
    setPickerDay(null)
    setDetailDay(null)
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
    const daySlots = slots[day]
    if (!daySlots || daySlots.length === 0) {
      setPickerDay(day)
    } else {
      setDetailDay(day)
    }
  }

  // Empty day: RecipePicker sets the slot array to a single-item array
  function handlePickerSelect(slot) {
    const day = pickerDay
    updatePlan({ slots: { ...slots, [day]: [slot] } })
    setPickerDay(null)
  }

  // DayDetail: append a new slot to the day's array
  function handleDetailAdd(slot) {
    const dayArr = slots[detailDay] ?? []
    updatePlan({ slots: { ...slots, [detailDay]: [...dayArr, slot] } })
  }

  // DayDetail: remove slot at index; clear day if array empties
  function handleDetailRemove(index) {
    const dayArr = slots[detailDay] ?? []
    const updated = dayArr.filter((_, i) => i !== index)
    updatePlan({ slots: { ...slots, [detailDay]: updated.length ? updated : null } })
    if (updated.length === 0) setDetailDay(null)
  }

  if (recipesLoading || staplesLoading || planLoading || storesLoading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <PlannerShell
      phase={phase}
      visitedPhases={new Set(visitedPhases)}
      onNavigate={navigatePlanner}
    >
      {pickerDay && (
        <RecipePicker
          recipes={recipes}
          categories={categories}
          pantryItems={pantryItems.map(i => i.name)}
          onSelect={handlePickerSelect}
          onClose={() => setPickerDay(null)}
          day={pickerDay}
        />
      )}

      {detailDay && (
        <DayDetail
          day={detailDay}
          slots={slots[detailDay] ?? []}
          recipes={recipes}
          categories={categories}
          pantryItems={pantryItems.map(i => i.name)}
          onAdd={handleDetailAdd}
          onRemove={handleDetailRemove}
          onClose={() => setDetailDay(null)}
        />
      )}

      {phase === 'staples' && (
        <div className="max-w-md mx-auto p-4 sm:p-8">
          <StapleChecker
            stores={stores}
            onNext={handleStaplesNext}
            initialSelected={selectedStaples}
            onToggle={handleStaplesToggle}
          />
        </div>
      )}

      {phase === 'pantry' && (
        <div className="max-w-md mx-auto p-4 sm:p-8">
          <PantryInput stores={stores} onStart={handlePantryStart} initialSelected={pantryItems} />
        </div>
      )}

      {phase === 'plan' && (
        <div className="p-4 sm:p-6">
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

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlannerPage.jsx
git commit -m "feat: wire DayDetail and multi-recipe slot handling in PlannerPage"
```

---

## Task 6: Update `GroceryList.jsx`

**Files:**
- Modify: `src/components/GroceryList.jsx`

- [ ] **Step 1: Add import and replace slot-flattening logic**

At the top of `src/components/GroceryList.jsx`, add the import after the existing imports:

```js
import { slotsToFlatArray } from '../utils/weekPlan'
```

Then replace lines 16–18 (the `slotArray` construction) from:

```js
  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))
```

To:

```js
  const slotArray = slotsToFlatArray(slots)
```

Also update the JSDoc comment at the top of the component (line 5–6) to reflect the new slots shape:

```js
 *   slots: Record<string, slot[] | null>
```

- [ ] **Step 2: Run all tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests PASS (the grocery list tests exercise `generateGroceryList` directly and still receive a flat array, so they remain green).

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/GroceryList.jsx
git commit -m "feat: update GroceryList to flatten slot arrays via slotsToFlatArray"
```

---

## Task 7: Delete prototype files and clean up

**Files:**
- Delete: `src/pages/proto/MultiMealProto.jsx`
- Delete: `src/pages/proto/` (if now empty)

- [ ] **Step 1: Delete the prototype file**

```bash
rm src/pages/proto/MultiMealProto.jsx
rmdir src/pages/proto 2>/dev/null || true
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` with no errors.

- [ ] **Step 3: Run all tests one final time**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove multi-meal prototype after feature implementation"
```
