# Other Grocery Store Option — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "Other" store option to every place stores are listed, by first extracting a shared `STORES` constant so all 7 consuming files stay in sync.

**Architecture:** A new `src/utils/stores.js` exports the single STORES array; all components and utilities import from it. `groceryList.js` dynamically builds its result object from STORES (removing the hardcoded `{ sams_club, aldi, target }` keys). Two DB CHECK constraints need updating to allow `'other'`.

**Tech Stack:** React 18, Vitest (node env — no jsdom, pure-function tests only), Supabase/PostgreSQL

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Create | `src/utils/stores.js` | New single-source-of-truth for stores |
| Create | `tests/utils/stores.test.js` | Unit tests for the export |
| Modify | `src/utils/groceryList.js` | Dynamic result init from STORES; add `other` key |
| Modify | `tests/utils/groceryList.test.js` | Add `other` test; fix hardcoded empty-result assertion |
| Modify | `src/components/StapleChecker.jsx` | Import STORES, remove local copy |
| Modify | `src/components/PantryInput.jsx` | Import STORES, remove local copy |
| Modify | `src/components/IngredientAutocomplete.jsx` | Import STORES, remove local copy |
| Modify | `src/components/GroceryList.jsx` | Import STORES (was STORE_CONFIG with `.key`), adapt to `.value` |
| Modify | `src/pages/ManagePage.jsx` | Import STORES, remove local copy |
| Modify | `src/pages/RecipesPage.jsx` | Replace STORE_LABELS object with STORES lookup |
| Modify | `supabase/schema.sql` | Update CHECK constraints to include `'other'` |

---

### Task 1: Create `src/utils/stores.js` and its tests

**Files:**
- Create: `src/utils/stores.js`
- Create: `tests/utils/stores.test.js`

- [ ] **Step 1: Write the failing test**

```js
// tests/utils/stores.test.js
import { describe, it, expect } from 'vitest'
import { STORES } from '../../src/utils/stores.js'

describe('STORES', () => {
  it('exports an array of 4 stores', () => {
    expect(STORES).toHaveLength(4)
  })

  it('every entry has a value and a label', () => {
    for (const s of STORES) {
      expect(s).toHaveProperty('value')
      expect(s).toHaveProperty('label')
      expect(typeof s.value).toBe('string')
      expect(typeof s.label).toBe('string')
    }
  })

  it('includes "other" as the last entry', () => {
    const last = STORES[STORES.length - 1]
    expect(last.value).toBe('other')
    expect(last.label).toBe('Other')
  })

  it('includes the three existing stores in order', () => {
    const values = STORES.map(s => s.value)
    expect(values).toEqual(['sams_club', 'aldi', 'target', 'other'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/michielu/code/dinner-planner
npx vitest run tests/utils/stores.test.js
```

Expected: FAIL — `Cannot find module '../../src/utils/stores.js'`

- [ ] **Step 3: Create `src/utils/stores.js`**

```js
// src/utils/stores.js
export const STORES = [
  { value: 'sams_club', label: "Sam's Club" },
  { value: 'aldi',      label: 'Aldi' },
  { value: 'target',    label: 'Target' },
  { value: 'other',     label: 'Other' },
]
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/utils/stores.test.js
```

Expected: PASS — 4 tests

- [ ] **Step 5: Commit**

```bash
git add src/utils/stores.js tests/utils/stores.test.js
git commit -m "feat: add shared STORES constant with 'other' option"
```

---

### Task 2: Update `src/utils/groceryList.js` to use STORES dynamically

**Files:**
- Modify: `src/utils/groceryList.js`
- Modify: `tests/utils/groceryList.test.js`

The current `result` object is hardcoded as `{ sams_club: [], aldi: [], target: [] }`. After this task, it is built dynamically from STORES so adding a store in one place is all that's needed.

- [ ] **Step 1: Add a failing test for the `other` store**

Open `tests/utils/groceryList.test.js`. Add this test inside the existing `describe('generateGroceryList', ...)` block (before the closing `})`):

```js
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

  it('includes other: [] in empty result', () => {
    const result = generateGroceryList([], [], [])
    expect(result).toEqual({ sams_club: [], aldi: [], target: [], other: [] })
  })
```

Also update the existing `'returns empty store arrays when nothing is planned and no staples'` test (line 97-99) — it currently asserts `{ sams_club: [], aldi: [], target: [] }` and will fail once `other` is added. **Delete that test** — it is replaced by `'includes other: [] in empty result'` above.

The full updated test file should look like this:

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
      { id: 'i1', name: 'pasta', store: 'aldi' },
    ],
  },
]

const STAPLES = [
  { id: 's1', name: 'yogurt', store: 'sams_club', notes: 'check if running low' },
  { id: 's2', name: 'fruit', store: 'aldi', notes: null },
]

describe('generateGroceryList', () => {
  it('groups recipe ingredients by store', () => {
    const slots = [{ day: 'monday', type: 'recipe', recipeId: 'r1' }]
    const result = generateGroceryList(slots, RECIPES, [])
    expect(result.aldi).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'pasta', isStaple: false }),
    ]))
    expect(result.sams_club).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'ground beef', isStaple: false }),
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
      expect.objectContaining({ name: 'yogurt', isStaple: true, notes: 'check if running low' }),
    ]))
    expect(result.aldi).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'fruit', isStaple: true, notes: null }),
    ]))
  })

  it('includes both recipe ingredients and staples together', () => {
    const slots = [{ day: 'monday', type: 'recipe', recipeId: 'r1' }]
    const result = generateGroceryList(slots, RECIPES, STAPLES)
    expect(result.sams_club).toHaveLength(2) // ground beef + yogurt
    expect(result.aldi).toHaveLength(2) // pasta + fruit
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

  it('includes other: [] in empty result', () => {
    const result = generateGroceryList([], [], [])
    expect(result).toEqual({ sams_club: [], aldi: [], target: [], other: [] })
  })
})
```

- [ ] **Step 2: Run tests to verify the new ones fail**

```bash
npx vitest run tests/utils/groceryList.test.js
```

Expected: the two new tests FAIL (no `other` key in result yet); existing 6 tests PASS.

- [ ] **Step 3: Update `src/utils/groceryList.js`**

Replace the file with:

```js
import { STORES } from './stores.js'

/**
 * Generates a grocery list grouped by store.
 *
 * @param {Array<{day: string, type: 'recipe'|'eating_out'|'flex', recipeId?: string}>} slots
 * @param {Array<{id: string, name: string, ingredients: Array<{id: string, name: string, store: string}>}>} recipes
 * @param {Array<{id: string, name: string, store: string, notes: string|null}>} staples
 * @returns {Record<string, Array>} — one key per store value; each key holds an array of items
 *   Each recipe item: {name, store, isStaple: false, meals: string[]}
 *   Each staple item:  {name, store, isStaple: true, notes: string|null}
 */
export function generateGroceryList(slots, recipes, staples) {
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
    result[item.store].push({ name: item.name, isStaple: false, meals: item.meals })
  }

  for (const staple of staples) {
    result[staple.store].push({ name: staple.name, isStaple: true, notes: staple.notes ?? null })
  }

  return result
}
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npx vitest run
```

Expected: all 8 groceryList tests PASS, all stores tests PASS. No failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/groceryList.js tests/utils/groceryList.test.js
git commit -m "feat: groceryList dynamically builds from STORES, adds 'other' key"
```

---

### Task 3: Update StapleChecker, PantryInput, and IngredientAutocomplete

**Files:**
- Modify: `src/components/StapleChecker.jsx`
- Modify: `src/components/PantryInput.jsx`
- Modify: `src/components/IngredientAutocomplete.jsx`

All three files have an identical local `const STORES = [...]` that is replaced with an import. No logic changes needed — the shape `{ value, label }` is the same.

No automated test is possible for these UI components (Vitest runs in node, no jsdom).

- [ ] **Step 1: Update `src/components/StapleChecker.jsx`**

Remove lines 4-8 (the local `const STORES = [...]`) and add the import at the top:

```jsx
import { useState, useEffect } from 'react'
import { useStaples } from '../hooks/useStaples'
import { STORES } from '../utils/stores'
```

Everything else in the file is unchanged. The `STORES.find(s => s.value === staple.store)?.label` usage on line 90 and `STORES.map(s => <option ...>)` on line 122 both continue to work identically.

- [ ] **Step 2: Update `src/components/PantryInput.jsx`**

Remove lines 4-8 (the local `const STORES = [...]`) and add the import:

```jsx
import { useState, useMemo } from 'react'
import { useIngredients } from '../hooks/useIngredients'
import { STORES } from '../utils/stores'
```

Everything else in the file is unchanged.

- [ ] **Step 3: Update `src/components/IngredientAutocomplete.jsx`**

Remove lines 3-7 (the local `const STORES = [...]`) and add the import:

```jsx
import { useState, useRef, useEffect } from 'react'
import { STORES } from '../utils/stores'
```

Everything else in the file is unchanged.

- [ ] **Step 4: Run tests (sanity check)**

```bash
npx vitest run
```

Expected: all tests still PASS (no regressions from component changes).

- [ ] **Step 5: Commit**

```bash
git add src/components/StapleChecker.jsx src/components/PantryInput.jsx src/components/IngredientAutocomplete.jsx
git commit -m "refactor: StapleChecker, PantryInput, IngredientAutocomplete import shared STORES"
```

---

### Task 4: Update GroceryList component

**Files:**
- Modify: `src/components/GroceryList.jsx`

GroceryList uses `STORE_CONFIG` with a `key` property instead of `value`. After this task it imports `STORES` and uses `store.value` everywhere `store.key` was used.

- [ ] **Step 1: Replace the file content**

```jsx
import { useState } from 'react'
import { generateGroceryList } from '../utils/groceryList'
import { STORES } from '../utils/stores'

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 */
export function GroceryList({ slots, recipes, staples }) {
  const [copyStatus, setCopyStatus] = useState(null) // null | 'copied' | 'error'

  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  async function copyList() {
    const lines = STORES
      .filter(s => list[s.value].length > 0)
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
      <div className="px-6 py-5 border-b border-willow-mist">
        <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow">Grocery List</h2>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
        {total === 0 ? (
          <p className="text-center text-stone-grey py-8">No meals planned yet — nothing to buy.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STORES.map(store => (
              <div key={store.value}>
                <h3 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h3>
                {list[store.value].length === 0 ? (
                  <p className="text-xs text-stone-grey/50">Nothing from here</p>
                ) : (
                  <ul className="space-y-2">
                    {list[store.value].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-stone-grey mt-0.5 shrink-0">□</span>
                        <span>
                          <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                          {item.isStaple && (
                            <span className="ml-1 text-xs text-fresh-herb font-bold">★</span>
                          )}
                          {item.notes && (
                            <span className="block text-xs text-stone-grey">{item.notes}</span>
                          )}
                          {!item.isStaple && item.meals && item.meals.length > 0 && (
                            <span className="block text-xs text-stone-grey">{item.meals.join(', ')}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {total > 0 && (
          <p className="text-xs text-stone-grey mt-6">★ staple — check if you have enough</p>
        )}
      </div>

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

- [ ] **Step 2: Run tests (sanity check)**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/GroceryList.jsx
git commit -m "refactor: GroceryList imports shared STORES (was STORE_CONFIG with .key)"
```

---

### Task 5: Update ManagePage and RecipesPage

**Files:**
- Modify: `src/pages/ManagePage.jsx`
- Modify: `src/pages/RecipesPage.jsx`

ManagePage has an identical local `const STORES = [...]`. RecipesPage has a different shape: `const STORE_LABELS = { sams_club: "Sam's Club", aldi: 'Aldi', target: 'Target' }` used as `STORE_LABELS[ing.store]` — this becomes `STORES.find(s => s.value === ing.store)?.label`.

- [ ] **Step 1: Update `src/pages/ManagePage.jsx`**

Remove lines 6-10 (the local `const STORES = [...]`) and add the import after the existing imports:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useToast, Toast } from '../components/Toast'
import { STORES } from '../utils/stores'
```

Everything else in the file is unchanged — `STORES.find(...)?.label` and `STORES.map(...)` usages work identically.

- [ ] **Step 2: Update `src/pages/RecipesPage.jsx`**

Remove line 6 (`const STORE_LABELS = { ... }`) and add the import:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { RecipeForm } from '../components/RecipeForm'
import { useToast, Toast } from '../components/Toast'
import { STORES } from '../utils/stores'
```

Find line 145 in the ingredient display (inside `recipe.ingredients.map`):

```jsx
<span className="text-stone-grey/60 ml-1">· {STORE_LABELS[ing.store]}</span>
```

Change it to:

```jsx
<span className="text-stone-grey/60 ml-1">· {STORES.find(s => s.value === ing.store)?.label}</span>
```

- [ ] **Step 3: Run tests (sanity check)**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/ManagePage.jsx src/pages/RecipesPage.jsx
git commit -m "refactor: ManagePage and RecipesPage import shared STORES"
```

---

### Task 6: Update `supabase/schema.sql` and run the DB migration

**Files:**
- Modify: `supabase/schema.sql`

Two tables — `ingredients` and `staple_items` — have `CHECK (store IN ('sams_club', 'aldi', 'target'))`. Both need `'other'` added.

- [ ] **Step 1: Update `supabase/schema.sql`**

Find and replace the `ingredients` table CHECK constraint (line 15):

```sql
  store text not null check (store in ('sams_club', 'aldi', 'target')),
```

Change to:

```sql
  store text not null check (store in ('sams_club', 'aldi', 'target', 'other')),
```

Find and replace the `staple_items` table CHECK constraint (line 48):

```sql
  store text not null check (store in ('sams_club', 'aldi', 'target')),
```

Change to:

```sql
  store text not null check (store in ('sams_club', 'aldi', 'target', 'other')),
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase dashboard → SQL editor. Run these two statements (one at a time):

```sql
ALTER TABLE ingredients
  DROP CONSTRAINT IF EXISTS ingredients_store_check,
  ADD CONSTRAINT ingredients_store_check
    CHECK (store IN ('sams_club', 'aldi', 'target', 'other'));
```

```sql
ALTER TABLE staple_items
  DROP CONSTRAINT IF EXISTS staple_items_store_check,
  ADD CONSTRAINT staple_items_store_check
    CHECK (store IN ('sams_club', 'aldi', 'target', 'other'));
```

Expected: both return `ALTER TABLE` with no error.

- [ ] **Step 3: Verify in the app**

Start the dev server (`npm run dev`) and navigate to the Manage page. Try adding a staple with store "Other". Navigate to Recipes, add/edit a recipe ingredient with store "Other". Both should save without error.

- [ ] **Step 4: Run all tests one final time**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql
git commit -m "feat: add 'other' store to DB CHECK constraints in schema"
```
