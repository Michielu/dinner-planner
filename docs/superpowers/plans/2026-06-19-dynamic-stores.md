# Dynamic Stores Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded `STORES` constant with a user-managed list persisted in a Supabase `stores` table, with add/remove UI in the Catalog page.

**Architecture:** A new `useStores()` hook (same shape as `useStaples`) fetches stores from Supabase. Each page that needs stores calls the hook and passes `stores` as a prop to child components. The hardcoded `src/utils/stores.js` is deleted. A SQL migration creates the `stores` table and seeds it with the current 4 stores so existing data remains valid.

**Tech Stack:** React 18, Tailwind CSS v3, Supabase (supabase-js v2), Vitest. Migration pattern: SQL files in `supabase/migrations/` run manually in the Supabase SQL editor.

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260619_add_stores.sql` | **Create** — stores table + seed |
| `src/utils/slugify.js` | **Create** — pure slug generation function |
| `tests/utils/slugify.test.js` | **Create** — unit tests for slugify |
| `src/hooks/useStores.js` | **Create** — fetch/add/delete hook |
| `src/utils/groceryList.js` | Modify — accept `stores` param instead of importing |
| `tests/utils/groceryList.test.js` | Modify — pass `stores` to all `generateGroceryList` calls |
| `src/components/IngredientAutocomplete.jsx` | Modify — accept `stores` prop |
| `src/components/StapleChecker.jsx` | Modify — accept `stores` prop |
| `src/components/PantryInput.jsx` | Modify — accept `stores` prop |
| `src/components/RecipeForm.jsx` | Modify — accept `stores` prop, pass to IngredientRow |
| `src/components/RecipeImport.jsx` | Modify — accept `stores` prop |
| `src/components/GroceryList.jsx` | Modify — accept `stores` prop |
| `src/pages/GroceryPage.jsx` | Modify — call `useStores()`, wire to GroceryList + generateGroceryList |
| `src/pages/RecipesPage.jsx` | Modify — call `useStores()`, wire to RecipeForm + RecipeImport |
| `src/pages/PlannerPage.jsx` | Modify — call `useStores()`, wire to StapleChecker + PantryInput |
| `src/pages/ManagePage.jsx` | Modify — add Stores tab, call `useStores()` |
| `src/utils/stores.js` | **Delete** |

---

## Task 1: slugify Utility + Tests

**Files:**
- Create: `src/utils/slugify.js`
- Create: `tests/utils/slugify.test.js`

This pure function converts a store label into a unique URL-safe slug, appending `_2`, `_3`, etc. if the base slug collides with an existing value.

- [ ] **Step 1: Write failing tests**

Create `tests/utils/slugify.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { slugify } from '../../src/utils/slugify.js'

describe('slugify', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slugify('Whole Foods')).toBe('whole_foods')
  })

  it('strips non-alphanumeric characters (except underscores)', () => {
    expect(slugify("Sam's Club")).toBe('sams_club')
  })

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  Aldi  ')).toBe('aldi')
  })

  it('collapses multiple spaces into a single underscore', () => {
    expect(slugify('Trader  Joe')).toBe('trader__joe')
  })

  it('returns the base slug when no collision', () => {
    expect(slugify('Target', ['aldi', 'sams_club'])).toBe('target')
  })

  it('appends _2 on first collision', () => {
    expect(slugify('Aldi', ['aldi'])).toBe('aldi_2')
  })

  it('appends _3 when _2 is also taken', () => {
    expect(slugify('Aldi', ['aldi', 'aldi_2'])).toBe('aldi_3')
  })

  it('works with no existing values argument', () => {
    expect(slugify('Costco')).toBe('costco')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test tests/utils/slugify.test.js
```

Expected: `FAIL` — module not found.

- [ ] **Step 3: Implement slugify**

Create `src/utils/slugify.js`:

```js
export function slugify(label, existingValues = []) {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')

  if (!existingValues.includes(base)) return base

  let i = 2
  while (existingValues.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test tests/utils/slugify.test.js
```

Expected: `8 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/slugify.js tests/utils/slugify.test.js
git commit -m "feat: add slugify utility for store value generation"
```

---

## Task 2: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260619_add_stores.sql`

> ⚠️ **This task requires manual execution in the Supabase SQL editor.** The agent creates the file; a human must run the SQL.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260619_add_stores.sql`:

```sql
-- Migration: add stores table for user-managed store list
-- Run this in the Supabase SQL editor.

create table if not exists stores (
  id         uuid    primary key default gen_random_uuid(),
  value      text    not null unique,
  label      text    not null,
  sort_order integer not null default 0
);

alter table stores enable row level security;
create policy "anon_all" on stores for all to anon using (true) with check (true);

-- Seed with the existing hardcoded stores so current data stays valid
insert into stores (value, label, sort_order) values
  ('sams_club', 'Sam''s Club', 0),
  ('aldi',      'Aldi',        1),
  ('target',    'Target',      2),
  ('other',     'Other',       3)
on conflict (value) do nothing;
```

- [ ] **Step 2: Run the migration**

Open the Supabase dashboard → SQL editor → paste and run the SQL above.

- [ ] **Step 3: Verify**

In the Supabase Table Editor, open the `stores` table. Confirm 4 rows exist: sams_club, aldi, target, other.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260619_add_stores.sql
git commit -m "feat: add stores table migration"
```

---

## Task 3: useStores Hook

**Files:**
- Create: `src/hooks/useStores.js`

Follows the exact same pattern as `src/hooks/useStaples.js`. `deleteStore` checks for in-use items before deleting and throws `{ inUse: true }` if found.

- [ ] **Step 1: Create the hook**

Create `src/hooks/useStores.js`:

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { slugify } from '../utils/slugify'

export function useStores() {
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStores = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('stores')
      .select('id, value, label, sort_order')
      .order('sort_order')
    if (!error) setStores(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStores() }, [fetchStores])

  async function addStore({ label }) {
    const value = slugify(label, stores.map(s => s.value))
    const sort_order = stores.length > 0
      ? Math.max(...stores.map(s => s.sort_order)) + 1
      : 0
    const { error } = await supabase
      .from('stores')
      .insert({ value, label: label.trim(), sort_order })
    if (error) throw error
    await fetchStores()
  }

  async function deleteStore(value) {
    const { count: ingCount } = await supabase
      .from('ingredients')
      .select('*', { count: 'exact', head: true })
      .eq('store', value)

    const { count: stapleCount } = await supabase
      .from('staple_items')
      .select('*', { count: 'exact', head: true })
      .eq('store', value)

    if ((ingCount ?? 0) > 0 || (stapleCount ?? 0) > 0) {
      throw { inUse: true }
    }

    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('value', value)
    if (error) throw error
    await fetchStores()
  }

  return { stores, loading, addStore, deleteStore }
}
```

- [ ] **Step 2: Verify the file was created**

Read the file back and confirm it matches.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStores.js
git commit -m "feat: add useStores hook"
```

---

## Task 4: Update generateGroceryList + Tests

**Files:**
- Modify: `src/utils/groceryList.js`
- Modify: `tests/utils/groceryList.test.js`

The function currently imports `STORES` to initialise an empty bucket per store. Change it to accept `stores` as a 5th parameter instead. Update all tests to pass a `TEST_STORES` array.

- [ ] **Step 1: Update groceryList.js**

Replace the entire content of `src/utils/groceryList.js`:

```js
/**
 * Generates a grocery list grouped by store.
 *
 * @param {Array<{day: string, type: 'recipe'|'eating_out'|'flex', recipeId?: string}>} slots
 * @param {Array<{id: string, name: string, ingredients: Array<{id: string, name: string, store: string}>}>} recipes
 * @param {Array<{id: string, name: string, store: string, notes: string|null}>} staples
 * @param {Array<{id: string, name: string, store: string}>} addedIngredients
 * @param {Array<{value: string, label: string, sort_order: number}>} stores
 * @returns {Record<string, Array>} — one key per store; each holds an array of items
 *   Recipe item:  {name, isStaple: false, isAdded: false, meals: string[]}
 *   Staple item:  {id, name, isStaple: true,  isAdded: false, notes: string|null}
 *   Added item:   {name, isStaple: false, isAdded: true,  id: string}
 */
export function generateGroceryList(slots, recipes, staples, addedIngredients = [], stores = []) {
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

  const result = Object.fromEntries(stores.map(s => [s.value, []]))

  for (const item of ingredientMap.values()) {
    if (!result[item.store]) result[item.store] = []
    result[item.store].push({ name: item.name, isStaple: false, isAdded: false, meals: item.meals })
  }

  for (const staple of staples) {
    if (!result[staple.store]) result[staple.store] = []
    result[staple.store].push({ id: staple.id, name: staple.name, isStaple: true, isAdded: false, notes: staple.notes ?? null })
  }

  for (const ing of addedIngredients) {
    if (!result[ing.store]) result[ing.store] = []
    result[ing.store].push({ name: ing.name, isStaple: false, isAdded: true, id: ing.id })
  }

  for (const store of Object.keys(result)) {
    result[store].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  }

  return result
}
```

- [ ] **Step 2: Update the tests**

Replace the entire content of `tests/utils/groceryList.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { generateGroceryList } from '../../src/utils/groceryList.js'

const TEST_STORES = [
  { value: 'sams_club', label: "Sam's Club", sort_order: 0 },
  { value: 'aldi',      label: 'Aldi',        sort_order: 1 },
  { value: 'target',    label: 'Target',       sort_order: 2 },
  { value: 'other',     label: 'Other',        sort_order: 3 },
]

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
    const result = generateGroceryList(slots, RECIPES, [], [], TEST_STORES)
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
    const result = generateGroceryList(slots, RECIPES, [], [], TEST_STORES)
    const aldiNames = result.aldi.map(i => i.name)
    expect(aldiNames.filter(n => n === 'pasta')).toHaveLength(1)
  })

  it('tracks meals for each ingredient', () => {
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
      { day: 'tuesday', type: 'recipe', recipeId: 'r2' },
    ]
    const result = generateGroceryList(slots, RECIPES, [], [], TEST_STORES)
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
    const result = generateGroceryList(slots, RECIPES, [], [], TEST_STORES)
    expect(result.sams_club).toEqual([])
    expect(result.aldi).toEqual([])
    expect(result.target).toEqual([])
  })

  it('always includes staples marked as isStaple: true', () => {
    const slots = []
    const result = generateGroceryList(slots, RECIPES, STAPLES, [], TEST_STORES)
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
    const result = generateGroceryList(slots, RECIPES, STAPLES, [], TEST_STORES)
    expect(result.sams_club).toHaveLength(2) // ground beef + yogurt
    expect(result.aldi).toHaveLength(2) // pasta + fruit
  })

  it('includes other: [] in empty result', () => {
    const result = generateGroceryList([], [], [], [], TEST_STORES)
    expect(result).toEqual({ sams_club: [], aldi: [], target: [], other: [] })
  })

  it('appends addedIngredients into their store bucket with isAdded: true and id', () => {
    const addedIngredients = [
      { id: 'e1', name: 'Paper towels', store: 'sams_club' },
    ]
    const result = generateGroceryList([], [], [], addedIngredients, TEST_STORES)
    expect(result.sams_club).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Paper towels', isAdded: true, id: 'e1', isStaple: false }),
      ])
    )
  })

  it('creates store bucket dynamically if store key is missing (e.g. "other")', () => {
    const addedIngredients = [{ id: 'e2', name: 'Specialty sauce', store: 'other' }]
    const result = generateGroceryList([], [], [], addedIngredients, TEST_STORES)
    expect(result.other).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Specialty sauce', isAdded: true, id: 'e2' }),
      ])
    )
  })

  it('addedIngredients coexist in the same store bucket as recipe ingredients', () => {
    const slots = [{ day: 'monday', type: 'recipe', recipeId: 'r1' }]
    const addedIngredients = [{ id: 'e1', name: 'Paper towels', store: 'sams_club' }]
    const result = generateGroceryList(slots, RECIPES, [], addedIngredients, TEST_STORES)
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
    const result = generateGroceryList(slots, recipesWithOther, [], [], TEST_STORES)
    expect(result.other).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'specialty sauce', isStaple: false }),
      ])
    )
  })
})
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: `35 passed` (all 5 test files, same count as before — all test assertions still valid).

- [ ] **Step 4: Commit**

```bash
git add src/utils/groceryList.js tests/utils/groceryList.test.js
git commit -m "feat: accept stores param in generateGroceryList, update tests"
```

---

## Task 5: Update IngredientAutocomplete

**Files:**
- Modify: `src/components/IngredientAutocomplete.jsx`

Remove the `STORES` import. Add `stores` as a prop to `IngredientRow`.

- [ ] **Step 1: Update the file**

Replace the entire content of `src/components/IngredientAutocomplete.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react'
import { mergeSuggestions } from '../utils/ingredientSuggestions'

/**
 * A single ingredient row: name autocomplete + store selector + remove button.
 *
 * Props:
 *   allIngredients: Array<{id, name, store}>
 *   staples: Array<{id, name, store, notes}>
 *   stores: Array<{value, label, sort_order}>
 *   value: {name: string, store: string, existingId: string|null, fromStaple: boolean}
 *   onChange: (value) => void
 *   onRemove: () => void
 */
export function IngredientRow({ allIngredients, staples = [], stores, value, onChange, onRemove }) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleNameChange(e) {
    const text = e.target.value
    onChange({ ...value, name: text, existingId: null, fromStaple: false })

    if (text.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const matches = mergeSuggestions(allIngredients, staples, text)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  function handleSelect(suggestion) {
    if (suggestion._isStaple) {
      onChange({ name: suggestion.name, store: suggestion.store, existingId: null, fromStaple: true })
    } else {
      onChange({ name: suggestion.name, store: suggestion.store, existingId: suggestion.id, fromStaple: false })
    }
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div className="flex gap-2 items-start" ref={containerRef}>
      <div className="flex-1 relative">
        <input
          value={value.name}
          onChange={handleNameChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Ingredient name"
          className="w-full border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
        />
        {showSuggestions && (
          <ul className="absolute z-10 mt-1 w-full bg-field-cream border border-willow-mist rounded-xl shadow-card text-sm max-h-48 overflow-y-auto">
            {suggestions.map(s => (
              <li
                key={`${s._isStaple ? 's' : 'i'}-${s.id}`}
                onMouseDown={() => handleSelect(s)}
                className="px-3 py-2 hover:bg-willow-mist cursor-pointer flex justify-between items-center"
              >
                <span className="font-bold text-soil-shadow">{s.name}</span>
                <span className="flex items-center gap-1.5">
                  {s._isStaple && (
                    <span className="text-xs text-garden-patch font-bold" title="In your staples list">staple</span>
                  )}
                  <span className="text-stone-grey text-xs">
                    {stores.find(st => st.value === s.store)?.label}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <select
        value={value.store}
        onChange={e => onChange({ ...value, store: e.target.value })}
        className="border border-willow-mist rounded-xl bg-field-cream px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
      >
        {stores.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="text-stone-grey hover:text-red-500 px-2 py-2 text-lg leading-none transition-colors"
      >
        &times;
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Verify**

```bash
npm test
```

Expected: all tests still pass (IngredientAutocomplete has no unit tests — visual check only after pages are wired in later tasks).

- [ ] **Step 3: Commit**

```bash
git add src/components/IngredientAutocomplete.jsx
git commit -m "feat: accept stores prop in IngredientRow instead of importing STORES"
```

---

## Task 6: Update StapleChecker

**Files:**
- Modify: `src/components/StapleChecker.jsx`

Remove `STORES` import, add `stores` prop.

- [ ] **Step 1: Update the file**

Replace the import line and add `stores` to the prop signature and usages. Replace the entire file:

```jsx
import { useState, useEffect } from 'react'
import { useStaples } from '../hooks/useStaples'

/**
 * Props:
 *   stores: Array<{value, label, sort_order}>
 *   onNext: (selectedStaples: Array<{id, name, store, notes}>) => void
 *   initialSelected: Array<{id, name, store, notes}>
 *   onToggle: (selected: Array) => void
 */
export function StapleChecker({ stores, onNext, initialSelected = [], onToggle }) {
  const { staples, addStaple } = useStaples()
  const [selected, setSelected] = useState(initialSelected)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStore, setNewStore] = useState('aldi')
  const [saving, setSaving] = useState(false)
  // Names pending auto-selection (after addStaple, before list refresh)
  const [pendingNames, setPendingNames] = useState(new Set())

  // When staples list refreshes, auto-select any newly added staples
  useEffect(() => {
    if (pendingNames.size === 0) return
    const toSelect = staples.filter(s => pendingNames.has(s.name.toLowerCase()))
    if (toSelect.length === 0) return
    setSelected(prev => {
      const existingIds = new Set(prev.map(s => s.id))
      return [...prev, ...toSelect.filter(s => !existingIds.has(s.id))]
    })
    setPendingNames(prev => {
      const next = new Set(prev)
      toSelect.forEach(s => next.delete(s.name.toLowerCase()))
      return next
    })
  }, [staples, pendingNames])

  function isSelected(id) {
    return selected.some(s => s.id === id)
  }

  function toggle(staple) {
    setSelected(prev => {
      const next = isSelected(staple.id)
        ? prev.filter(s => s.id !== staple.id)
        : [...prev, staple]
      onToggle?.(next)
      return next
    })
  }

  async function handleAddNew(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    const name = newName.trim()
    const store = newStore
    try {
      await addStaple({ name, store, notes: null })
      // Queue this name for auto-selection once useStaples refreshes the list
      setPendingNames(prev => new Set([...prev, name.toLowerCase()]))
      setNewName('')
      setNewStore('aldi')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 1 of 4</p>
      <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow mb-1">Staple check</h2>
      <p className="text-sm text-stone-grey mb-6">Check off what you need this week.</p>

      <div className="bg-field-cream rounded-2xl overflow-hidden mb-5 max-h-72 overflow-y-auto">
        {staples.length === 0 && !adding && (
          <p className="px-4 py-4 text-sm text-stone-grey">No staples yet — add some below.</p>
        )}
        {staples.map(staple => (
          <button
            key={staple.id}
            onClick={() => toggle(staple)}
            className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm border-b border-willow-mist last:border-0 transition-colors ${
              isSelected(staple.id) ? 'bg-fresh-herb/20' : 'hover:bg-willow-mist/50'
            }`}
          >
            <div>
              <span className="font-bold text-soil-shadow">{staple.name}</span>
              <span className="text-xs text-stone-grey ml-2">{stores.find(s => s.value === staple.store)?.label}</span>
              {staple.notes && <span className="text-xs text-stone-grey ml-1">— {staple.notes}</span>}
            </div>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs shrink-0 transition-colors ${
              isSelected(staple.id) ? 'bg-fresh-herb border-fresh-herb text-soil-shadow' : 'border-stone-grey/40'
            }`}>
              {isSelected(staple.id) && '✓'}
            </div>
          </button>
        ))}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-garden-patch font-bold hover:bg-willow-mist/50 transition-colors"
          >
            + Add new staple
          </button>
        ) : (
          <form onSubmit={handleAddNew} className="px-4 py-3 flex gap-2 bg-fresh-herb/10">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Staple name"
              className="flex-1 border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            />
            <select
              value={newStore}
              onChange={e => setNewStore(e.target.value)}
              className="border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none"
            >
              {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="submit" disabled={saving} className="bg-fresh-herb text-soil-shadow font-bold px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {saving ? '…' : 'Add'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-stone-grey px-2 text-sm">Cancel</button>
          </form>
        )}
      </div>

      <button
        onClick={() => onNext(selected)}
        className="w-full bg-fresh-herb text-soil-shadow font-bold py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
      >
        Next: Pantry →
      </button>
      <button
        onClick={() => onNext([])}
        className="w-full mt-2 text-stone-grey text-sm hover:text-soil-shadow"
      >
        Skip — no staples this week
      </button>
    </>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/StapleChecker.jsx
git commit -m "feat: accept stores prop in StapleChecker instead of importing STORES"
```

---

## Task 7: Update PantryInput

**Files:**
- Modify: `src/components/PantryInput.jsx`

Remove `STORES` import, add `stores` prop.

- [ ] **Step 1: Update the file**

Replace the entire content of `src/components/PantryInput.jsx`:

```jsx
import { useState, useMemo } from 'react'
import { useIngredients } from '../hooks/useIngredients'

/**
 * Props:
 *   stores: Array<{value, label, sort_order}>
 *   onStart: (selectedIngredients: Array<{id, name, store}>) => void
 *   initialSelected: Array<{id, name, store}>
 */
export function PantryInput({ stores, onStart, initialSelected = [] }) {
  const { ingredients, findOrCreate } = useIngredients()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(initialSelected)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStore, setNewStore] = useState('aldi')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return ingredients
    return ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  }, [ingredients, search])

  function isSelected(id) {
    return selected.some(s => s.id === id)
  }

  function toggle(ingredient) {
    setSelected(prev =>
      isSelected(ingredient.id)
        ? prev.filter(s => s.id !== ingredient.id)
        : [...prev, ingredient]
    )
  }

  function deselect(id) {
    setSelected(prev => prev.filter(s => s.id !== id))
  }

  async function handleAddNew(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      const id = await findOrCreate(newName.trim(), newStore)
      const ingredient = { id, name: newName.trim(), store: newStore }
      setSelected(prev => [...prev, ingredient])
      setNewName('')
      setNewStore('aldi')
      setAdding(false)
      setSearch('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 2 of 4</p>
      <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow mb-1">Pantry check</h2>
      <p className="text-sm text-stone-grey mb-5">What needs using up this week?</p>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selected.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 bg-fresh-herb text-soil-shadow text-sm font-bold px-3 py-1 rounded-pill shadow-card">
              {s.name}
              <button onClick={() => deselect(s.id)} className="opacity-70 hover:opacity-100 text-base leading-none ml-1">&times;</button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-grey text-sm">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ingredients…"
          className="w-full border border-willow-mist rounded-2xl bg-field-cream pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
        />
      </div>

      <div className="bg-field-cream rounded-2xl overflow-hidden mb-5 max-h-64 overflow-y-auto">
        {filtered.length === 0 && !adding && (
          <p className="px-4 py-3 text-sm text-stone-grey">No ingredients found.</p>
        )}
        {filtered.map(ing => (
          <button
            key={ing.id}
            onClick={() => toggle(ing)}
            className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm border-b border-willow-mist last:border-0 transition-colors ${
              isSelected(ing.id) ? 'bg-fresh-herb/20' : 'hover:bg-willow-mist/50'
            }`}
          >
            <div>
              <span className="font-bold text-soil-shadow">{ing.name}</span>
              <span className="text-xs text-stone-grey ml-2">{stores.find(s => s.value === ing.store)?.label}</span>
            </div>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs shrink-0 transition-colors ${
              isSelected(ing.id) ? 'bg-fresh-herb border-fresh-herb text-soil-shadow' : 'border-stone-grey/40'
            }`}>
              {isSelected(ing.id) && '✓'}
            </div>
          </button>
        ))}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-garden-patch font-bold hover:bg-willow-mist/50 transition-colors"
          >
            + Add new ingredient
          </button>
        ) : (
          <form onSubmit={handleAddNew} className="px-4 py-3 flex gap-2 bg-fresh-herb/10">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ingredient name"
              className="flex-1 border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            />
            <select
              value={newStore}
              onChange={e => setNewStore(e.target.value)}
              className="border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none"
            >
              {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="submit" disabled={saving} className="bg-fresh-herb text-soil-shadow font-bold px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {saving ? '…' : 'Add'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-stone-grey px-2 text-sm">Cancel</button>
          </form>
        )}
      </div>

      <button
        onClick={() => onStart(selected)}
        className="w-full bg-fresh-herb text-soil-shadow font-bold py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
      >
        Let's plan →
      </button>
      <button
        onClick={() => onStart([])}
        className="w-full mt-2 text-stone-grey text-sm hover:text-soil-shadow"
      >
        Skip — nothing to use up
      </button>
    </>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/PantryInput.jsx
git commit -m "feat: accept stores prop in PantryInput instead of importing STORES"
```

---

## Task 8: Update RecipeForm

**Files:**
- Modify: `src/components/RecipeForm.jsx`

Add `stores` prop, pass it through to `IngredientRow`.

- [ ] **Step 1: Update the file**

Replace the entire content of `src/components/RecipeForm.jsx`:

```jsx
import { useState } from 'react'
import { IngredientRow } from './IngredientAutocomplete'
import { useIngredients } from '../hooks/useIngredients'

/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store, notes}>
 *   stores: Array<{value, label, sort_order}>
 *   initial: {name, categoryId, ingredients: [{name, store, id}]} | null
 *   onSave: ({name, categoryId, ingredientIds: string[]}) => Promise<void>
 *   onCancel: () => void
 */
export function RecipeForm({ categories, staples = [], stores, initial, onSave, onCancel }) {
  const { ingredients: allIngredients, findOrCreate } = useIngredients()
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [ingredientRows, setIngredientRows] = useState(
    () => (initial?.ingredients ?? []).map((i, idx) => ({
      _key: `init-${idx}`,
      name: i.name,
      store: i.store,
      existingId: i.id,
      fromStaple: false,
    }))
  )
  const [nextKey, setNextKey] = useState(initial?.ingredients?.length ?? 0)
  const [saving, setSaving] = useState(false)

  function addRow() {
    const key = `row-${nextKey}`
    setNextKey(k => k + 1)
    setIngredientRows(rows => [
      ...rows,
      { _key: key, name: '', store: 'aldi', existingId: null, fromStaple: false },
    ])
  }

  function updateRow(key, value) {
    setIngredientRows(rows => rows.map(r => r._key === key ? { ...r, ...value } : r))
  }

  function removeRow(key) {
    setIngredientRows(rows => rows.filter(r => r._key !== key))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      const ingredientIds = await Promise.all(
        ingredientRows
          .filter(r => r.name.trim())
          .map(async r => {
            // Path 1: already a known ingredient — use existing id directly
            if (r.existingId) return r.existingId

            // Path 2 & 3: find-or-create in ingredients table
            const id = await findOrCreate(r.name.trim(), r.store)
            return id
          })
      )
      await onSave({ name: name.trim(), categoryId: categoryId || null, ingredientIds })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + category */}
      <div className="flex gap-3 flex-wrap">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Recipe name (e.g. Chicken Stir Fry)"
          required
          className="flex-1 min-w-48 border border-willow-mist rounded-xl bg-field-cream px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
        />
        <div className="flex flex-wrap gap-2 items-center">
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(prev => prev === c.id ? '' : c.id)}
              className={`px-3 py-1.5 rounded-pill text-xs font-bold transition-colors ${
                categoryId === c.id
                  ? 'bg-garden-patch text-fresh-herb'
                  : 'bg-willow-mist text-stone-grey hover:bg-garden-patch/10'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Ingredients */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-stone-grey uppercase tracking-widest">Ingredients</p>
        {ingredientRows.map(row => (
          <IngredientRow
            key={row._key}
            allIngredients={allIngredients}
            staples={staples}
            stores={stores}
            value={row}
            onChange={v => updateRow(row._key, v)}
            onRemove={() => removeRow(row._key)}
          />
        ))}
        <button
          type="button"
          onClick={addRow}
          className="text-garden-patch text-sm font-bold hover:underline"
        >
          + Add ingredient
        </button>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-5 py-2.5 text-sm font-bold text-stone-grey hover:text-soil-shadow rounded-pill"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 text-sm font-bold bg-fresh-herb text-soil-shadow rounded-pill shadow-card hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {saving ? 'Saving…' : 'Save Recipe'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/RecipeForm.jsx
git commit -m "feat: accept stores prop in RecipeForm, pass to IngredientRow"
```

---

## Task 9: Update RecipeImport

**Files:**
- Modify: `src/components/RecipeImport.jsx`

Remove `STORES` import, add `stores` prop, replace all 3 usages.

- [ ] **Step 1: Remove the STORES import**

In `src/components/RecipeImport.jsx`, delete line 4:

```
import { STORES } from '../utils/stores'
```

- [ ] **Step 2: Add `stores` to the prop signature**

Find the function signature (line 14):

```jsx
export function RecipeImport({ categories, staples, addRecipe, onDone, onCancel }) {
```

Change to:

```jsx
export function RecipeImport({ categories, staples, stores, addRecipe, onDone, onCancel }) {
```

- [ ] **Step 3: Replace the three STORES usages**

**Usage 1** (around line 238) — store label display:
```jsx
const storeName = STORES.find(s => s.value === row.store)?.label ?? row.store
```
Change to:
```jsx
const storeName = stores.find(s => s.value === row.store)?.label ?? row.store
```

**Usage 2** (around line 252) — match label display:
```jsx
{m._isStaple ? '★ ' : ''}{m.name} · {STORES.find(s => s.value === m.store)?.label}
```
Change to:
```jsx
{m._isStaple ? '★ ' : ''}{m.name} · {stores.find(s => s.value === m.store)?.label}
```

**Usage 3** (around line 306) — store dropdown options:
```jsx
{STORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
```
Change to:
```jsx
{stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecipeImport.jsx
git commit -m "feat: accept stores prop in RecipeImport instead of importing STORES"
```

---

## Task 10: Update GroceryList

**Files:**
- Modify: `src/components/GroceryList.jsx`

Remove `STORES` import, add `stores` prop. The `stores` prop now drives column ordering (same order as the `stores` array).

- [ ] **Step 1: Remove the STORES import**

In `src/components/GroceryList.jsx`, delete the line:

```js
import { STORES } from '../utils/stores'
```

- [ ] **Step 2: Add `stores` to prop signature**

Find the function signature (currently line 14):

```jsx
export function GroceryList({ slots, recipes, staples, addedIngredients = [], onRemoveAdded, onRemoveStaple }) {
```

Change to:

```jsx
export function GroceryList({ slots, recipes, staples, stores, addedIngredients = [], onRemoveAdded, onRemoveStaple }) {
```

- [ ] **Step 3: Replace STORES usage in storeColumns**

Find the `storeColumns` computation (currently around line 24):

```jsx
const storeColumns = STORES
  .map(s => ({ store: s, items: list[s.value] ?? [] }))
  .filter(col => col.items.length > 0)
```

Change to:

```jsx
const storeColumns = stores
  .map(s => ({ store: s, items: list[s.value] ?? [] }))
  .filter(col => col.items.length > 0)
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/GroceryList.jsx
git commit -m "feat: accept stores prop in GroceryList instead of importing STORES"
```

---

## Task 11: Wire GroceryPage

**Files:**
- Modify: `src/pages/GroceryPage.jsx`

Call `useStores()`, pass `stores` to `GroceryList`, pass `stores` to `generateGroceryList`.

- [ ] **Step 1: Add useStores import and hook call**

At the top of `src/pages/GroceryPage.jsx`, add the import after the existing imports:

```js
import { useStores } from '../hooks/useStores'
```

In the component body, add the hook call after the existing hooks:

```js
const { stores, loading: storesLoading } = useStores()
```

- [ ] **Step 2: Update the loading guard**

Find:

```jsx
const loading = recipesLoading || staplesLoading || ingredientsLoading || planLoading
```

Change to:

```jsx
const loading = recipesLoading || staplesLoading || ingredientsLoading || planLoading || storesLoading
```

- [ ] **Step 3: Pass stores to GroceryList**

Find the `<GroceryList>` call:

```jsx
<GroceryList
  slots={slots}
  recipes={recipes}
  staples={selectedStaples}
  addedIngredients={addedIngredients}
  onRemoveAdded={handleRemoveAdded}
  onRemoveStaple={handleRemoveStaple}
/>
```

Change to:

```jsx
<GroceryList
  slots={slots}
  recipes={recipes}
  staples={selectedStaples}
  stores={stores}
  addedIngredients={addedIngredients}
  onRemoveAdded={handleRemoveAdded}
  onRemoveStaple={handleRemoveStaple}
/>
```

- [ ] **Step 4: Update the generateGroceryList call in GroceryList**

`generateGroceryList` is called inside `GroceryList.jsx` (not in GroceryPage directly). GroceryList now receives `stores` as a prop and passes it to `generateGroceryList`. Open `src/components/GroceryList.jsx` and find the call:

```jsx
const list = generateGroceryList(slotArray, recipes, staples, addedIngredients)
```

Change to:

```jsx
const list = generateGroceryList(slotArray, recipes, staples, addedIngredients, stores)
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/GroceryPage.jsx src/components/GroceryList.jsx
git commit -m "feat: wire useStores into GroceryPage and GroceryList"
```

---

## Task 12: Wire RecipesPage

**Files:**
- Modify: `src/pages/RecipesPage.jsx`

Call `useStores()`, pass `stores` to `RecipeForm` and `RecipeImport`.

- [ ] **Step 1: Add useStores import and hook call**

Add the import to `src/pages/RecipesPage.jsx`:

```js
import { useStores } from '../hooks/useStores'
```

Add the hook call in the component body:

```js
const { stores, loading: storesLoading } = useStores()
```

- [ ] **Step 2: Update the loading guard**

Find:

```jsx
if (loading || staplesLoading) return <div className="p-6 text-stone-grey">Loading…</div>
```

Change to:

```jsx
if (loading || staplesLoading || storesLoading) return <div className="p-3 sm:p-6 text-stone-grey">Loading…</div>
```

- [ ] **Step 3: Pass stores to RecipeImport**

Find the `<RecipeImport>` call:

```jsx
<RecipeImport
  categories={categories}
  staples={staples}
  addRecipe={addRecipe}
  onDone={() => setMode(null)}
  onCancel={() => setMode(null)}
/>
```

Change to:

```jsx
<RecipeImport
  categories={categories}
  staples={staples}
  stores={stores}
  addRecipe={addRecipe}
  onDone={() => setMode(null)}
  onCancel={() => setMode(null)}
/>
```

- [ ] **Step 4: Pass stores to the RecipeForm (add mode)**

Find the `<RecipeForm>` inside the `{mode === 'add' && ...}` block:

```jsx
<RecipeForm
  categories={categories}
  staples={staples}
  initial={null}
  onSave={handleAdd}
  onCancel={() => setMode(null)}
/>
```

Change to:

```jsx
<RecipeForm
  categories={categories}
  staples={staples}
  stores={stores}
  initial={null}
  onSave={handleAdd}
  onCancel={() => setMode(null)}
/>
```

- [ ] **Step 5: Pass stores to the RecipeForm (edit mode)**

Find the `<RecipeForm>` inside the `{mode?.edit?.id === recipe.id ? ...}` block:

```jsx
<RecipeForm
  categories={categories}
  staples={staples}
  initial={{ name: recipe.name, categoryId: recipe.category?.id, ingredients: recipe.ingredients }}
  onSave={handleUpdate}
  onCancel={() => setMode(null)}
/>
```

Change to:

```jsx
<RecipeForm
  categories={categories}
  staples={staples}
  stores={stores}
  initial={{ name: recipe.name, categoryId: recipe.category?.id, ingredients: recipe.ingredients }}
  onSave={handleUpdate}
  onCancel={() => setMode(null)}
/>
```

- [ ] **Step 6: Pass stores as store label in recipe ingredient display**

Find the ingredient chip store label (around line 180):

```jsx
<span className="text-stone-grey/60">· {STORES.find(s => s.value === ing.store)?.label}</span>
```

Change to:

```jsx
<span className="text-stone-grey/60">· {stores.find(s => s.value === ing.store)?.label}</span>
```

Also remove the `STORES` import at the top of the file.

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/pages/RecipesPage.jsx
git commit -m "feat: wire useStores into RecipesPage, pass to RecipeForm and RecipeImport"
```

---

## Task 13: Wire PlannerPage

**Files:**
- Modify: `src/pages/PlannerPage.jsx`

Call `useStores()`, pass `stores` to `StapleChecker` and `PantryInput`.

- [ ] **Step 1: Add useStores import and hook call**

Add the import to `src/pages/PlannerPage.jsx`:

```js
import { useStores } from '../hooks/useStores'
```

Add the hook call in the component body:

```js
const { stores, loading: storesLoading } = useStores()
```

- [ ] **Step 2: Update the loading guard**

Find:

```jsx
if (recipesLoading || staplesLoading || planLoading) return (
  <div className="p-6 text-stone-grey font-body">Loading…</div>
)
```

Change to:

```jsx
if (recipesLoading || staplesLoading || planLoading || storesLoading) return (
  <div className="p-6 text-stone-grey font-body">Loading…</div>
)
```

- [ ] **Step 3: Pass stores to StapleChecker**

Find the `<StapleChecker>` call:

```jsx
<StapleChecker
  onNext={handleStaplesNext}
  initialSelected={selectedStaples}
  onToggle={handleStaplesToggle}
/>
```

Change to:

```jsx
<StapleChecker
  stores={stores}
  onNext={handleStaplesNext}
  initialSelected={selectedStaples}
  onToggle={handleStaplesToggle}
/>
```

- [ ] **Step 4: Pass stores to PantryInput**

Find the `<PantryInput>` call:

```jsx
<PantryInput onStart={handlePantryStart} initialSelected={pantryItems} />
```

Change to:

```jsx
<PantryInput stores={stores} onStart={handlePantryStart} initialSelected={pantryItems} />
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/PlannerPage.jsx
git commit -m "feat: wire useStores into PlannerPage, pass to StapleChecker and PantryInput"
```

---

## Task 14: ManagePage Stores Tab

**Files:**
- Modify: `src/pages/ManagePage.jsx`

Add a "Stores" tab. Call `useStores()`. Add/remove stores with in-use error handling.

- [ ] **Step 1: Add useStores import**

At the top of `src/pages/ManagePage.jsx`, add:

```js
import { useStores } from '../hooks/useStores'
```

- [ ] **Step 2: Add "Stores" to the TABS array**

Find:

```js
const TABS = [
  { key: 'staples',     label: 'Staples' },
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'categories',  label: 'Categories' },
]
```

Change to:

```js
const TABS = [
  { key: 'staples',     label: 'Staples' },
  { key: 'ingredients', label: 'Ingredients' },
  { key: 'categories',  label: 'Categories' },
  { key: 'stores',      label: 'Stores' },
]
```

- [ ] **Step 3: Add useStores hook call and new state**

In the component body, after the existing hook calls, add:

```js
const { stores, addStore, deleteStore } = useStores()
const [newStore, setNewStore] = useState('')
const [inUseStore, setInUseStore] = useState(null)
```

- [ ] **Step 4: Add handler functions**

After the existing handler functions (e.g. after `handleMoveToStaples`), add:

```js
async function handleAddStore(e) {
  e.preventDefault()
  if (!newStore.trim()) return
  try {
    await addStore({ label: newStore.trim() })
    setNewStore('')
  } catch {
    showToast("Couldn't save store, try again")
  }
}

async function handleDeleteStore(value) {
  setInUseStore(null)
  try {
    await deleteStore(value)
  } catch (err) {
    if (err?.inUse) {
      setInUseStore(value)
    } else {
      showToast("Couldn't delete store, try again")
    }
  }
}
```

- [ ] **Step 5: Add the Stores tab content**

After the closing `</>` of the `{activeTab === 'categories' && ...}` block, add:

```jsx
{activeTab === 'stores' && (
  <>
    <p className="text-sm text-stone-grey">Where you shop. Assign each ingredient and staple to a store.</p>
    <ul className="space-y-2">
      {stores.map(s => (
        <li key={s.id} className="bg-field-cream rounded-2xl px-5 py-3 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <span className="font-bold text-soil-shadow">{s.label}</span>
            <div className="flex items-center gap-3">
              {inUseStore === s.value && (
                <span className="text-xs text-stone-grey">In use — reassign items first</span>
              )}
              <button
                onClick={() => handleDeleteStore(s.value)}
                className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        </li>
      ))}
      {stores.length === 0 && (
        <li className="text-stone-grey text-sm px-2">No stores yet.</li>
      )}
    </ul>
    <form onSubmit={handleAddStore} className="flex gap-2 pt-2">
      <input
        value={newStore}
        onChange={e => setNewStore(e.target.value)}
        placeholder="Store name (e.g. Whole Foods)"
        className="flex-1 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
      />
      <button
        type="submit"
        className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm"
      >
        Add
      </button>
    </form>
  </>
)}
```

- [ ] **Step 6: Remove the STORES import from ManagePage**

Delete the line near the top:

```js
import { STORES } from '../utils/stores'
```

Confirm ManagePage still compiles — it uses `stores` (from `useStores()`) instead of `STORES` now. The store dropdowns for staples/ingredients already use `STORES` — replace those with `stores` from the hook:

Find all `STORES.map(st => ...)` in ManagePage and replace `STORES` with `stores`.

There are 4 such places in ManagePage: the add-staple form, the edit-staple form, the add-ingredient form, and the edit-ingredient form. Each looks like:

```jsx
{STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
```

Change all 4 to:

```jsx
{stores.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/pages/ManagePage.jsx
git commit -m "feat: add Stores tab to ManagePage with add/remove UI"
```

---

## Task 15: Delete stores.js

**Files:**
- Delete: `src/utils/stores.js`

All consumers now use `useStores()` or receive `stores` as a prop. The static file is no longer imported anywhere.

- [ ] **Step 1: Verify no imports remain**

```bash
grep -r "from.*utils/stores" src/
```

Expected: no output (zero matches).

- [ ] **Step 2: Delete the file**

```bash
rm src/utils/stores.js
```

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: `43 passed` (35 original + 8 new slugify tests).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: delete static stores.js — all consumers use dynamic stores from Supabase"
```
