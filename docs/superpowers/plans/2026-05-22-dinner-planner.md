# Dinner Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a responsive React + Supabase web app that guides weekly dinner planning — pantry-first flow, recipe filtering, and a store-split grocery list.

**Architecture:** Single-page React app (Vite) with React Router v6 for three routes. All data lives in Supabase (Postgres); the JS client talks directly from the browser — no custom backend. Week planning state is ephemeral (React state only); recipes, ingredients, and staples are persisted.

**Tech Stack:** Vite, React, React Router v6, TailwindCSS, @supabase/supabase-js, Vitest

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `index.html`
- Create: `src/main.jsx`
- Create: `.env.local` (gitignored)
- Create: `.gitignore`

- [ ] **Step 1: Scaffold Vite + React project**

```bash
cd /Users/michielu/code/dinner-planner
npm create vite@latest . -- --template react
```

When prompted "Current directory is not empty. Remove existing files and continue?" — choose **Ignore files and continue**.

- [ ] **Step 2: Install dependencies**

```bash
npm install
npm install react-router-dom @supabase/supabase-js
npm install -D tailwindcss autoprefixer postcss vitest @vitest/coverage-v8
npx tailwindcss init -p
```

- [ ] **Step 3: Configure Tailwind**

Replace `tailwind.config.js` with:

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

- [ ] **Step 4: Configure Vite with Vitest**

Replace `vite.config.js` with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
})
```

- [ ] **Step 5: Add Tailwind directives to CSS**

Replace the contents of `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 6: Create .env.local for Supabase credentials**

```bash
cat > .env.local << 'EOF'
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
EOF
```

You'll fill in real values in Task 2. Add to `.gitignore`:

```
node_modules/
dist/
.env.local
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite starts at `http://localhost:5173` with no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: project scaffold — vite + react + tailwind + supabase + vitest"
```

---

## Task 2: Supabase Schema

**Files:**
- Create: `supabase/schema.sql`

- [ ] **Step 1: Create a Supabase project**

Go to https://supabase.com → New project. Copy the **Project URL** and **anon public key** from Settings → API. Paste them into `.env.local`.

- [ ] **Step 2: Write the schema**

Create `supabase/schema.sql`:

```sql
-- Meal categories (Fry Pan, Pasta, Slow Cooker, etc.)
create table meal_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order int not null default 0
);

-- Global ingredient catalog — name + which store to buy from
create table ingredients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target')),
  constraint ingredients_name_unique unique (name)
);

-- Recipes
create table recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references meal_categories(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Join table: which ingredients belong to which recipe
create table recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references recipes(id) on delete cascade,
  ingredient_id uuid not null references ingredients(id) on delete cascade,
  constraint recipe_ingredients_unique unique (recipe_id, ingredient_id)
);

-- Staple items — always appear on the grocery list every week
create table staple_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  store text not null check (store in ('sams_club', 'aldi', 'target')),
  notes text
);

-- Seed default categories
insert into meal_categories (name, sort_order) values
  ('Fry Pan', 1),
  ('Pasta', 2),
  ('Slow Cooker', 3);
```

- [ ] **Step 3: Run schema in Supabase**

In the Supabase dashboard → SQL Editor → paste the full contents of `supabase/schema.sql` → Run.

Expected: All 5 tables created, 3 category rows inserted. No errors.

- [ ] **Step 4: Disable Row Level Security for all tables (household app, no auth)**

In Supabase dashboard → Authentication → Policies → for each table (`meal_categories`, `ingredients`, `recipes`, `recipe_ingredients`, `staple_items`) make sure RLS is **disabled** (toggle off). This allows the anon key to read and write freely.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql .gitignore
git commit -m "feat: supabase schema — 5 tables with seed categories"
```

---

## Task 3: Grocery List Utility (TDD)

**Files:**
- Create: `tests/utils/groceryList.test.js`
- Create: `src/utils/groceryList.js`

The grocery list generator is the core business logic. It takes planned slots, a recipe map, and staples, and returns items grouped by store. It must deduplicate ingredients (same ingredient used in two recipes appears once) and always include staples.

- [ ] **Step 1: Write failing tests**

Create `tests/utils/groceryList.test.js`:

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
    const slots = [
      { day: 'monday', type: 'recipe', recipeId: 'r1' },
    ]
    const result = generateGroceryList(slots, RECIPES, STAPLES)
    expect(result.sams_club).toHaveLength(2) // ground beef + yogurt
    expect(result.aldi).toHaveLength(2) // pasta + fruit
  })

  it('returns empty store arrays when nothing is planned and no staples', () => {
    const result = generateGroceryList([], [], [])
    expect(result).toEqual({ sams_club: [], aldi: [], target: [] })
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx vitest run tests/utils/groceryList.test.js
```

Expected: All tests fail with "Cannot find module '../../src/utils/groceryList.js'"

- [ ] **Step 3: Implement the utility**

Create `src/utils/groceryList.js`:

```js
/**
 * Generates a grocery list grouped by store.
 *
 * @param {Array<{day: string, type: 'recipe'|'eating_out'|'flex', recipeId?: string}>} slots
 * @param {Array<{id: string, name: string, ingredients: Array<{id: string, name: string, store: string}>}>} recipes
 * @param {Array<{id: string, name: string, store: string, notes: string|null}>} staples
 * @returns {{sams_club: Array, aldi: Array, target: Array}}
 */
export function generateGroceryList(slots, recipes, staples) {
  const recipeMap = new Map(recipes.map(r => [r.id, r]))

  // Collect unique ingredients from planned recipe slots
  const ingredientMap = new Map() // ingredient id → {name, store, isStaple}
  for (const slot of slots) {
    if (slot.type !== 'recipe' || !slot.recipeId) continue
    const recipe = recipeMap.get(slot.recipeId)
    if (!recipe) continue
    for (const ing of recipe.ingredients) {
      if (!ingredientMap.has(ing.id)) {
        ingredientMap.set(ing.id, { name: ing.name, store: ing.store, isStaple: false })
      }
    }
  }

  // Start result with recipe ingredients
  const result = { sams_club: [], aldi: [], target: [] }
  for (const item of ingredientMap.values()) {
    result[item.store].push({ name: item.name, isStaple: false })
  }

  // Append staples
  for (const staple of staples) {
    result[staple.store].push({ name: staple.name, isStaple: true, notes: staple.notes ?? null })
  }

  return result
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
npx vitest run tests/utils/groceryList.test.js
```

Expected: 6 tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add src/utils/groceryList.js tests/utils/groceryList.test.js
git commit -m "feat: grocery list utility with full test coverage"
```

---

## Task 4: Supabase Client + Data Hooks

**Files:**
- Create: `src/lib/supabase.js`
- Create: `src/hooks/useRecipes.js`
- Create: `src/hooks/useIngredients.js`
- Create: `src/hooks/useStaples.js`

- [ ] **Step 1: Create Supabase client singleton**

Create `src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(url, key)
```

- [ ] **Step 2: Create useRecipes hook**

Create `src/hooks/useRecipes.js`:

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useRecipes() {
  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    const [recipesRes, categoriesRes] = await Promise.all([
      supabase
        .from('recipes')
        .select(`
          id, name, created_at,
          category:meal_categories(id, name),
          recipe_ingredients(
            ingredient:ingredients(id, name, store)
          )
        `)
        .order('name'),
      supabase
        .from('meal_categories')
        .select('id, name, sort_order')
        .order('sort_order'),
    ])

    if (recipesRes.error) { setError(recipesRes.error); setLoading(false); return }
    if (categoriesRes.error) { setError(categoriesRes.error); setLoading(false); return }

    setRecipes(
      recipesRes.data.map(r => ({
        ...r,
        ingredients: r.recipe_ingredients.map(ri => ri.ingredient),
      }))
    )
    setCategories(categoriesRes.data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function addRecipe({ name, categoryId, ingredientIds }) {
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .insert({ name, category_id: categoryId || null })
      .select('id')
      .single()
    if (recipeErr) throw recipeErr

    if (ingredientIds.length > 0) {
      const { error: joinErr } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientIds.map(ingredient_id => ({ recipe_id: recipe.id, ingredient_id })))
      if (joinErr) throw joinErr
    }
    await fetchAll()
  }

  async function updateRecipe(id, { name, categoryId, ingredientIds }) {
    const { error: recipeErr } = await supabase
      .from('recipes')
      .update({ name, category_id: categoryId || null })
      .eq('id', id)
    if (recipeErr) throw recipeErr

    // Replace all ingredients: delete existing, insert new
    const { error: deleteErr } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', id)
    if (deleteErr) throw deleteErr

    if (ingredientIds.length > 0) {
      const { error: joinErr } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientIds.map(ingredient_id => ({ recipe_id: id, ingredient_id })))
      if (joinErr) throw joinErr
    }
    await fetchAll()
  }

  async function deleteRecipe(id) {
    const { error } = await supabase.from('recipes').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  async function addCategory(name) {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0)
    const { error } = await supabase
      .from('meal_categories')
      .insert({ name, sort_order: maxOrder + 1 })
    if (error) throw error
    await fetchAll()
  }

  async function deleteCategory(id) {
    const { error } = await supabase.from('meal_categories').delete().eq('id', id)
    if (error) throw error
    await fetchAll()
  }

  return {
    recipes, categories, loading, error,
    addRecipe, updateRecipe, deleteRecipe,
    addCategory, deleteCategory,
    refresh: fetchAll,
  }
}
```

- [ ] **Step 3: Create useIngredients hook**

Create `src/hooks/useIngredients.js`:

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useIngredients() {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchIngredients = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, store')
      .order('name')
    if (!error) setIngredients(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchIngredients() }, [fetchIngredients])

  // Finds or creates an ingredient by name. Returns the ingredient id.
  async function findOrCreate(name, store) {
    const normalised = name.trim().toLowerCase()
    const existing = ingredients.find(i => i.name.toLowerCase() === normalised)
    if (existing) return existing.id

    const { data, error } = await supabase
      .from('ingredients')
      .insert({ name: name.trim(), store })
      .select('id')
      .single()
    if (error) throw error
    await fetchIngredients()
    return data.id
  }

  return { ingredients, loading, findOrCreate, refresh: fetchIngredients }
}
```

- [ ] **Step 4: Create useStaples hook**

Create `src/hooks/useStaples.js`:

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useStaples() {
  const [staples, setStaples] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStaples = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staple_items')
      .select('id, name, store, notes')
      .order('name')
    if (!error) setStaples(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStaples() }, [fetchStaples])

  async function addStaple({ name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .insert({ name, store, notes: notes || null })
    if (error) throw error
    await fetchStaples()
  }

  async function updateStaple(id, { name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .update({ name, store, notes: notes || null })
      .eq('id', id)
    if (error) throw error
    await fetchStaples()
  }

  async function deleteStaple(id) {
    const { error } = await supabase.from('staple_items').delete().eq('id', id)
    if (error) throw error
    await fetchStaples()
  }

  return { staples, loading, addStaple, updateStaple, deleteStaple }
}
```

- [ ] **Step 5: Verify imports resolve**

```bash
npm run dev
```

Expected: Dev server starts with no module resolution errors (the hooks won't be used yet, just confirming no syntax errors).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.js src/hooks/
git commit -m "feat: supabase client + useRecipes, useIngredients, useStaples hooks"
```

---

## Task 5: App Shell — Routing, Nav, Toast, ConnectionBanner

**Files:**
- Modify: `src/main.jsx`
- Create: `src/App.jsx`
- Create: `src/components/Toast.jsx`
- Create: `src/components/ConnectionBanner.jsx`
- Create: `src/pages/PlannerPage.jsx` (stub)
- Create: `src/pages/RecipesPage.jsx` (stub)
- Create: `src/pages/ManagePage.jsx` (stub)

- [ ] **Step 1: Update main.jsx**

Replace `src/main.jsx`:

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

- [ ] **Step 2: Create Toast component**

Create `src/components/Toast.jsx`:

```jsx
import { useEffect } from 'react'

export function Toast({ message, type = 'error', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  const bg = type === 'error' ? 'bg-red-500' : 'bg-green-500'

  return (
    <div className={`fixed bottom-4 right-4 z-50 ${bg} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-sm`}>
      <span className="flex-1 text-sm">{message}</span>
      <button onClick={onDismiss} className="text-white/70 hover:text-white text-lg leading-none">&times;</button>
    </div>
  )
}

// Hook to manage a toast queue
import { useState, useCallback } from 'react'

export function useToast() {
  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'error') => {
    setToast({ message, type })
  }, [])

  const dismissToast = useCallback(() => setToast(null), [])

  return { toast, showToast, dismissToast }
}
```

- [ ] **Step 3: Create ConnectionBanner component**

Create `src/components/ConnectionBanner.jsx`:

```jsx
import { useState, useEffect } from 'react'

export function ConnectionBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-yellow-400 text-yellow-900 text-sm text-center py-2 font-medium">
      Reconnecting… changes won't be saved until you're back online.
    </div>
  )
}
```

- [ ] **Step 4: Create page stubs**

Create `src/pages/PlannerPage.jsx`:
```jsx
export default function PlannerPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Week Planner</h1></div>
}
```

Create `src/pages/RecipesPage.jsx`:
```jsx
export default function RecipesPage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Recipes</h1></div>
}
```

Create `src/pages/ManagePage.jsx`:
```jsx
export default function ManagePage() {
  return <div className="p-6"><h1 className="text-2xl font-bold">Staples &amp; Categories</h1></div>
}
```

- [ ] **Step 5: Create App.jsx with routing and nav**

Create `src/App.jsx`:

```jsx
import { Routes, Route, NavLink } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'
import PlannerPage from './pages/PlannerPage'
import RecipesPage from './pages/RecipesPage'
import ManagePage from './pages/ManagePage'

function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-4 py-2 rounded-md text-sm font-medium transition-colors ${
          isActive
            ? 'bg-indigo-600 text-white'
            : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ConnectionBanner />
      <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-2">
        <span className="text-lg font-bold text-indigo-600 mr-4">🍽️ Dinner Planner</span>
        <NavItem to="/" label="This Week" />
        <NavItem to="/recipes" label="Recipes" />
        <NavItem to="/manage" label="Staples &amp; Categories" />
      </nav>
      <main className="max-w-4xl mx-auto">
        <Routes>
          <Route path="/" element={<PlannerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/manage" element={<ManagePage />} />
        </Routes>
      </main>
    </div>
  )
}
```

- [ ] **Step 6: Verify nav works**

```bash
npm run dev
```

Open http://localhost:5173. Expected: Nav bar with three links. Clicking each shows the stub heading. No console errors.

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: app shell — routing, nav, toast, connection banner"
```

---

## Task 6: Manage Page — Categories & Staples

**Files:**
- Modify: `src/pages/ManagePage.jsx`

- [ ] **Step 1: Implement ManagePage**

Replace `src/pages/ManagePage.jsx`:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useToast, Toast } from '../components/Toast'

const STORES = [
  { value: 'sams_club', label: "Sam's Club" },
  { value: 'aldi', label: 'Aldi' },
  { value: 'target', label: 'Target' },
]

export default function ManagePage() {
  const { categories, addCategory, deleteCategory } = useRecipes()
  const { staples, addStaple, updateStaple, deleteStaple } = useStaples()
  const { toast, showToast, dismissToast } = useToast()

  const [newCategory, setNewCategory] = useState('')
  const [newStaple, setNewStaple] = useState({ name: '', store: 'aldi', notes: '' })
  const [editingStaple, setEditingStaple] = useState(null) // {id, name, store, notes}

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

  return (
    <div className="p-6 space-y-10">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      {/* Categories */}
      <section>
        <h2 className="text-xl font-bold mb-4">Meal Categories</h2>
        <ul className="space-y-2 mb-4">
          {categories.map(cat => (
            <li key={cat.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
              <span>{cat.name}</span>
              <button onClick={() => handleDeleteCategory(cat.id)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddCategory} className="flex gap-2">
          <input
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            placeholder="New category name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Add</button>
        </form>
      </section>

      {/* Staples */}
      <section>
        <h2 className="text-xl font-bold mb-1">Staple Items</h2>
        <p className="text-sm text-gray-500 mb-4">These appear on every grocery list with a "check if needed" note.</p>
        <ul className="space-y-2 mb-4">
          {staples.map(s => (
            <li key={s.id} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
              {editingStaple?.id === s.id ? (
                <form onSubmit={handleUpdateStaple} className="flex flex-wrap gap-2">
                  <input value={editingStaple.name} onChange={e => setEditingStaple(p => ({...p, name: e.target.value}))}
                    className="flex-1 min-w-32 border border-gray-300 rounded px-2 py-1 text-sm" />
                  <select value={editingStaple.store} onChange={e => setEditingStaple(p => ({...p, store: e.target.value}))}
                    className="border border-gray-300 rounded px-2 py-1 text-sm">
                    {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                  <input value={editingStaple.notes || ''} onChange={e => setEditingStaple(p => ({...p, notes: e.target.value}))}
                    placeholder="Note (optional)" className="flex-1 min-w-40 border border-gray-300 rounded px-2 py-1 text-sm" />
                  <button type="submit" className="bg-indigo-600 text-white px-3 py-1 rounded text-sm">Save</button>
                  <button type="button" onClick={() => setEditingStaple(null)} className="text-gray-400 px-2 py-1 text-sm">Cancel</button>
                </form>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{s.name}</span>
                    <span className="text-xs text-gray-400 ml-2">{STORES.find(st => st.value === s.store)?.label}</span>
                    {s.notes && <span className="text-xs text-gray-400 ml-2">— {s.notes}</span>}
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setEditingStaple(s)} className="text-indigo-500 hover:text-indigo-700 text-sm">Edit</button>
                    <button onClick={() => handleDeleteStaple(s.id)} className="text-red-400 hover:text-red-600 text-sm">Remove</button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddStaple} className="flex flex-wrap gap-2">
          <input value={newStaple.name} onChange={e => setNewStaple(p => ({...p, name: e.target.value}))}
            placeholder="Item name (e.g. yogurt)" className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <select value={newStaple.store} onChange={e => setNewStaple(p => ({...p, store: e.target.value}))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
            {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
          </select>
          <input value={newStaple.notes} onChange={e => setNewStaple(p => ({...p, notes: e.target.value}))}
            placeholder="Note (optional)" className="flex-1 min-w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          <button type="submit" className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Add</button>
        </form>
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Manual verify**

```bash
npm run dev
```

Go to http://localhost:5173/manage. Expected:
- Two sections: Meal Categories and Staple Items
- Add a category ("Sheet Pan") → appears in list
- Add a staple ("yogurt", Sam's Club, "check if running low") → appears in list
- Edit a staple → inline form opens, saves correctly
- Delete a staple → removed after confirm prompt
- Check Supabase dashboard Tables → rows appear in `meal_categories` and `staple_items`

- [ ] **Step 3: Commit**

```bash
git add src/pages/ManagePage.jsx
git commit -m "feat: manage page — categories and staples CRUD"
```

---

## Task 7: Recipes Page

**Files:**
- Create: `src/components/IngredientAutocomplete.jsx`
- Create: `src/components/RecipeForm.jsx`
- Modify: `src/pages/RecipesPage.jsx`

- [ ] **Step 1: Create IngredientAutocomplete**

Create `src/components/IngredientAutocomplete.jsx`:

```jsx
import { useState, useRef, useEffect } from 'react'

const STORES = [
  { value: 'sams_club', label: "Sam's Club" },
  { value: 'aldi', label: 'Aldi' },
  { value: 'target', label: 'Target' },
]

/**
 * A single ingredient row: name autocomplete + store selector + remove button.
 * 
 * Props:
 *   allIngredients: Array<{id, name, store}> — the full catalog for autocomplete
 *   value: {name: string, store: string, existingId: string|null}
 *   onChange: (value) => void
 *   onRemove: () => void
 */
export function IngredientRow({ allIngredients, value, onChange, onRemove }) {
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
    onChange({ ...value, name: text, existingId: null })

    if (text.length < 1) {
      setSuggestions([])
      return
    }
    const matches = allIngredients.filter(i =>
      i.name.toLowerCase().includes(text.toLowerCase())
    ).slice(0, 6)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  function handleSelect(ingredient) {
    onChange({ name: ingredient.name, store: ingredient.store, existingId: ingredient.id })
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
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {showSuggestions && (
          <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg text-sm max-h-48 overflow-y-auto">
            {suggestions.map(s => (
              <li
                key={s.id}
                onMouseDown={() => handleSelect(s)}
                className="px-3 py-2 hover:bg-indigo-50 cursor-pointer flex justify-between"
              >
                <span>{s.name}</span>
                <span className="text-gray-400 text-xs">{STORES.find(st => st.value === s.store)?.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <select
        value={value.store}
        onChange={e => onChange({ ...value, store: e.target.value })}
        className="border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        {STORES.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
      </select>
      <button type="button" onClick={onRemove} className="text-red-400 hover:text-red-600 px-2 py-2 text-lg leading-none">&times;</button>
    </div>
  )
}
```

- [ ] **Step 2: Create RecipeForm**

Create `src/components/RecipeForm.jsx`:

```jsx
import { useState } from 'react'
import { IngredientRow } from './IngredientAutocomplete'
import { useIngredients } from '../hooks/useIngredients'

/**
 * Props:
 *   categories: Array<{id, name}>
 *   initial: {name, categoryId, ingredients: [{name, store, existingId}]} | null
 *   onSave: ({name, categoryId, ingredientIds: string[]}) => Promise<void>
 *   onCancel: () => void
 */
export function RecipeForm({ categories, initial, onSave, onCancel }) {
  const { ingredients: allIngredients, findOrCreate } = useIngredients()
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [ingredientRows, setIngredientRows] = useState(
    initial?.ingredients?.map(i => ({ name: i.name, store: i.store, existingId: i.id })) ?? []
  )
  const [saving, setSaving] = useState(false)

  function addRow() {
    setIngredientRows(rows => [...rows, { name: '', store: 'aldi', existingId: null }])
  }

  function updateRow(index, value) {
    setIngredientRows(rows => rows.map((r, i) => i === index ? value : r))
  }

  function removeRow(index) {
    setIngredientRows(rows => rows.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      // Resolve ingredient rows to IDs, creating new ingredients as needed
      const ingredientIds = await Promise.all(
        ingredientRows
          .filter(r => r.name.trim())
          .map(r => r.existingId ? Promise.resolve(r.existingId) : findOrCreate(r.name, r.store))
      )
      await onSave({ name: name.trim(), categoryId: categoryId || null, ingredientIds })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-3">
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Recipe name (e.g. Chicken Stir Fry)"
          required
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">No category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Ingredients</p>
        {ingredientRows.map((row, i) => (
          <IngredientRow
            key={i}
            allIngredients={allIngredients}
            value={row}
            onChange={v => updateRow(i, v)}
            onRemove={() => removeRow(i)}
          />
        ))}
        <button type="button" onClick={addRow} className="text-indigo-600 text-sm hover:underline">+ Add ingredient</button>
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Cancel</button>
        <button type="submit" disabled={saving} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Recipe'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Implement RecipesPage**

Replace `src/pages/RecipesPage.jsx`:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { RecipeForm } from '../components/RecipeForm'
import { useToast, Toast } from '../components/Toast'

const STORE_LABELS = { sams_club: "Sam's Club", aldi: 'Aldi', target: 'Target' }

export default function RecipesPage() {
  const { recipes, categories, loading, addRecipe, updateRecipe, deleteRecipe } = useRecipes()
  const { toast, showToast, dismissToast } = useToast()
  const [mode, setMode] = useState(null) // null | 'add' | {edit: recipe}
  const [filterCategory, setFilterCategory] = useState('all')

  const displayed = filterCategory === 'all'
    ? recipes
    : recipes.filter(r => r.category_id === filterCategory)

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

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>

  return (
    <div className="p-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Recipes</h1>
        {mode === null && (
          <button onClick={() => setMode('add')} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
            + Add Recipe
          </button>
        )}
      </div>

      {/* Add form */}
      {mode === 'add' && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
          <h2 className="font-semibold mb-3">New Recipe</h2>
          <RecipeForm categories={categories} initial={null} onSave={handleAdd} onCancel={() => setMode(null)} />
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 rounded-full text-sm ${filterCategory === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
        >
          All
        </button>
        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setFilterCategory(c.id)}
            className={`px-3 py-1 rounded-full text-sm ${filterCategory === c.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Recipe list */}
      {displayed.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🍳</p>
          <p>No recipes yet. Add your first one!</p>
        </div>
      )}

      <ul className="space-y-3">
        {displayed.map(recipe => (
          <li key={recipe.id} className="bg-white border border-gray-200 rounded-xl px-4 py-4">
            {mode?.edit?.id === recipe.id ? (
              <RecipeForm
                categories={categories}
                initial={{ name: recipe.name, categoryId: recipe.category_id, ingredients: recipe.ingredients }}
                onSave={handleUpdate}
                onCancel={() => setMode(null)}
              />
            ) : (
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-semibold">{recipe.name}</span>
                    {recipe.category && (
                      <span className="ml-2 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{recipe.category.name}</span>
                    )}
                  </div>
                  <div className="flex gap-3 ml-4 shrink-0">
                    <button onClick={() => setMode({ edit: recipe })} className="text-indigo-500 hover:text-indigo-700 text-sm">Edit</button>
                    <button onClick={() => handleDelete(recipe.id)} className="text-red-400 hover:text-red-600 text-sm">Delete</button>
                  </div>
                </div>
                {recipe.ingredients.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {recipe.ingredients.map(ing => (
                      <span key={ing.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {ing.name} <span className="text-gray-400">· {STORE_LABELS[ing.store]}</span>
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

- [ ] **Step 4: Manual verify**

```bash
npm run dev
```

Go to http://localhost:5173/recipes. Expected:
- "Add Recipe" opens a form
- Typing an ingredient name shows autocomplete from previously added ingredients
- Saving a new recipe → it appears in the list with ingredient tags + store labels
- Category filter chips work
- Edit / Delete work
- Check Supabase → rows appear in `recipes`, `ingredients`, `recipe_ingredients`

- [ ] **Step 5: Commit**

```bash
git add src/components/IngredientAutocomplete.jsx src/components/RecipeForm.jsx src/pages/RecipesPage.jsx
git commit -m "feat: recipes page with ingredient autocomplete and catalog persistence"
```

---

## Task 8: Planner Page — Full Planning Flow

**Files:**
- Create: `src/components/PantryInput.jsx`
- Create: `src/components/WeekGrid.jsx`
- Create: `src/components/RecipePicker.jsx`
- Create: `src/components/GroceryList.jsx`
- Modify: `src/pages/PlannerPage.jsx`

- [ ] **Step 1: Create PantryInput component**

Create `src/components/PantryInput.jsx`:

```jsx
import { useState } from 'react'

/**
 * Props:
 *   onStart: (pantryItems: string[]) => void
 */
export function PantryInput({ onStart }) {
  const [items, setItems] = useState([''])

  function updateItem(index, value) {
    setItems(prev => prev.map((item, i) => i === index ? value : item))
  }

  function addItem() {
    setItems(prev => [...prev, ''])
  }

  function removeItem(index) {
    setItems(prev => prev.filter((_, i) => i !== index))
  }

  function handleStart() {
    const filled = items.map(i => i.trim()).filter(Boolean)
    onStart(filled)
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
      <h2 className="text-xl font-bold mb-1">What needs using up?</h2>
      <p className="text-sm text-gray-500 mb-6">Add any ingredients from the fridge or pantry you want to use this week.</p>

      <div className="space-y-2 mb-4">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <input
              value={item}
              onChange={e => updateItem(i, e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addItem())}
              placeholder="e.g. spinach"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              autoFocus={i === items.length - 1 && i > 0}
            />
            {items.length > 1 && (
              <button type="button" onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600 px-2 text-lg">&times;</button>
            )}
          </div>
        ))}
        <button type="button" onClick={addItem} className="text-indigo-600 text-sm hover:underline">+ Add another</button>
      </div>

      <button
        onClick={handleStart}
        className="w-full bg-indigo-600 text-white py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
      >
        Let's plan →
      </button>
      <button
        onClick={() => onStart([])}
        className="w-full mt-2 text-gray-400 text-sm hover:text-gray-600"
      >
        Skip — nothing to use up
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Create WeekGrid component**

Create `src/components/WeekGrid.jsx`:

```jsx
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const SLOT_DISPLAY = {
  eating_out: { label: '🍽️ Eating Out', style: 'text-gray-400 italic' },
  flex: { label: '🎲 Flex Night', style: 'text-gray-400 italic' },
}

/**
 * Props:
 *   slots: Record<string, {type: 'recipe'|'eating_out'|'flex', recipe?: {id,name}} | null>
 *   onSlotClick: (day: string) => void
 */
export function WeekGrid({ slots, onSlotClick }) {
  return (
    <div className="space-y-2">
      {DAYS.map(day => {
        const key = day.toLowerCase()
        const slot = slots[key]
        const display = slot?.type === 'recipe'
          ? { label: slot.recipe?.name ?? 'Recipe', style: 'text-gray-800 font-medium' }
          : slot
          ? SLOT_DISPLAY[slot.type]
          : null

        return (
          <button
            key={day}
            onClick={() => onSlotClick(key)}
            className="w-full flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:shadow-sm transition-all text-left"
          >
            <span className="w-24 text-sm text-gray-500 shrink-0">{day}</span>
            {display ? (
              <span className={`text-sm ${display.style}`}>{display.label}</span>
            ) : (
              <span className="text-sm text-gray-300">+ pick meal</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create RecipePicker component**

Create `src/components/RecipePicker.jsx`:

```jsx
import { useState } from 'react'

/**
 * Props:
 *   recipes: Array<{id, name, category_id, category, ingredients: [{id, name}]}>
 *   categories: Array<{id, name}>
 *   pantryItems: string[] — lowercase ingredient names to use up
 *   onSelect: (slot: {type: 'recipe', recipe: {id, name}} | {type: 'eating_out'} | {type: 'flex'}) => void
 *   onClose: () => void
 *   day: string
 */
export function RecipePicker({ recipes, categories, pantryItems, onSelect, onClose, day }) {
  const [filterCategory, setFilterCategory] = useState('all')

  const normalised = pantryItems.map(p => p.toLowerCase())

  function matchesPantry(recipe) {
    if (normalised.length === 0) return false
    return recipe.ingredients.some(ing =>
      normalised.some(p => ing.name.toLowerCase().includes(p))
    )
  }

  const filtered = filterCategory === 'all'
    ? recipes
    : recipes.filter(r => r.category_id === filterCategory)

  const matches = filtered.filter(matchesPantry)
  const rest = filtered.filter(r => !matchesPantry(r))

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white shadow-2xl flex flex-col h-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Picking meal for</p>
            <p className="font-semibold capitalize">{day}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Quick options */}
        <div className="px-4 pt-4 pb-2 flex gap-2">
          <button
            onClick={() => onSelect({ type: 'eating_out' })}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50"
          >
            🍽️ Eating Out
          </button>
          <button
            onClick={() => onSelect({ type: 'flex' })}
            className="flex-1 border border-gray-200 rounded-lg py-2 text-sm hover:bg-gray-50"
          >
            🎲 Flex Night
          </button>
        </div>

        {/* Category filter */}
        <div className="px-4 py-2 flex gap-2 flex-wrap border-b border-gray-100">
          {[{ id: 'all', name: 'All' }, ...categories].map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(c.id)}
              className={`px-3 py-1 rounded-full text-xs ${filterCategory === c.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Recipe list */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {matches.length > 0 && (
            <>
              <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide mb-1">Uses what you have</p>
              {matches.map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelect({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                  className="w-full text-left px-3 py-3 rounded-lg border-2 border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                >
                  <span className="text-sm font-medium text-indigo-900">{r.name}</span>
                  <span className="text-xs text-indigo-400 ml-2">
                    {r.ingredients.filter(i => normalised.some(p => i.name.toLowerCase().includes(p))).map(i => i.name).join(', ')}
                  </span>
                </button>
              ))}
              {rest.length > 0 && <hr className="border-gray-100 my-2" />}
            </>
          )}
          {rest.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
              className="w-full text-left px-3 py-3 rounded-lg border border-gray-200 hover:border-indigo-200 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm">{r.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-8">No recipes yet. Add some in the Recipes tab.</p>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Create GroceryList component**

Create `src/components/GroceryList.jsx`:

```jsx
import { generateGroceryList } from '../utils/groceryList'

const STORE_CONFIG = [
  { key: 'sams_club', label: "🏪 Sam's Club" },
  { key: 'aldi', label: '🛒 Aldi' },
  { key: 'target', label: '🎯 Target' },
]

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 *   onClose: () => void
 */
export function GroceryList({ slots, recipes, staples, onClose }) {
  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  function copyList() {
    const lines = STORE_CONFIG
      .filter(s => list[s.key].length > 0)
      .flatMap(s => [
        s.label,
        ...list[s.key].map(i => `  □ ${i.name}${i.isStaple ? ' ★' : ''}`),
        '',
      ])
    navigator.clipboard.writeText(lines.join('\n'))
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold">Grocery List</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {total === 0 ? (
            <p className="text-center text-gray-400 py-8">No meals planned yet — nothing to buy.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {STORE_CONFIG.map(store => (
                <div key={store.key}>
                  <h3 className="font-semibold text-sm mb-3">{store.label}</h3>
                  {list[store.key].length === 0 ? (
                    <p className="text-xs text-gray-300">Nothing from here</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list[store.key].map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-400 mt-0.5">□</span>
                          <span>
                            {item.name}
                            {item.isStaple && (
                              <span className="ml-1 text-xs text-amber-500">★</span>
                            )}
                            {item.notes && (
                              <span className="block text-xs text-gray-400">{item.notes}</span>
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
            <p className="text-xs text-gray-400 mt-6">★ staple — check if you have any</p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Close</button>
          <button onClick={copyList} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            📋 Copy list
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Implement PlannerPage**

Replace `src/pages/PlannerPage.jsx`:

```jsx
import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
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
  const { staples } = useStaples()

  // Phase: 'pantry' | 'planning' | 'grocery'
  const [phase, setPhase] = useState('pantry')
  const [pantryItems, setPantryItems] = useState([])
  const [slots, setSlots] = useState(EMPTY_SLOTS)
  const [activeDay, setActiveDay] = useState(null) // which day has the picker open

  function handleStart(items) {
    setPantryItems(items)
    setPhase('planning')
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
    setPhase('pantry')
  }

  if (loading) return <div className="p-6 text-gray-400">Loading…</div>

  if (phase === 'pantry') {
    return <PantryInput onStart={handleStart} />
  }

  return (
    <div className="p-6">
      {/* Active recipe picker panel */}
      {activeDay && (
        <RecipePicker
          recipes={recipes}
          categories={categories}
          pantryItems={pantryItems}
          onSelect={handleSelect}
          onClose={() => setActiveDay(null)}
          day={activeDay}
        />
      )}

      {/* Grocery list modal */}
      {phase === 'grocery' && (
        <GroceryList
          slots={slots}
          recipes={recipes}
          staples={staples}
          onClose={() => setPhase('planning')}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">This Week</h1>
          {pantryItems.length > 0 && (
            <p className="text-sm text-indigo-500 mt-0.5">
              Using up: {pantryItems.join(', ')}
            </p>
          )}
        </div>
        <button onClick={handleReset} className="text-sm text-gray-400 hover:text-gray-600">
          ↺ Start over
        </button>
      </div>

      <WeekGrid slots={slots} onSlotClick={handleSlotClick} />

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setPhase('grocery')}
          className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-indigo-700 transition-colors"
        >
          🛒 Generate Grocery List
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Manual verify the full flow**

```bash
npm run dev
```

Run through the complete planning session:
1. Home screen shows pantry input → add "spinach" → click "Let's plan →"
2. Week grid appears → click Monday → recipe picker slides in
3. Verify recipes that use spinach are highlighted at top
4. Select a recipe → slot fills with recipe name
5. Click Tuesday → select "Eating Out" → shows in slot
6. Click "Generate Grocery List" → modal opens with items split by store
7. Staples appear with ★ 
8. "Eating Out" slot contributes no ingredients
9. "Copy list" copies formatted text to clipboard
10. "Start over" resets to pantry input

- [ ] **Step 7: Run all tests**

```bash
npx vitest run
```

Expected: 6 tests pass, 0 failures.

- [ ] **Step 8: Commit**

```bash
git add src/components/PantryInput.jsx src/components/WeekGrid.jsx src/components/RecipePicker.jsx src/components/GroceryList.jsx src/pages/PlannerPage.jsx
git commit -m "feat: planner page — full planning flow end to end"
```

---

## Task 9: Deploy to Vercel

- [ ] **Step 1: Push to GitHub**

```bash
gh repo create dinner-planner --private --source=. --remote=origin --push
```

If you don't have `gh` installed: create a repo at github.com, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/dinner-planner.git
git push -u origin main
```

- [ ] **Step 2: Deploy to Vercel**

Go to https://vercel.com → New Project → Import your `dinner-planner` repo.

In the "Environment Variables" section add:
- `VITE_SUPABASE_URL` → your Supabase project URL
- `VITE_SUPABASE_ANON_KEY` → your Supabase anon key

Click Deploy. Vercel auto-detects Vite.

- [ ] **Step 3: Verify production URL**

Open the deployed URL on desktop, kitchen tablet, and phone. Expected: app loads, Supabase reads and writes work, layout is usable on all three.

- [ ] **Step 4: Final commit (if any tweaks needed)**

```bash
git add -A && git commit -m "fix: production tweaks post-deploy"
git push
```
