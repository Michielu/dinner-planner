# Extra Grocery Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users add one-off grocery items (not staples, not recipe ingredients) from both the Manage page and the Grocery tab, persisted in a new `grocery_extras` Supabase table.

**Architecture:** A new `grocery_extras` table and `useGroceryExtras` hook mirror the existing `staple_items` / `useStaples` pattern. `generateGroceryList` gains a 4th `extras` param that slots items into the correct store bucket. The hook is called in `PlannerPage` and its data flows down to `GroceryList`. `ManagePage` calls the hook independently for its own management UI.

**Tech Stack:** React 18, Supabase (PostgreSQL + anon RLS), Vitest (node env — no jsdom)

> **Prerequisite:** This plan imports `STORES` from `src/utils/stores.js`. If that file does not exist yet, create it before Task 1:
> ```js
> // src/utils/stores.js
> export const STORES = [
>   { value: 'sams_club', label: "Sam's Club" },
>   { value: 'aldi',      label: 'Aldi' },
>   { value: 'target',    label: 'Target' },
>   { value: 'other',     label: 'Other' },
> ]
> ```

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `src/utils/groceryList.js` | Add `extras` 4th param; append extras to store buckets |
| Modify | `tests/utils/groceryList.test.js` | Add extras tests |
| Create | `src/hooks/useGroceryExtras.js` | New hook — fetch, add, remove extras |
| Modify | `supabase/schema.sql` | Add `grocery_extras` table + RLS |
| Modify | `src/components/GroceryList.jsx` | Accept extras props; add "+ Add item" header form; render × on extras |
| Modify | `src/pages/PlannerPage.jsx` | Call `useGroceryExtras`; pass extras props to `GroceryList` |
| Modify | `src/pages/ManagePage.jsx` | Add "Extra Grocery Items" section with search, list, add form |

---

### Task 1: Update `generateGroceryList` to accept extras

**Files:**
- Modify: `src/utils/groceryList.js`
- Modify: `tests/utils/groceryList.test.js`

- [ ] **Step 1: Write the failing tests**

Add these two tests inside the existing `describe('generateGroceryList', ...)` block in `tests/utils/groceryList.test.js` (before the closing `})`):

```js
  it('appends extras into their store bucket with isExtra: true and id', () => {
    const extras = [
      { id: 'e1', name: 'Paper towels', store: 'sams_club' },
    ]
    const result = generateGroceryList([], [], [], extras)
    expect(result.sams_club).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Paper towels', isExtra: true, id: 'e1', isStaple: false }),
      ])
    )
  })

  it('creates store bucket dynamically if store key is missing (e.g. "other")', () => {
    const extras = [{ id: 'e2', name: 'Specialty sauce', store: 'other' }]
    const result = generateGroceryList([], [], [], extras)
    expect(result.other).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Specialty sauce', isExtra: true, id: 'e2' }),
      ])
    )
  })
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
cd /Users/michielu/code/dinner-planner
npx vitest run tests/utils/groceryList.test.js
```

Expected: the 2 new tests FAIL (`result.sams_club` missing extra item, `result.other` is `undefined`). Existing tests PASS.

- [ ] **Step 3: Update `src/utils/groceryList.js`**

Add the `extras` parameter and the loop that appends them. Replace the file with:

```js
/**
 * Generates a grocery list grouped by store.
 *
 * @param {Array<{day: string, type: 'recipe'|'eating_out'|'flex', recipeId?: string}>} slots
 * @param {Array<{id: string, name: string, ingredients: Array<{id: string, name: string, store: string}>}>} recipes
 * @param {Array<{id: string, name: string, store: string, notes: string|null}>} staples
 * @param {Array<{id: string, name: string, store: string}>} extras
 * @returns {Record<string, Array>} — one key per store; each holds an array of items
 *   Recipe item:  {name, isStaple: false, isExtra: false, meals: string[]}
 *   Staple item:  {name, isStaple: true,  isExtra: false, notes: string|null}
 *   Extra item:   {name, isStaple: false, isExtra: true,  id: string, meals: []}
 */
export function generateGroceryList(slots, recipes, staples, extras = []) {
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

  const result = { sams_club: [], aldi: [], target: [] }

  for (const item of ingredientMap.values()) {
    if (!result[item.store]) result[item.store] = []
    result[item.store].push({ name: item.name, isStaple: false, isExtra: false, meals: item.meals })
  }

  for (const staple of staples) {
    if (!result[staple.store]) result[staple.store] = []
    result[staple.store].push({ name: staple.name, isStaple: true, isExtra: false, notes: staple.notes ?? null })
  }

  for (const extra of extras) {
    if (!result[extra.store]) result[extra.store] = []
    result[extra.store].push({ name: extra.name, isStaple: false, isExtra: true, id: extra.id, meals: [] })
  }

  return result
}
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npx vitest run
```

Expected: all tests PASS including the 2 new ones.

- [ ] **Step 5: Commit**

```bash
git add src/utils/groceryList.js tests/utils/groceryList.test.js
git commit -m "feat: generateGroceryList accepts extras param, appends with isExtra: true"
```

---

### Task 2: Create `src/hooks/useGroceryExtras.js`

**Files:**
- Create: `src/hooks/useGroceryExtras.js`

This hook mirrors `useStaples` exactly — same fetch/refetch pattern, same Supabase client.

- [ ] **Step 1: Create the file**

```js
// src/hooks/useGroceryExtras.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useGroceryExtras() {
  const [extras, setExtras] = useState([])

  const fetchExtras = useCallback(async () => {
    const { data, error } = await supabase
      .from('grocery_extras')
      .select('id, name, store')
      .order('created_at', { ascending: false })
    if (!error) setExtras(data)
  }, [])

  useEffect(() => { fetchExtras() }, [fetchExtras])

  async function addExtra(name, store) {
    const { error } = await supabase
      .from('grocery_extras')
      .insert({ name, store })
    if (error) throw error
    await fetchExtras()
  }

  async function removeExtra(id) {
    const { error } = await supabase.from('grocery_extras').delete().eq('id', id)
    if (error) throw error
    await fetchExtras()
  }

  return { extras, addExtra, removeExtra }
}
```

- [ ] **Step 2: Run tests (smoke check — no new tests for hooks, they talk to Supabase)**

```bash
npx vitest run
```

Expected: all existing tests PASS. No new failures.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useGroceryExtras.js
git commit -m "feat: useGroceryExtras hook (fetch, add, remove)"
```

---

### Task 3: Update `supabase/schema.sql` and run the DB migration

**Files:**
- Modify: `supabase/schema.sql`

- [ ] **Step 1: Add the `grocery_extras` table to `supabase/schema.sql`**

Append this block at the end of the file (after the staple_items section):

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

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard → SQL editor. Run:

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

Expected: returns without error. The table now appears in the Supabase table list.

- [ ] **Step 3: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add grocery_extras table to schema"
```

---

### Task 4: Update `GroceryList` to show extras and the add-item form

**Files:**
- Modify: `src/components/GroceryList.jsx`

The component gains three new props: `extras`, `onAddExtra`, `onRemoveExtra`. The header gains a "+ Add item" button that toggles an inline form. Extras render with a `×` remove button.

- [ ] **Step 1: Replace the file content**

```jsx
import { useState } from 'react'
import { generateGroceryList } from '../utils/groceryList'
import { STORES } from '../utils/stores'

const STORE_CONFIG = STORES

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 *   extras: Array<{id, name, store}>
 *   onAddExtra: (name: string, store: string) => Promise<void>
 *   onRemoveExtra: (id: string) => Promise<void>
 */
export function GroceryList({ slots, recipes, staples, extras = [], onAddExtra, onRemoveExtra }) {
  const [copyStatus, setCopyStatus] = useState(null) // null | 'copied' | 'error'
  const [addingExtra, setAddingExtra] = useState(false)
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraStore, setNewExtraStore] = useState('aldi')

  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples, extras)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  async function handleAddExtra() {
    if (!newExtraName.trim()) return
    await onAddExtra(newExtraName.trim(), newExtraStore)
    setNewExtraName('')
    setNewExtraStore('aldi')
    setAddingExtra(false)
  }

  async function copyList() {
    const lines = STORE_CONFIG
      .filter(s => list[s.value]?.length > 0)
      .flatMap(s => [
        s.label,
        ...list[s.value].map(i => `  □ ${i.name}${i.isStaple ? ' ★' : ''}`),
        '',
      ])
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch {
      setCopyStatus('error')
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-willow-mist flex items-center justify-between gap-4">
        <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow">Grocery List</h2>
        <button
          onClick={() => setAddingExtra(true)}
          className="shrink-0 bg-fresh-herb text-soil-shadow font-bold text-sm px-4 py-2 rounded-pill shadow-card hover:opacity-90 transition-opacity"
        >
          + Add item
        </button>
      </div>

      {/* Inline add-item form */}
      {addingExtra && (
        <div className="px-6 py-3 border-b border-willow-mist flex gap-2 flex-wrap items-center bg-fresh-herb/10">
          <input
            autoFocus
            value={newExtraName}
            onChange={e => setNewExtraName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddExtra()}
            placeholder="Item name"
            className="flex-1 min-w-32 border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <select
            value={newExtraStore}
            onChange={e => setNewExtraStore(e.target.value)}
            className="border border-willow-mist rounded-xl bg-field-cream px-2 py-2 text-sm focus:outline-none"
          >
            {STORE_CONFIG.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={handleAddExtra}
            disabled={!newExtraName.trim()}
            className="bg-fresh-herb text-soil-shadow font-bold px-3 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setAddingExtra(false); setNewExtraName(''); setNewExtraStore('aldi') }}
            className="text-stone-grey px-2 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Store grid */}
      <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
        {total === 0 ? (
          <p className="text-center text-stone-grey py-8">No meals planned yet — nothing to buy.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STORE_CONFIG.map(store => {
              const items = list[store.value] ?? []
              return (
                <div key={store.value}>
                  <h3 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h3>
                  {items.length === 0 ? (
                    <p className="text-xs text-stone-grey/50">Nothing from here</p>
                  ) : (
                    <ul className="space-y-2">
                      {items.map((item, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-stone-grey mt-0.5 shrink-0">□</span>
                          <span className="flex-1">
                            <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                            {item.isStaple && (
                              <span className="ml-1 text-xs text-fresh-herb font-bold">★</span>
                            )}
                            {item.notes && (
                              <span className="block text-xs text-stone-grey">{item.notes}</span>
                            )}
                            {!item.isStaple && !item.isExtra && item.meals?.length > 0 && (
                              <span className="block text-xs text-stone-grey">{item.meals.join(', ')}</span>
                            )}
                          </span>
                          {item.isExtra && onRemoveExtra && (
                            <button
                              onClick={() => onRemoveExtra(item.id)}
                              className="text-stone-grey hover:text-red-500 text-base leading-none transition-colors shrink-0 mt-0.5"
                            >
                              ×
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
        {total > 0 && (
          <p className="text-xs text-stone-grey mt-6">★ staple — check if you have enough</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-willow-mist flex gap-3 justify-end">
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

> **Note:** If `src/utils/stores.js` doesn't exist yet, define `STORE_CONFIG` inline at the top of this file instead:
> ```js
> const STORE_CONFIG = [
>   { value: 'sams_club', label: "Sam's Club" },
>   { value: 'aldi',      label: 'Aldi' },
>   { value: 'target',    label: 'Target' },
>   { value: 'other',     label: 'Other' },
> ]
> ```
> and remove the `import { STORES }` line.

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/GroceryList.jsx
git commit -m "feat: GroceryList adds extras rendering and + Add item form"
```

---

### Task 5: Wire `useGroceryExtras` into `PlannerPage`

**Files:**
- Modify: `src/pages/PlannerPage.jsx`

- [ ] **Step 1: Update `src/pages/PlannerPage.jsx`**

Add the import after the existing hook imports:

```js
import { useGroceryExtras } from '../hooks/useGroceryExtras'
```

Add the hook call inside `PlannerPage`, alongside the existing `useRecipes` call:

```js
const { extras, addExtra, removeExtra } = useGroceryExtras()
```

Update the grocery phase render to pass the new props:

```jsx
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
```

The full updated file:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useGroceryExtras } from '../hooks/useGroceryExtras'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { RecipePicker } from '../components/RecipePicker'
import { GroceryList } from '../components/GroceryList'

const EMPTY_SLOTS = {
  monday: null, tuesday: null, wednesday: null,
  thursday: null, friday: null, saturday: null, sunday: null,
}

export default function PlannerPage() {
  const { recipes, categories, loading } = useRecipes()
  const { extras, addExtra, removeExtra } = useGroceryExtras()

  // phase: 'staples' | 'pantry' | 'plan' | 'grocery'
  const [phase, setPhase] = useState('staples')
  const [visitedPhases, setVisitedPhases] = useState(new Set(['staples']))
  const [selectedStaples, setSelectedStaples] = useState([])
  const [pantryItems, setPantryItems] = useState([])
  const [slots, setSlots] = useState(EMPTY_SLOTS)
  const [activeDay, setActiveDay] = useState(null)

  function navigate(nextPhase) {
    setPhase(nextPhase)
    setVisitedPhases(prev => new Set([...prev, nextPhase]))
    setActiveDay(null)
  }

  function handleStaplesNext(chosen) {
    setSelectedStaples(chosen)
    navigate('pantry')
  }

  function handlePantryStart(items) {
    setPantryItems(items)
    navigate('plan')
  }

  function handleSlotClick(day) {
    setActiveDay(day)
  }

  function handleSelect(slot) {
    setSlots(prev => ({ ...prev, [activeDay]: slot }))
    setActiveDay(null)
  }

  function handleReset() {
    setSlots(EMPTY_SLOTS)
    setPantryItems([])
    setSelectedStaples([])
    setActiveDay(null)
    setPhase('staples')
    setVisitedPhases(new Set(['staples']))
  }

  if (loading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <PlannerShell phase={phase} visitedPhases={visitedPhases} onNavigate={navigate} onReset={handleReset}>
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
          <StapleChecker onNext={handleStaplesNext} initialSelected={selectedStaples} />
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

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/PlannerPage.jsx
git commit -m "feat: PlannerPage wires useGroceryExtras into GroceryList"
```

---

### Task 6: Add "Extra Grocery Items" section to `ManagePage`

**Files:**
- Modify: `src/pages/ManagePage.jsx`

This adds a third section below "Staple Items". It uses `useGroceryExtras` independently (the hook is called twice across the app — once here, once in PlannerPage — each instance fetches and manages its own local state).

- [ ] **Step 1: Update `src/pages/ManagePage.jsx`**

Replace the file with:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useGroceryExtras } from '../hooks/useGroceryExtras'
import { useToast, Toast } from '../components/Toast'

const STORES = [
  { value: 'sams_club', label: "Sam's Club" },
  { value: 'aldi', label: 'Aldi' },
  { value: 'target', label: 'Target' },
  { value: 'other', label: 'Other' },
]

export default function ManagePage() {
  const { categories, addCategory, deleteCategory } = useRecipes()
  const { staples, addStaple, updateStaple, deleteStaple } = useStaples()
  const { extras, addExtra, removeExtra } = useGroceryExtras()
  const { toast, showToast, dismissToast } = useToast()

  const [newCategory, setNewCategory] = useState('')
  const [newStaple, setNewStaple] = useState({ name: '', store: 'aldi', notes: '' })
  const [editingStaple, setEditingStaple] = useState(null)
  const [newExtra, setNewExtra] = useState({ name: '', store: 'aldi' })
  const [extrasSearch, setExtrasSearch] = useState('')

  const filteredExtras = extrasSearch.trim()
    ? extras.filter(e => e.name.toLowerCase().includes(extrasSearch.toLowerCase()))
    : extras

  async function handleAddCategory(e) {
    e.preventDefault()
    if (!newCategory.trim()) return
    try {
      await addCategory(newCategory.trim())
      setNewCategory('')
    } catch {
      showToast("Couldn't save category, try again")
    }
  }

  async function handleDeleteCategory(id) {
    if (!confirm('Delete this category? Recipes using it will become uncategorised.')) return
    try {
      await deleteCategory(id)
    } catch {
      showToast("Couldn't delete category, try again")
    }
  }

  async function handleAddStaple(e) {
    e.preventDefault()
    if (!newStaple.name.trim()) return
    try {
      await addStaple({ name: newStaple.name.trim(), store: newStaple.store, notes: newStaple.notes.trim() || null })
      setNewStaple({ name: '', store: 'aldi', notes: '' })
    } catch {
      showToast("Couldn't save staple, try again")
    }
  }

  async function handleUpdateStaple(e) {
    e.preventDefault()
    try {
      await updateStaple(editingStaple.id, {
        name: editingStaple.name.trim(),
        store: editingStaple.store,
        notes: editingStaple.notes?.trim() || null,
      })
      setEditingStaple(null)
    } catch {
      showToast("Couldn't update staple, try again")
    }
  }

  async function handleDeleteStaple(id) {
    if (!confirm('Remove this staple from the weekly grocery list?')) return
    try {
      await deleteStaple(id)
    } catch {
      showToast("Couldn't delete staple, try again")
    }
  }

  async function handleAddExtra(e) {
    e.preventDefault()
    if (!newExtra.name.trim()) return
    try {
      await addExtra(newExtra.name.trim(), newExtra.store)
      setNewExtra({ name: '', store: 'aldi' })
    } catch {
      showToast("Couldn't save item, try again")
    }
  }

  async function handleRemoveExtra(id) {
    try {
      await removeExtra(id)
    } catch {
      showToast("Couldn't remove item, try again")
    }
  }

  return (
    <div className="p-6 space-y-10 max-w-2xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* Categories */}
      <section>
        <h2 className="font-display font-light text-2xl text-soil-shadow mb-4">Meal Categories</h2>
        <ul className="space-y-2 mb-4">
          {categories.map(cat => (
            <li key={cat.id} className="flex items-center justify-between bg-willow-mist rounded-2xl px-5 py-3 shadow-card">
              <span className="font-bold text-soil-shadow">{cat.name}</span>
              <button
                onClick={() => handleDeleteCategory(cat.id)}
                className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
          {categories.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No categories yet.</li>
          )}
        </ul>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="flex-1 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm">
            Add
          </button>
        </form>
      </section>

      {/* Staples */}
      <section>
        <h2 className="font-display font-light text-2xl text-soil-shadow mb-1">Staple Items</h2>
        <p className="text-sm text-stone-grey mb-4">These appear on every planning session for quick selection.</p>
        <ul className="space-y-2 mb-4">
          {staples.map(s => (
            <li key={s.id} className="bg-willow-mist rounded-2xl px-5 py-3 shadow-card">
              {editingStaple?.id === s.id ? (
                <form onSubmit={handleUpdateStaple} className="flex flex-wrap gap-2">
                  <input
                    value={editingStaple.name}
                    onChange={e => setEditingStaple(p => ({ ...p, name: e.target.value }))}
                    className="flex-1 min-w-32 border border-willow-mist rounded-xl bg-field-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                  />
                  <select
                    value={editingStaple.store}
                    onChange={e => setEditingStaple(p => ({ ...p, store: e.target.value }))}
                    className="border border-willow-mist rounded-xl bg-field-cream px-3 py-1.5 text-sm focus:outline-none"
                  >
                    {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                  <input
                    value={editingStaple.notes || ''}
                    onChange={e => setEditingStaple(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Note (optional)"
                    className="flex-1 min-w-40 border border-willow-mist rounded-xl bg-field-cream px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                  />
                  <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-4 py-1.5 rounded-pill text-sm hover:opacity-90">Save</button>
                  <button type="button" onClick={() => setEditingStaple(null)} className="text-stone-grey px-2 text-sm">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-soil-shadow">{s.name}</span>
                    <span className="text-xs text-stone-grey ml-2">{STORES.find(st => st.value === s.store)?.label}</span>
                    {s.notes && <span className="text-xs text-stone-grey ml-2">— {s.notes}</span>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingStaple(s)} className="text-garden-patch text-sm font-bold hover:underline">Edit</button>
                    <button onClick={() => handleDeleteStaple(s.id)} className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors">Remove</button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {staples.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No staples yet.</li>
          )}
        </ul>
        <form onSubmit={handleAddStaple} className="flex flex-wrap gap-2">
          <input
            value={newStaple.name}
            onChange={e => setNewStaple(p => ({ ...p, name: e.target.value }))}
            placeholder="Item name (e.g. yogurt)"
            className="flex-1 min-w-40 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <select
            value={newStaple.store}
            onChange={e => setNewStaple(p => ({ ...p, store: e.target.value }))}
            className="border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          >
            {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
          </select>
          <input
            value={newStaple.notes}
            onChange={e => setNewStaple(p => ({ ...p, notes: e.target.value }))}
            placeholder="Note (optional)"
            className="flex-1 min-w-40 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm">
            Add
          </button>
        </form>
      </section>

      {/* Extra Grocery Items */}
      <section>
        <h2 className="font-display font-light text-2xl text-soil-shadow mb-1">Extra Grocery Items</h2>
        <p className="text-sm text-stone-grey mb-4">One-off items to grab this week — not a recurring staple.</p>

        {extras.length > 0 && (
          <div className="relative mb-3">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-grey text-sm">🔍</span>
            <input
              value={extrasSearch}
              onChange={e => setExtrasSearch(e.target.value)}
              placeholder="Search extras…"
              className="w-full border border-willow-mist rounded-2xl bg-field-cream pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            />
          </div>
        )}

        <ul className="space-y-2 mb-4">
          {filteredExtras.map(e => (
            <li key={e.id} className="flex items-center justify-between bg-willow-mist rounded-2xl px-5 py-3 shadow-card">
              <div>
                <span className="font-bold text-soil-shadow">{e.name}</span>
                <span className="text-xs text-stone-grey ml-2">{STORES.find(s => s.value === e.store)?.label}</span>
              </div>
              <button
                onClick={() => handleRemoveExtra(e.id)}
                className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors"
              >
                Remove
              </button>
            </li>
          ))}
          {extras.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No extra items yet.</li>
          )}
          {extras.length > 0 && filteredExtras.length === 0 && (
            <li className="text-stone-grey text-sm px-2">No items match "{extrasSearch}".</li>
          )}
        </ul>

        <form onSubmit={handleAddExtra} className="flex flex-wrap gap-2">
          <input
            value={newExtra.name}
            onChange={e => setNewExtra(p => ({ ...p, name: e.target.value }))}
            placeholder="Item name (e.g. paper towels)"
            className="flex-1 min-w-40 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <select
            value={newExtra.store}
            onChange={e => setNewExtra(p => ({ ...p, store: e.target.value }))}
            className="border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          >
            {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
          </select>
          <button type="submit" className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm">
            Add
          </button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Smoke test in the browser**

Start the dev server: `npm run dev`

1. Go to Manage → scroll to "Extra Grocery Items" — empty state shows "No extra items yet."
2. Add "Paper towels" → Sam's Club → Add. Item appears in the list.
3. Add several more items until the search bar appears (it shows once at least one item exists).
4. Type in the search box — list filters in real time.
5. Click Remove — item disappears.
6. Go to This Week → Grocery tab — "Paper towels" appears under Sam's Club with a × button.
7. Click × — item removed from grocery list and from DB (gone on Manage page too after next load).
8. In the Grocery tab, click "+ Add item" — inline form appears. Add an item. It shows in the store column with ×.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ManagePage.jsx
git commit -m "feat: ManagePage adds Extra Grocery Items section with search"
```
