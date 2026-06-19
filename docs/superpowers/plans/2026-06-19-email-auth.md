# Email-Gated Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email-based auth so multiple users each see only their own data, with a localStorage session and a simple allowed-emails allowlist in Supabase.

**Architecture:** An `allowed_emails` table acts as the access list. On login, the app queries the table and stores the email in localStorage. Every data hook reads that email and filters all queries with `.eq('user_email', email)`. New users are prompted to confirm before their email is inserted, then seeded with default meal categories.

**Tech Stack:** React 18, React Router v7, Supabase anon client, localStorage

**Spec:** `docs/superpowers/specs/2026-06-19-email-auth-design.md`

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260619_email_auth.sql` | Create — schema + existing-data migration SQL |
| `src/hooks/useAuth.js` | Create — localStorage email session |
| `src/pages/LoginPage.jsx` | Create — login + confirm flow |
| `src/App.jsx` | Modify — route guard, `/login` route, sign-out button |
| `src/hooks/useRecipes.js` | Modify — scope all queries by `user_email` |
| `src/hooks/useStaples.js` | Modify — scope all queries by `user_email` |
| `src/hooks/useIngredients.js` | Modify — scope all queries by `user_email` |
| `src/hooks/useStores.js` | Modify — scope all queries by `user_email` |
| `src/hooks/useWeekPlan.js` | Modify — scope all queries by `user_email` |

---

## Task 1: Database Migration SQL

**Files:**
- Create: `supabase/migrations/20260619_email_auth.sql`

> This SQL must be pasted and run manually in the Supabase SQL editor. There is no CLI migration runner in this project.

- [ ] **Step 1: Create the migration file**

```sql
-- allowed_emails: the access list
create table if not exists allowed_emails (
  email text primary key
);
alter table allowed_emails enable row level security;
create policy "anon_select" on allowed_emails for select to anon using (true);
create policy "anon_insert" on allowed_emails for insert to anon with check (true);

-- Add user_email to all user-owned tables
alter table week_plan         add column if not exists user_email text not null default '';
alter table staple_items      add column if not exists user_email text not null default '';
alter table ingredients       add column if not exists user_email text not null default '';
alter table stores            add column if not exists user_email text not null default '';
alter table recipes           add column if not exists user_email text not null default '';
alter table recipe_ingredients add column if not exists user_email text not null default '';
alter table meal_categories   add column if not exists user_email text not null default '';
```

- [ ] **Step 2: Run it in Supabase SQL editor**

Paste the SQL above into the Supabase SQL editor and execute it.

- [ ] **Step 3: Claim existing rows**

Immediately after the column migration succeeds, run this in the same SQL editor:

```sql
update week_plan          set user_email = 'samina.menning@gmail.com' where user_email = '';
update staple_items       set user_email = 'samina.menning@gmail.com' where user_email = '';
update ingredients        set user_email = 'samina.menning@gmail.com' where user_email = '';
update stores             set user_email = 'samina.menning@gmail.com' where user_email = '';
update recipes            set user_email = 'samina.menning@gmail.com' where user_email = '';
update recipe_ingredients set user_email = 'samina.menning@gmail.com' where user_email = '';
update meal_categories    set user_email = 'samina.menning@gmail.com' where user_email = '';

-- Also seed samina's email into the allowlist
insert into allowed_emails (email) values ('samina.menning@gmail.com') on conflict do nothing;
```

- [ ] **Step 4: Commit the migration file**

```bash
git add supabase/migrations/20260619_email_auth.sql
git commit -m "feat: add allowed_emails table and user_email column migration"
```

---

## Task 2: Create `src/hooks/useAuth.js`

**Files:**
- Create: `src/hooks/useAuth.js`

- [ ] **Step 1: Write the hook**

```js
const KEY = 'dinner_planner_email'

export function useAuth() {
  const email = localStorage.getItem(KEY) ?? null

  function signIn(e) {
    localStorage.setItem(KEY, e)
  }

  function signOut() {
    localStorage.removeItem(KEY)
    window.location.href = '/login'
  }

  return { email, signIn, signOut }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useAuth.js
git commit -m "feat: add useAuth hook for localStorage email session"
```

---

## Task 3: Create `src/pages/LoginPage.jsx`

**Files:**
- Create: `src/pages/LoginPage.jsx`

- [ ] **Step 1: Write the page**

```jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const DEFAULT_CATEGORIES = [
  { name: 'Pasta',       sort_order: 1 },
  { name: 'Soup',        sort_order: 2 },
  { name: 'Salad',       sort_order: 3 },
  { name: 'Chicken',     sort_order: 4 },
  { name: 'Beef',        sort_order: 5 },
  { name: 'Seafood',     sort_order: 6 },
  { name: 'Vegetarian',  sort_order: 7 },
  { name: 'Quick',       sort_order: 8 },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const { email: storedEmail, signIn } = useAuth()

  const [input, setInput]         = useState('')
  const [view, setView]           = useState('form')   // 'form' | 'confirm'
  const [error, setError]         = useState(null)
  const [loading, setLoading]     = useState(false)
  const [pendingEmail, setPending] = useState(null)

  // Already logged in
  if (storedEmail) {
    navigate('/', { replace: true })
    return null
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = input.trim().toLowerCase()
    if (!trimmed) return
    setError(null)
    setLoading(true)

    const { data, error: queryErr } = await supabase
      .from('allowed_emails')
      .select('email')
      .eq('email', trimmed)
      .maybeSingle()

    setLoading(false)

    if (queryErr) {
      setError('Something went wrong. Please try again.')
      return
    }

    if (data) {
      signIn(trimmed)
      navigate('/', { replace: true })
    } else {
      setPending(trimmed)
      setView('confirm')
    }
  }

  async function handleConfirmYes() {
    setError(null)
    setLoading(true)

    const { error: insertErr } = await supabase
      .from('allowed_emails')
      .insert({ email: pendingEmail })

    if (insertErr) {
      setLoading(false)
      setError('Could not create account. Please try again.')
      return
    }

    await supabase
      .from('meal_categories')
      .insert(DEFAULT_CATEGORIES.map(c => ({ ...c, user_email: pendingEmail })))

    setLoading(false)
    signIn(pendingEmail)
    navigate('/', { replace: true })
  }

  function handleConfirmNo() {
    setPending(null)
    setView('form')
    setInput('')
  }

  return (
    <div className="min-h-screen bg-field-cream flex items-center justify-center p-4">
      <div className="bg-grain-sand rounded-3xl shadow-card w-full max-w-sm p-8">
        <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow mb-6">
          Dinner Planner
        </h1>

        {view === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-stone-grey mb-1">Email</label>
              <input
                type="email"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-garden-patch text-fresh-herb font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Sign in'}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-stone-grey">
              We don't recognize <span className="font-bold text-soil-shadow">{pendingEmail}</span>.
              Create a new account?
            </p>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button
                onClick={handleConfirmYes}
                disabled={loading}
                className="flex-1 bg-garden-patch text-fresh-herb font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Yes, create account'}
              </button>
              <button
                onClick={handleConfirmNo}
                disabled={loading}
                className="flex-1 border-2 border-willow-mist text-stone-grey font-bold py-3 rounded-2xl text-sm hover:border-garden-patch hover:text-soil-shadow transition-colors"
              >
                No, go back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/LoginPage.jsx
git commit -m "feat: add LoginPage with email check and new-account confirmation"
```

---

## Task 4: Update `src/App.jsx`

**Files:**
- Modify: `src/App.jsx`

Add: import `Navigate` from react-router-dom, import `useAuth`, import `LoginPage`. Add route guard, `/login` route, and sign-out button in the nav.

- [ ] **Step 1: Replace `src/App.jsx`**

```jsx
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { ConnectionBanner } from './components/ConnectionBanner'
import { BottomNav } from './components/BottomNav'
import { useAuth } from './hooks/useAuth'
import PlannerPage from './pages/PlannerPage'
import RecipesPage from './pages/RecipesPage'
import ManagePage from './pages/ManagePage'
import GroceryPage from './pages/GroceryPage'
import LoginPage from './pages/LoginPage'

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
  const { email, signOut } = useAuth()
  const location = useLocation()
  const isLoginRoute = location.pathname === '/login'

  if (!email && !isLoginRoute) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-field-cream font-body text-soil-shadow">
      <ConnectionBanner />
      {!isLoginRoute && (
        <nav className="bg-willow-mist shadow-card px-6 py-4 flex items-center gap-3">
          <span className="font-display font-light text-2xl tracking-tight text-garden-patch mr-4">
            Dinner Planner
          </span>
          <div className="hidden md:flex items-center gap-3">
            <NavItem to="/" label="This Week" />
            <NavItem to="/recipes" label="Recipes" />
            <NavItem to="/grocery" label="Grocery List" />
            <NavItem to="/manage" label="Catalog" />
          </div>
          <div className="ml-auto hidden md:block">
            <button
              onClick={signOut}
              className="text-xs text-stone-grey hover:text-soil-shadow transition-colors"
            >
              Sign out
            </button>
          </div>
        </nav>
      )}
      <main className={`max-w-4xl mx-auto ${isLoginRoute ? '' : 'pb-16 md:pb-0'}`}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PlannerPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/grocery" element={<GroceryPage />} />
          <Route path="/manage" element={<ManagePage />} />
        </Routes>
      </main>
      {!isLoginRoute && <BottomNav />}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add route guard, login route, and sign-out button to App"
```

---

## Task 5: Update `src/hooks/useRecipes.js`

**Files:**
- Modify: `src/hooks/useRecipes.js`

- [ ] **Step 1: Replace the file**

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRecipes() {
  const { email } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const [recipesRes, categoriesRes] = await Promise.all([
      supabase
        .from('recipes')
        .select(`
          id, name, source_url, created_at,
          category:meal_categories(id, name),
          recipe_ingredients(
            ingredient:ingredients(id, name, store)
          )
        `)
        .eq('user_email', email)
        .order('name'),
      supabase
        .from('meal_categories')
        .select('id, name, sort_order')
        .eq('user_email', email)
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
  }, [email])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function addRecipe({ name, categoryId, ingredientIds, sourceUrl }) {
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .insert({ name, category_id: categoryId || null, source_url: sourceUrl || null, user_email: email })
      .select('id')
      .single()
    if (recipeErr) throw recipeErr

    if (ingredientIds.length > 0) {
      const { error: joinErr } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientIds.map(ingredient_id => ({ recipe_id: recipe.id, ingredient_id, user_email: email })))
      if (joinErr) throw joinErr
    }
    await fetchAll()
  }

  async function updateRecipe(id, { name, categoryId, ingredientIds, sourceUrl }) {
    const { error: recipeErr } = await supabase
      .from('recipes')
      .update({ name, category_id: categoryId || null, source_url: sourceUrl || null })
      .eq('id', id)
      .eq('user_email', email)
    if (recipeErr) throw recipeErr

    const { error: deleteErr } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', id)
    if (deleteErr) throw deleteErr

    if (ingredientIds.length > 0) {
      const { error: joinErr } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientIds.map(ingredient_id => ({ recipe_id: id, ingredient_id, user_email: email })))
      if (joinErr) throw joinErr
    }
    await fetchAll()
  }

  async function deleteRecipe(id) {
    const { error } = await supabase.from('recipes').delete().eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchAll()
  }

  async function addCategory(name) {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0)
    const { error } = await supabase
      .from('meal_categories')
      .insert({ name, sort_order: maxOrder + 1, user_email: email })
    if (error) throw error
    await fetchAll()
  }

  async function deleteCategory(id) {
    const { error } = await supabase.from('meal_categories').delete().eq('id', id).eq('user_email', email)
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

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useRecipes.js
git commit -m "feat: scope useRecipes queries by user_email"
```

---

## Task 6: Update `src/hooks/useStaples.js` and `src/hooks/useIngredients.js`

**Files:**
- Modify: `src/hooks/useStaples.js`
- Modify: `src/hooks/useIngredients.js`

- [ ] **Step 1: Replace `src/hooks/useStaples.js`**

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useStaples() {
  const { email } = useAuth()
  const [staples, setStaples] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStaples = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('staple_items')
      .select('id, name, store, notes, created_at')
      .eq('user_email', email)
      .order('name')
    if (!error) setStaples(data)
    setLoading(false)
  }, [email])

  useEffect(() => { fetchStaples() }, [fetchStaples])

  async function addStaple({ name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .insert({ name, store, notes: notes || null, user_email: email })
    if (error) throw error
    await fetchStaples()
  }

  async function updateStaple(id, { name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .update({ name, store, notes: notes || null })
      .eq('id', id)
      .eq('user_email', email)
    if (error) throw error
    await fetchStaples()
  }

  async function deleteStaple(id) {
    const { error } = await supabase.from('staple_items').delete().eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchStaples()
  }

  return { staples, loading, addStaple, updateStaple, deleteStaple }
}
```

- [ ] **Step 2: Replace `src/hooks/useIngredients.js`**

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useIngredients() {
  const { email } = useAuth()
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchIngredients = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, store')
      .eq('user_email', email)
      .order('name')
    if (!error) setIngredients(data)
    setLoading(false)
  }, [email])

  useEffect(() => { fetchIngredients() }, [fetchIngredients])

  async function findOrCreate(name, store) {
    const normalised = name.trim().toLowerCase()
    const existing = ingredients.find(i => i.name.toLowerCase() === normalised)
    if (existing) return existing.id

    const { data, error } = await supabase
      .from('ingredients')
      .insert({ name: name.trim(), store, user_email: email })
      .select('id')
      .single()
    if (error) throw error
    await fetchIngredients()
    return data.id
  }

  async function deleteIngredient(id) {
    const { error } = await supabase.from('ingredients').delete().eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchIngredients()
  }

  async function updateIngredient(id, patch) {
    const { error } = await supabase.from('ingredients').update(patch).eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchIngredients()
  }

  return { ingredients, loading, findOrCreate, deleteIngredient, updateIngredient, refresh: fetchIngredients }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useStaples.js src/hooks/useIngredients.js
git commit -m "feat: scope useStaples and useIngredients queries by user_email"
```

---

## Task 7: Update `src/hooks/useStores.js`

**Files:**
- Modify: `src/hooks/useStores.js`

Note: `deleteStore` checks ingredient and staple counts — these must also be scoped by `user_email` so one user can't block another from deleting a store.

- [ ] **Step 1: Replace `src/hooks/useStores.js`**

```js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { slugify } from '../utils/slugify'
import { useAuth } from './useAuth'

export function useStores() {
  const { email } = useAuth()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStores = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('stores')
      .select('id, value, label, sort_order')
      .eq('user_email', email)
      .order('sort_order')
    if (!error) setStores(data)
    setLoading(false)
  }, [email])

  useEffect(() => { fetchStores() }, [fetchStores])

  async function addStore({ label }) {
    const value = slugify(label, stores.map(s => s.value))
    const sort_order = stores.length > 0
      ? Math.max(...stores.map(s => s.sort_order)) + 1
      : 0
    const { error } = await supabase
      .from('stores')
      .insert({ value, label: label.trim(), sort_order, user_email: email })
    if (error) throw error
    await fetchStores()
  }

  async function deleteStore(value) {
    const { count: ingCount } = await supabase
      .from('ingredients')
      .select('*', { count: 'exact', head: true })
      .eq('store', value)
      .eq('user_email', email)

    const { count: stapleCount } = await supabase
      .from('staple_items')
      .select('*', { count: 'exact', head: true })
      .eq('store', value)
      .eq('user_email', email)

    if ((ingCount ?? 0) > 0 || (stapleCount ?? 0) > 0) {
      throw { inUse: true }
    }

    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('value', value)
      .eq('user_email', email)
    if (error) throw error
    await fetchStores()
  }

  return { stores, loading, addStore, deleteStore }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useStores.js
git commit -m "feat: scope useStores queries by user_email"
```

---

## Task 8: Update `src/hooks/useWeekPlan.js`

**Files:**
- Modify: `src/hooks/useWeekPlan.js`

Note: `useWeekPlan` uses `useEffect` directly (not `useCallback`) for its load. Add `email` to the dep array and scope the select. The insert row and delete also need `user_email`.

- [ ] **Step 1: Replace `src/hooks/useWeekPlan.js`**

```js
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeSlots } from '../utils/weekPlan'
import { useAuth } from './useAuth'

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

export function useWeekPlan() {
  const { email } = useAuth()
  const [plan, setPlan] = useState(DEFAULTS)
  const [planCreatedAt, setPlanCreatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const planIdRef = useRef(null)
  const planRef = useRef(DEFAULTS)

  useEffect(() => {
    if (!email) { setLoading(false); return }

    async function load() {
      const { data, error } = await supabase
        .from('week_plan')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        planIdRef.current = data.id
        setPlanCreatedAt(data.created_at)
        const loaded = {
          slots: normalizeSlots({ ...EMPTY_SLOTS, ...(data.slots ?? {}) }),
          selectedStapleIds: data.selected_staple_ids ?? [],
          pantryItems: data.pantry_items ?? [],
          addedIngredientIds: data.added_ingredient_ids ?? [],
          phase: VALID_PHASES.includes(data.phase) ? data.phase : 'plan',
          visitedPhases: (data.visited_phases ?? ['staples']).filter(p => VALID_PHASES.includes(p)),
        }
        planRef.current = loaded
        setPlan(loaded)
      }
      setLoading(false)
    }
    load()
  }, [email])

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
      user_email: email,
    }

    if (planIdRef.current) {
      supabase.from('week_plan').update(row).eq('id', planIdRef.current).eq('user_email', email).then(() => {})
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
      await supabase.from('week_plan').delete().eq('id', planIdRef.current).eq('user_email', email)
    }
    planIdRef.current = null
    planRef.current = DEFAULTS
    setPlan(DEFAULTS)
    setPlanCreatedAt(null)
  }

  return { plan, planCreatedAt, loading, updatePlan, resetPlan }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useWeekPlan.js
git commit -m "feat: scope useWeekPlan queries by user_email"
```

---

## Manual validation checklist

After all tasks complete:

1. **DB migration ran** — Supabase tables have `user_email` column, `allowed_emails` table exists, `samina.menning@gmail.com` is in `allowed_emails` and owns all existing rows.
2. **Login flow** — Visit `/` unauthenticated → redirected to `/login`. Enter known email → lands on `/`. Enter unknown email → confirmation step → Yes → new account created with default categories.
3. **Typo protection** — Enter unknown email → No in confirmation → back to form.
4. **Data isolation** — Log in as samina, see existing data. Log in as a different email, see empty app.
5. **Sign out** — Click "Sign out" → redirected to `/login`.
6. **All pages** — Planner, Recipes, Grocery List, Catalog all work normally while logged in.
