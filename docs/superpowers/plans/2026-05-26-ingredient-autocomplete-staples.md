# Ingredient Autocomplete: Staples + Extras Auto-Add Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the recipe ingredient autocomplete show both existing ingredients and staples, and automatically add brand-new ingredients to grocery_extras.

**Architecture:** Extract a pure `mergeSuggestions` utility (testable), update `IngredientRow` to use it and track a `fromStaple` flag, update `RecipeForm` to accept `staples`/`onAddExtra` props and apply the three-path save logic, then wire both hooks into `RecipesPage`.

**Tech Stack:** React 18, Vitest (node environment — no jsdom, only pure-function tests), Supabase (no schema changes needed), Tailwind CSS with project design tokens.

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/utils/ingredientSuggestions.js` | **Create** | Pure `mergeSuggestions(allIngredients, staples, query, maxResults)` — merges + deduplicates suggestions |
| `tests/utils/ingredientSuggestions.test.js` | **Create** | Tests for `mergeSuggestions` |
| `src/components/IngredientAutocomplete.jsx` | **Modify** | Accept `staples` prop; use `mergeSuggestions`; track `fromStaple` in row state; show staple badge |
| `src/components/RecipeForm.jsx` | **Modify** | Accept `staples` + `onAddExtra` props; add `fromStaple: false` to row state; three-path save logic |
| `src/pages/RecipesPage.jsx` | **Modify** | Call `useStaples` + `useGroceryExtras`; pass `staples` + `onAddExtra` to all `<RecipeForm />` uses |

---

## Task 1: `mergeSuggestions` utility + tests

**Files:**
- Create: `src/utils/ingredientSuggestions.js`
- Create: `tests/utils/ingredientSuggestions.test.js`

- [ ] **Step 1: Write the failing tests**

Create `tests/utils/ingredientSuggestions.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { mergeSuggestions } from '../../src/utils/ingredientSuggestions.js'

const INGREDIENTS = [
  { id: 'i1', name: 'ground beef', store: 'sams_club' },
  { id: 'i2', name: 'pasta', store: 'aldi' },
  { id: 'i3', name: 'olive oil', store: 'aldi' },
]

const STAPLES = [
  { id: 's1', name: 'yogurt', store: 'sams_club', notes: 'check if low' },
  { id: 's2', name: 'fruit', store: 'aldi', notes: null },
  { id: 's3', name: 'pasta', store: 'aldi', notes: null }, // same name as ingredient i2
]

describe('mergeSuggestions', () => {
  it('returns ingredient matches with _isStaple: false', () => {
    const result = mergeSuggestions(INGREDIENTS, [], 'beef')
    expect(result).toEqual([
      { id: 'i1', name: 'ground beef', store: 'sams_club', _isStaple: false },
    ])
  })

  it('returns staple matches with _isStaple: true', () => {
    const result = mergeSuggestions([], STAPLES, 'yogurt')
    expect(result).toEqual([
      { id: 's1', name: 'yogurt', store: 'sams_club', _isStaple: true },
    ])
  })

  it('deduplicates: drops staple when ingredient with same name exists, keeps ingredient version', () => {
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'pasta')
    expect(result.filter(r => r.name === 'pasta')).toHaveLength(1)
    expect(result.find(r => r.name === 'pasta')._isStaple).toBe(false)
  })

  it('is case-insensitive for query filtering', () => {
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'BEEF')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('ground beef')
  })

  it('deduplication is case-insensitive', () => {
    const ingredientsUppercase = [{ id: 'i4', name: 'Yogurt', store: 'sams_club' }]
    const result = mergeSuggestions(ingredientsUppercase, STAPLES, 'yogurt')
    const yogurts = result.filter(r => r.name.toLowerCase() === 'yogurt')
    expect(yogurts).toHaveLength(1)
    expect(yogurts[0]._isStaple).toBe(false)
  })

  it('ingredient matches appear before staple matches', () => {
    // 'i' matches: 'olive oil' (ingredient) and 'fruit' (staple, not in ingredients)
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'i')
    const firstStapleIndex = result.findIndex(r => r._isStaple)
    const lastIngredientIndex = result.reduce((acc, r, i) => (!r._isStaple ? i : acc), -1)
    expect(firstStapleIndex).toBeGreaterThan(-1)    // at least one staple result
    expect(lastIngredientIndex).toBeGreaterThan(-1)  // at least one ingredient result
    expect(lastIngredientIndex).toBeLessThan(firstStapleIndex)
  })

  it('respects maxResults', () => {
    const manyIngredients = Array.from({ length: 10 }, (_, i) => ({
      id: `i${i}`, name: `item ${i}`, store: 'aldi',
    }))
    const result = mergeSuggestions(manyIngredients, [], 'item', 3)
    expect(result).toHaveLength(3)
  })

  it('returns empty array when nothing matches query', () => {
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'zzz')
    expect(result).toEqual([])
  })

  it('returns empty array when both lists are empty', () => {
    const result = mergeSuggestions([], [], 'pasta')
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/michielu/code/dinner-planner
npx vitest run tests/utils/ingredientSuggestions.test.js
```

Expected: FAIL — `Cannot find module '../../src/utils/ingredientSuggestions.js'`

- [ ] **Step 3: Create the utility**

Create `src/utils/ingredientSuggestions.js`:

```js
/**
 * Merges recipe ingredients and staple items into a deduplicated suggestion list.
 *
 * Ingredients appear first, then staples (excluding any staple whose name matches
 * an ingredient — case-insensitive). Results are sliced to maxResults.
 *
 * @param {Array<{id: string, name: string, store: string}>} allIngredients
 * @param {Array<{id: string, name: string, store: string, notes?: string|null}>} staples
 * @param {string} query — the text the user typed (must be non-empty)
 * @param {number} maxResults — max suggestions to return (default 8)
 * @returns {Array<{id: string, name: string, store: string, _isStaple: boolean}>}
 */
export function mergeSuggestions(allIngredients, staples, query, maxResults = 8) {
  const q = query.toLowerCase()

  const ingredientMatches = allIngredients
    .filter(i => i.name.toLowerCase().includes(q))
    .map(i => ({ id: i.id, name: i.name, store: i.store, _isStaple: false }))

  const ingredientNames = new Set(allIngredients.map(i => i.name.toLowerCase()))

  const stapleMatches = staples
    .filter(s => s.name.toLowerCase().includes(q) && !ingredientNames.has(s.name.toLowerCase()))
    .map(s => ({ id: s.id, name: s.name, store: s.store, _isStaple: true }))

  return [...ingredientMatches, ...stapleMatches].slice(0, maxResults)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run tests/utils/ingredientSuggestions.test.js
```

Expected: All 9 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npx vitest run
```

Expected: All tests PASS (19 existing + 9 new = 28 total).

- [ ] **Step 6: Commit**

```bash
git add src/utils/ingredientSuggestions.js tests/utils/ingredientSuggestions.test.js
git commit -m "feat: add mergeSuggestions utility for ingredient + staple autocomplete"
```

---

## Task 2: Update `IngredientRow` to use merged suggestions + staple badge

**Files:**
- Modify: `src/components/IngredientAutocomplete.jsx`

**Context:**
- `IngredientRow` is exported from this file; `RecipeForm` imports `{ IngredientRow }` from it.
- `value` prop shape currently: `{name, store, existingId: string|null}`. After this task, the shape includes `fromStaple: boolean` — `IngredientRow` reads and sets it but does not own it (it's in `RecipeForm` state).
- Suggestions now come from `mergeSuggestions` instead of inline filter logic.
- Staple suggestions get a `staple` badge to the right of the store label.
- The `key` on each `<li>` is prefixed (`s-` or `i-`) to avoid any UUID collision across tables.

- [ ] **Step 1: Replace `src/components/IngredientAutocomplete.jsx` in full**

```jsx
import { useState, useRef, useEffect } from 'react'
import { STORES } from '../utils/stores'
import { mergeSuggestions } from '../utils/ingredientSuggestions'

/**
 * A single ingredient row: name autocomplete + store selector + remove button.
 *
 * Props:
 *   allIngredients: Array<{id, name, store}>
 *   staples: Array<{id, name, store, notes}>
 *   value: {name: string, store: string, existingId: string|null, fromStaple: boolean}
 *   onChange: (value) => void
 *   onRemove: () => void
 */
export function IngredientRow({ allIngredients, staples, value, onChange, onRemove }) {
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
                    <span className="text-xs text-garden-patch font-bold">staple</span>
                  )}
                  <span className="text-stone-grey text-xs">
                    {STORES.find(st => st.value === s.store)?.label}
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
        {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
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

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: All 28 tests PASS. (No component tests exist; the utility tests from Task 1 cover the suggestion logic.)

- [ ] **Step 3: Commit**

```bash
git add src/components/IngredientAutocomplete.jsx
git commit -m "feat: update IngredientRow to show merged ingredient + staple suggestions with badge"
```

---

## Task 3: Update `RecipeForm` with new props and three-path save logic

**Files:**
- Modify: `src/components/RecipeForm.jsx`

**Context:**
- `RecipeForm` is rendered by `RecipesPage` in two places: the "add" panel and the inline edit form inside the recipe list map.
- Two new props: `staples: Array<{id, name, store, notes}>` and `onAddExtra: (name, store) => Promise<void>`.
- Each ingredient row object gains `fromStaple: false` in its initial shape — both when loading existing ingredients and when `addRow()` creates a blank row.
- Save logic — three paths per row:
  1. `existingId` is set → use it, skip extras.
  2. `fromStaple: true` → `findOrCreate(name, store)`, skip extras (it's already a recurring staple on the list).
  3. Both null/false → `findOrCreate(name, store)`, then check if name exists in `allIngredients` or `staples` (case-insensitive). If found in neither → call `onAddExtra`. Wrap `onAddExtra` in try/catch — extras are non-critical; the recipe save should succeed even if extras fails.

- [ ] **Step 1: Replace `src/components/RecipeForm.jsx` in full**

```jsx
import { useState } from 'react'
import { IngredientRow } from './IngredientAutocomplete'
import { useIngredients } from '../hooks/useIngredients'

/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store, notes}>
 *   initial: {name, categoryId, ingredients: [{name, store, id}]} | null
 *   onSave: ({name, categoryId, ingredientIds: string[]}) => Promise<void>
 *   onAddExtra: (name: string, store: string) => Promise<void>
 *   onCancel: () => void
 */
export function RecipeForm({ categories, staples, initial, onSave, onAddExtra, onCancel }) {
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

            // Path 3 only: add to extras if brand new (not in ingredients or staples)
            if (!r.fromStaple) {
              const normalised = r.name.trim().toLowerCase()
              const inIngredients = allIngredients.some(i => i.name.toLowerCase() === normalised)
              const inStaples = staples.some(s => s.name.toLowerCase() === normalised)
              if (!inIngredients && !inStaples) {
                try { await onAddExtra(r.name.trim(), r.store) } catch { /* non-critical */ }
              }
            }

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

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: All 28 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/RecipeForm.jsx
git commit -m "feat: update RecipeForm to accept staples + onAddExtra, auto-add new ingredients to extras"
```

---

## Task 4: Wire `useStaples` + `useGroceryExtras` into `RecipesPage`

**Files:**
- Modify: `src/pages/RecipesPage.jsx`

**Context:**
- `RecipeForm` is rendered **twice** in `RecipesPage`: once for the "add" panel and once inside the recipe list map for the inline edit form. Both need `staples` and `onAddExtra`.
- `useStaples` and `useGroceryExtras` are existing hooks — both already imported elsewhere in the app (`ManagePage`, `PlannerPage`).
- No other changes to `RecipesPage` are needed.

- [ ] **Step 1: Replace `src/pages/RecipesPage.jsx` in full**

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useGroceryExtras } from '../hooks/useGroceryExtras'
import { RecipeForm } from '../components/RecipeForm'
import { useToast, Toast } from '../components/Toast'
import { STORES } from '../utils/stores'

export default function RecipesPage() {
  const { recipes, categories, loading, addRecipe, updateRecipe, deleteRecipe } = useRecipes()
  const { staples } = useStaples()
  const { addExtra } = useGroceryExtras()
  const { toast, showToast, dismissToast } = useToast()
  const [mode, setMode] = useState(null) // null | 'add' | {edit: recipe}
  const [filterCategory, setFilterCategory] = useState('all')

  const displayed = filterCategory === 'all'
    ? recipes
    : recipes.filter(r => r.category?.id === filterCategory)

  async function handleAdd(data) {
    try {
      await addRecipe(data)
      setMode(null)
    } catch {
      showToast("Couldn't save recipe, try again")
    }
  }

  async function handleUpdate(data) {
    try {
      await updateRecipe(mode.edit.id, data)
      setMode(null)
    } catch {
      showToast("Couldn't update recipe, try again")
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this recipe?')) return
    try {
      await deleteRecipe(id)
    } catch {
      showToast("Couldn't delete recipe, try again")
    }
  }

  if (loading) return <div className="p-6 text-stone-grey">Loading…</div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display font-light text-3xl text-soil-shadow">Recipes</h1>
        {mode === null && (
          <button
            onClick={() => setMode('add')}
            className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm"
          >
            + Add Recipe
          </button>
        )}
      </div>

      {/* Add form */}
      {mode === 'add' && (
        <div className="bg-willow-mist rounded-card p-5 mb-6 shadow-card">
          <h2 className="font-bold text-soil-shadow mb-4">New Recipe</h2>
          <RecipeForm
            categories={categories}
            staples={staples}
            initial={null}
            onSave={handleAdd}
            onAddExtra={addExtra}
            onCancel={() => setMode(null)}
          />
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-5">
        {[{ id: 'all', name: 'All' }, ...categories].map(c => (
          <button
            key={c.id}
            onClick={() => setFilterCategory(c.id)}
            className={`px-3 py-1.5 rounded-pill text-xs font-bold transition-colors ${
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
      {displayed.length === 0 && (
        <div className="text-center py-16 text-stone-grey">
          <p className="text-4xl mb-3">🍳</p>
          <p>No recipes yet. Add your first one!</p>
        </div>
      )}

      <ul className="space-y-3">
        {displayed.map(recipe => (
          <li key={recipe.id} className="bg-willow-mist rounded-card px-5 py-4 shadow-card">
            {mode?.edit?.id === recipe.id ? (
              <RecipeForm
                categories={categories}
                staples={staples}
                initial={{ name: recipe.name, categoryId: recipe.category?.id, ingredients: recipe.ingredients }}
                onSave={handleUpdate}
                onAddExtra={addExtra}
                onCancel={() => setMode(null)}
              />
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-soil-shadow">{recipe.name}</span>
                    {recipe.category && (
                      <span className="ml-2 text-xs bg-garden-patch/10 text-garden-patch font-bold px-2 py-0.5 rounded-pill">
                        {recipe.category.name}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-3 ml-4 shrink-0">
                    <button
                      onClick={() => setMode({ edit: recipe })}
                      className="text-garden-patch text-sm font-bold hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(recipe.id)}
                      className="text-stone-grey hover:text-red-500 text-sm font-bold transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {recipe.ingredients.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recipe.ingredients.map(ing => (
                      <span
                        key={ing.id}
                        className="text-xs bg-field-cream text-stone-grey px-2.5 py-0.5 rounded-pill font-bold"
                      >
                        {ing.name}
                        <span className="text-stone-grey/60 ml-1">· {STORES.find(s => s.value === ing.store)?.label}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npx vitest run
```

Expected: All 28 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/pages/RecipesPage.jsx
git commit -m "feat: wire useStaples + useGroceryExtras into RecipesPage for ingredient autocomplete"
```
