# Pinned Ingredients Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pin individual ingredients from their ingredient catalogue to a specific day in the week plan, so ad-hoc cooking (e.g. "roasted vegetables") adds its items to the grocery list without requiring a full recipe.

**Architecture:** Add a new `pinned_ingredient` slot type to the existing `slots` JSONB column — no DB migration. DayDetail gets a two-zone layout (Meals / Grocery Additions) and an ingredient search picker. The grocery list utility and UI are extended to render pinned items with their day label.

**Tech Stack:** React, Vite, Supabase, Tailwind CSS, Vitest

## Global Constraints

- No DB migrations — use the existing `slots` JSONB column only
- Follow existing Tailwind colour tokens (`soil-shadow`, `garden-patch`, `fresh-herb`, `grain-sand`, `willow-mist`, `field-cream`, `stone-grey`)
- Test runner: `npm test` (vitest run)
- No new npm packages

---

### Task 1: Extend `generateGroceryList` to handle `pinned_ingredient` slots

**Files:**
- Modify: `src/utils/groceryList.js`
- Modify: `tests/utils/groceryList.test.js`

**Interfaces:**
- Consumes: flattened slot shape `{ day: string, type: 'pinned_ingredient', ingredient: { id: string, name: string, store: string } }` — produced by the existing `slotsToFlatArray`
- Produces: new item shape added to store buckets: `{ name: string, isStaple: false, isAdded: false, isPinned: true, day: string }` where `day` is title-cased (e.g. `'Monday'`)

- [ ] **Step 1: Write failing tests**

Append to `tests/utils/groceryList.test.js` inside the `describe('generateGroceryList', ...)` block:

```js
it('places pinned_ingredient slots into the correct store bucket', () => {
  const slots = [
    { day: 'wednesday', type: 'pinned_ingredient', ingredient: { id: 'p1', name: 'broccoli', store: 'aldi' } },
  ]
  const result = generateGroceryList(slots, [], [], [], TEST_STORES)
  expect(result.aldi).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'broccoli', isStaple: false, isAdded: false, isPinned: true, day: 'Wednesday' }),
    ])
  )
})

it('pinned_ingredient day is title-cased', () => {
  const slots = [
    { day: 'friday', type: 'pinned_ingredient', ingredient: { id: 'p2', name: 'olive oil', store: 'target' } },
  ]
  const result = generateGroceryList(slots, [], [], [], TEST_STORES)
  expect(result.target[0].day).toBe('Friday')
})

it('deduplicates same pinned ingredient on the same day', () => {
  const slots = [
    { day: 'monday', type: 'pinned_ingredient', ingredient: { id: 'p1', name: 'broccoli', store: 'aldi' } },
    { day: 'monday', type: 'pinned_ingredient', ingredient: { id: 'p1', name: 'broccoli', store: 'aldi' } },
  ]
  const result = generateGroceryList(slots, [], [], [], TEST_STORES)
  expect(result.aldi.filter(i => i.name === 'broccoli')).toHaveLength(1)
})

it('pinned ingredients from different days both appear', () => {
  const slots = [
    { day: 'monday', type: 'pinned_ingredient', ingredient: { id: 'p1', name: 'broccoli', store: 'aldi' } },
    { day: 'thursday', type: 'pinned_ingredient', ingredient: { id: 'p1', name: 'broccoli', store: 'aldi' } },
  ]
  const result = generateGroceryList(slots, [], [], [], TEST_STORES)
  expect(result.aldi.filter(i => i.name === 'broccoli')).toHaveLength(2)
})

it('pinned ingredients coexist with recipe ingredients in same store', () => {
  const slots = [
    { day: 'monday', type: 'recipe', recipeId: 'r1' },
    { day: 'tuesday', type: 'pinned_ingredient', ingredient: { id: 'p1', name: 'broccoli', store: 'aldi' } },
  ]
  const result = generateGroceryList(slots, RECIPES, [], [], TEST_STORES)
  expect(result.aldi).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'pasta', isStaple: false }),
      expect.objectContaining({ name: 'broccoli', isPinned: true }),
    ])
  )
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E 'FAIL|pinned'
```

Expected: 5 failures about `isPinned` / `day` not being present.

- [ ] **Step 3: Implement the extension in `src/utils/groceryList.js`**

After the existing `for (const ing of addedIngredients)` loop (around line 47) and before the sort loop, add:

```js
  for (const slot of slots) {
    if (slot.type !== 'pinned_ingredient' || !slot.ingredient) continue
    const { name, store } = slot.ingredient
    const day = slot.day.charAt(0).toUpperCase() + slot.day.slice(1)
    if (!result[store]) result[store] = []
    const duplicate = result[store].some(i => i.isPinned && i.name === name && i.day === day)
    if (!duplicate) {
      result[store].push({ name, isStaple: false, isAdded: false, isPinned: true, day })
    }
  }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --reporter=verbose 2>&1 | grep -E 'PASS|FAIL|pinned'
```

Expected: All 5 new tests pass, existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/groceryList.js tests/utils/groceryList.test.js
git commit -m "feat: extend generateGroceryList to handle pinned_ingredient slots"
```

---

### Task 2: Update `GroceryList.jsx` to display pinned items with day label

**Files:**
- Modify: `src/components/GroceryList.jsx`

**Interfaces:**
- Consumes: `item.isPinned: boolean`, `item.day: string` (title-cased) from Task 1
- Produces: visual day label next to pinned items; day in copy output

- [ ] **Step 1: Add `isPinned` branch to the item render in `GroceryList.jsx`**

Find the `<li>` render block (around line 65). The render currently ends with:

```jsx
) : item.meals?.length === 1 ? (
  <span className="text-xs text-stone-grey shrink-0 truncate max-w-[120px]">{item.meals[0]}</span>
) : null}
```

Replace that closing section to add the `isPinned` branch **before** `item.meals`:

```jsx
) : item.isPinned ? (
  <span className="text-xs text-stone-grey shrink-0 truncate max-w-[120px]">{item.day}</span>
) : item.meals?.length > 1 ? (
  <span className="text-xs text-stone-grey shrink-0">{item.meals.length} meals</span>
) : item.meals?.length === 1 ? (
  <span className="text-xs text-stone-grey shrink-0 truncate max-w-[120px]">{item.meals[0]}</span>
) : null}
```

- [ ] **Step 2: Update `copyList` to include day for pinned items**

Find the `const hint = ...` block inside `copyList` (around line 31). Replace it with:

```js
const hint = item.isStaple
  ? (item.notes ? ` — ${item.notes}` : '')
  : item.isPinned
  ? ` (${item.day})`
  : item.meals?.length > 1
  ? ` (${item.meals.length} meals)`
  : item.meals?.length === 1
  ? ` (${item.meals[0]})`
  : ''
```

- [ ] **Step 3: Verify visually — start dev server and open grocery page**

```bash
npm run dev
```

Open `http://localhost:5173/grocery`. The grocery list should render unchanged (no pinned items yet, added in later tasks).

- [ ] **Step 4: Commit**

```bash
git add src/components/GroceryList.jsx
git commit -m "feat: show day label for pinned ingredients in grocery list"
```

---

### Task 3: Replace `DayDetail.jsx` with two-zone layout

**Files:**
- Modify: `src/components/DayDetail.jsx`

**Interfaces:**
- Consumes: all existing props plus new prop `ingredients: { id: string, name: string, store: string }[]`
- `slots` now may contain `{ type: 'pinned_ingredient', ingredient: { id, name, store } }` entries alongside meal slots
- `onAdd` is called with `{ type: 'pinned_ingredient', ingredient: { id, name, store } }` to add a pinned ingredient
- `onRemove(index)` uses the slot's original index in the full `slots` array (unchanged)

- [ ] **Step 1: Replace `src/components/DayDetail.jsx` entirely with the two-zone implementation**

```jsx
import { useState } from 'react'

const SLOT_LABEL = {
  eating_out: '🍽️ Eating Out',
  flex: '🎲 Flex Night',
}

const FLAGS = [
  { flag: 'favorite', icon: '♥', label: 'Favorite' },
  { flag: 'quick',    icon: '⚡', label: 'Quick'   },
  { flag: 'easy',     icon: '✓', label: 'Easy'     },
]

const MEAL_TYPES = new Set(['recipe', 'eating_out', 'flex'])

export function DayDetail({ day, slots, recipes, categories, pantryItems, onAdd, onRemove, onClose, ingredients = [] }) {
  const [mode, setMode] = useState(null) // null | 'meal' | 'ingredient'
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [activeFlags, setActiveFlags] = useState(new Set())
  const [ingSearch, setIngSearch] = useState('')

  // Attach original index so onRemove receives the right position in the full slots array
  const mealSlots = slots
    .map((s, i) => ({ ...s, _index: i }))
    .filter(s => MEAL_TYPES.has(s.type))

  const pinnedSlots = slots
    .map((s, i) => ({ ...s, _index: i }))
    .filter(s => s.type === 'pinned_ingredient')

  const alreadyPinnedIds = new Set(pinnedSlots.map(s => s.ingredient?.id))

  function toggleFlag(flag) {
    setActiveFlags(prev => {
      const next = new Set(prev)
      next.has(flag) ? next.delete(flag) : next.add(flag)
      return next
    })
  }

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

  const byCategory = bySearch
    .filter(r => filterCategory === 'all' || r.category?.id === filterCategory)
    .filter(r => !activeFlags.has('favorite') || r.is_favorite)
    .filter(r => !activeFlags.has('quick')    || r.is_quick)
    .filter(r => !activeFlags.has('easy')     || r.is_easy)

  const pantryMatches = byCategory.filter(matchesPantry)
  const rest = byCategory.filter(r => !matchesPantry(r))

  const filteredIngredients = ingSearch.trim()
    ? ingredients.filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase()))
    : ingredients

  function resetPicker() {
    setMode(null)
    setSearch('')
    setIngSearch('')
    setFilterCategory('all')
    setActiveFlags(new Set())
  }

  function handlePickRecipe(slot) { onAdd(slot); resetPicker() }
  function handlePickIngredient(ing) {
    onAdd({ type: 'pinned_ingredient', ingredient: { id: ing.id, name: ing.name, store: ing.store } })
    resetPicker()
  }

  function handleBackdropClick() {
    if (mode) resetPicker()
    else onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-grain-sand rounded-t-3xl sm:rounded-3xl shadow-card w-full sm:max-w-sm flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-willow-mist rounded-full" />
        </div>

        <div className="px-5 py-4 flex items-center justify-between border-b border-willow-mist">
          {mode ? (
            <button onClick={resetPicker} className="text-sm text-stone-grey hover:text-soil-shadow">
              ← Back
            </button>
          ) : (
            <p className="font-display font-light text-2xl tracking-tight text-soil-shadow capitalize">{day}</p>
          )}
          <button onClick={onClose} className="text-stone-grey hover:text-soil-shadow text-2xl leading-none hidden sm:block">
            &times;
          </button>
        </div>

        {!mode ? (
          <div className="overflow-y-auto flex-1">
            {/* Meals section */}
            <div className="px-4 pt-4 pb-3">
              <p className="text-xs font-bold tracking-widest uppercase text-stone-grey mb-3">Meals</p>
              <div className="space-y-2">
                {mealSlots.map(s => {
                  const sourceUrl = s.type === 'recipe'
                    ? recipes.find(r => r.id === s.recipe?.id)?.source_url
                    : null
                  return (
                    <div key={s._index}>
                      <button
                        onClick={() => onRemove(s._index)}
                        className="flex items-center gap-1.5 bg-fresh-herb/30 hover:bg-red-100 text-soil-shadow hover:text-red-600 rounded-full px-3 py-2 text-sm font-bold transition-colors group"
                      >
                        {s.type === 'recipe' ? <span className="uppercase">{s.recipe?.name}</span> : SLOT_LABEL[s.type]}
                        <span className="text-xs opacity-50 group-hover:opacity-100">✕</span>
                      </button>
                      {sourceUrl && (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="block ml-3 mt-0.5 text-xs text-garden-patch hover:underline font-bold">
                          Source ↗
                        </a>
                      )}
                    </div>
                  )
                })}
                {mealSlots.length === 0 && (
                  <p className="text-sm text-stone-grey/40 py-1">No meals yet</p>
                )}
              </div>
              <button
                onClick={() => setMode('meal')}
                className="mt-3 w-full border-2 border-dashed border-willow-mist text-stone-grey hover:border-garden-patch hover:text-garden-patch rounded-2xl py-2.5 text-sm font-bold transition-colors"
              >
                + Add meal
              </button>
            </div>

            <div className="mx-4 border-t border-willow-mist" />

            {/* Grocery additions section */}
            <div className="px-4 pt-4 pb-5">
              <p className="text-xs font-bold tracking-widest uppercase text-stone-grey mb-3">Grocery additions</p>
              <div className="space-y-2">
                {pinnedSlots.map(s => (
                  <button
                    key={s._index}
                    onClick={() => onRemove(s._index)}
                    className="flex items-center gap-1.5 bg-field-cream border border-willow-mist hover:bg-red-50 hover:border-red-200 text-stone-grey hover:text-red-500 rounded-full px-3 py-2 text-sm font-bold transition-colors group"
                  >
                    <span className="uppercase">{s.ingredient?.name}</span>
                    <span className="text-xs opacity-50 group-hover:opacity-100">✕</span>
                  </button>
                ))}
                {pinnedSlots.length === 0 && (
                  <p className="text-sm text-stone-grey/40 py-1">Nothing added yet</p>
                )}
              </div>
              <button
                onClick={() => setMode('ingredient')}
                className="mt-3 w-full border-2 border-dashed border-willow-mist text-stone-grey hover:border-garden-patch hover:text-garden-patch rounded-2xl py-2.5 text-sm font-bold transition-colors"
              >
                + Add ingredient
              </button>
            </div>
          </div>
        ) : mode === 'meal' ? (
          <>
            <div className="px-4 pt-3 pb-2 flex gap-2 border-b border-willow-mist">
              <button onClick={() => handlePickRecipe({ type: 'eating_out' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors">
                🍽️ Eating Out
              </button>
              <button onClick={() => handlePickRecipe({ type: 'flex' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors">
                🎲 Flex Night
              </button>
            </div>

            <div className="px-4 pt-2 pb-2 flex gap-2">
              {FLAGS.map(({ flag, icon, label }) => (
                <button key={flag} onClick={() => toggleFlag(flag)}
                  className={`flex-1 border-2 rounded-2xl py-2 text-sm font-bold transition-colors ${
                    activeFlags.has(flag)
                      ? 'border-garden-patch bg-garden-patch/10 text-garden-patch'
                      : 'border-willow-mist text-stone-grey hover:border-garden-patch/40 hover:text-soil-shadow'
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="px-4 pt-1 pb-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search recipes…"
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>

            <div className="px-4 pb-3 flex gap-2 flex-wrap border-b border-willow-mist">
              {[{ id: 'all', name: 'All' }, ...categories].map(c => (
                <button key={c.id} onClick={() => setFilterCategory(c.id)}
                  className={`px-3 py-1 rounded-pill text-xs font-bold transition-colors ${
                    filterCategory === c.id
                      ? 'bg-garden-patch text-fresh-herb'
                      : 'bg-willow-mist text-stone-grey hover:bg-garden-patch/10'
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {pantryMatches.length > 0 && (
                <>
                  <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Uses what you have</p>
                  {pantryMatches.map(r => (
                    <button key={r.id}
                      onClick={() => handlePickRecipe({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                      className="w-full text-left px-4 py-3 rounded-2xl bg-fresh-herb/30 border border-fresh-herb/50 hover:bg-fresh-herb/50 transition-colors shadow-card">
                      <span className="text-sm font-bold text-soil-shadow uppercase">{r.name}</span>
                      <span className="text-xs text-garden-patch ml-2 uppercase">
                        {r.ingredients
                          .filter(i => normalised.some(p => i.name.toLowerCase().includes(p)))
                          .map(i => i.name)
                          .join(', ')}
                      </span>
                      <span className="ml-1 inline-flex gap-1">
                        {r.is_favorite && <span className="text-xs text-garden-patch">♥</span>}
                        {r.is_quick    && <span className="text-xs text-stone-grey">⚡</span>}
                        {r.is_easy     && <span className="text-xs text-stone-grey">✓</span>}
                      </span>
                    </button>
                  ))}
                  {rest.length > 0 && <hr className="border-willow-mist my-2" />}
                </>
              )}
              {rest.map(r => (
                <button key={r.id}
                  onClick={() => handlePickRecipe({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors">
                  <span className="text-sm font-bold text-soil-shadow uppercase">{r.name}</span>
                  <span className="ml-1 inline-flex gap-1">
                    {r.is_favorite && <span className="text-xs text-garden-patch">♥</span>}
                    {r.is_quick    && <span className="text-xs text-stone-grey">⚡</span>}
                    {r.is_easy     && <span className="text-xs text-stone-grey">✓</span>}
                  </span>
                </button>
              ))}
              {byCategory.length === 0 && (
                <p className="text-center text-stone-grey text-sm py-6">No recipes found.</p>
              )}
              <a href="/recipes" target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-3 rounded-2xl border-2 border-dashed border-willow-mist text-stone-grey text-sm font-bold hover:border-garden-patch hover:text-garden-patch transition-colors">
                + Add new recipe ↗
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pt-3 pb-2">
              <input value={ingSearch} onChange={e => setIngSearch(e.target.value)}
                placeholder="Search ingredients…"
                autoFocus
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {filteredIngredients.length === 0 && (
                <p className="text-center text-stone-grey text-sm py-6">No ingredients found.</p>
              )}
              {filteredIngredients.map(ing => (
                <button
                  key={ing.id}
                  onClick={() => !alreadyPinnedIds.has(ing.id) && handlePickIngredient(ing)}
                  disabled={alreadyPinnedIds.has(ing.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition-colors ${
                    alreadyPinnedIds.has(ing.id)
                      ? 'bg-willow-mist/50 text-stone-grey/40 cursor-default'
                      : 'bg-willow-mist hover:bg-fresh-herb/20'
                  }`}
                >
                  <span className="text-sm font-bold text-soil-shadow uppercase">{ing.name}</span>
                  {alreadyPinnedIds.has(ing.id) && <span className="ml-2 text-xs text-stone-grey/50">added</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify compilation — check the dev server has no errors**

```bash
curl -s http://localhost:5173/ | grep -i error | head -5
```

Expected: no errors. If the server isn't running: `npm run dev &` then retry.

- [ ] **Step 3: Manual smoke test**

1. Open `http://localhost:5173/?variant=` (no variant — uses new DayDetail)
2. Navigate to "This Week" and click any day
3. Confirm the modal shows "Meals" and "Grocery additions" sections
4. Click "+ Add meal" — confirm the recipe picker works as before
5. Click "+ Add ingredient" — confirm a search input appears showing your ingredient list
6. Pick an ingredient — confirm it appears in "Grocery additions" as a removable pill
7. Tap the pill to remove it — confirm it disappears
8. Navigate to the grocery list — confirm the pinned ingredient appears under its store with the day label

- [ ] **Step 4: Commit**

```bash
git add src/components/DayDetail.jsx
git commit -m "feat: replace DayDetail with two-zone meals/grocery-additions layout"
```

---

### Task 4: Update `PlannerPage.jsx` — wire ingredients, remove prototype code

**Files:**
- Modify: `src/pages/PlannerPage.jsx`

**Interfaces:**
- Consumes: `ingredients` from `useIngredients()` (already imported in the prototype version)
- Produces: clean PlannerPage with `ingredients` prop on `DayDetail`, all prototype code removed

- [ ] **Step 1: Replace `PlannerPage.jsx` with the clean production version**

```jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { useStores } from '../hooks/useStores'
import { useIngredients } from '../hooks/useIngredients'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { DayDetail } from '../components/DayDetail'

export default function PlannerPage() {
  const navigate = useNavigate()
  const { recipes, categories, loading: recipesLoading } = useRecipes()
  const { staples, loading: staplesLoading } = useStaples()
  const { plan, planCreatedAt, loading: planLoading, updatePlan } = useWeekPlan()
  const { stores, loading: storesLoading } = useStores()
  const { ingredients } = useIngredients()

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

  function handleDetailAdd(slot) {
    const dayArr = slots[detailDay] ?? []
    updatePlan({ slots: { ...slots, [detailDay]: [...dayArr, slot] } })
  }

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
          ingredients={ingredients}
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
                Using up: <span className="uppercase">{pantryItems.map(i => i.name).join(', ')}</span>
              </p>
            )}
          </div>

          <WeekGrid slots={slots} onSlotClick={day => setDetailDay(day)} />

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

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlannerPage.jsx
git commit -m "feat: wire ingredients prop into DayDetail, remove prototype scaffolding"
```

---

### Task 5: Delete prototype files

**Files:**
- Delete: `src/components/prototype/` (entire directory)

- [ ] **Step 1: Delete the prototype directory**

```bash
rm -rf /Users/michielu/code/dinner-planner/src/components/prototype
```

- [ ] **Step 2: Run all tests to confirm nothing broke**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: delete pinned-ingredients prototype files"
```

---

## Done

All five tasks complete. The feature is live: users can open any day, go to "Grocery additions", search and pin ingredients from their catalogue, and see them appear on the grocery list under the correct store with the day label. Pinned ingredients reset with the week plan.
