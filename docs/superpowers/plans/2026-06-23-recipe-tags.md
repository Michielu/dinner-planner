# Recipe Tags (Favorite / Quick / Easy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `is_favorite`, `is_quick`, and `is_easy` boolean flags to recipes — stored in the DB, editable via the recipe form, and filterable in the recipe list.

**Architecture:** Three boolean columns added to the `recipes` table. `useRecipes` is extended to read/write them and expose a `toggleFlag` helper for single-field updates (used by the heart button without opening the form). `RecipeForm` gains three toggle buttons; `RecipesPage` gains filter pills and card badges.

**Tech Stack:** React (JSX), Supabase (Postgres + JS client), Tailwind CSS, Vitest (utility tests only — no component test harness exists)

## Global Constraints

- Tailwind class names follow existing design tokens: `bg-garden-patch`, `text-fresh-herb`, `bg-willow-mist`, `text-stone-grey`, `rounded-pill`, `shadow-card`, `bg-field-cream`
- All DB changes go in `supabase/migrations/` and are applied manually via the Supabase SQL editor (no CLI available)
- No new npm packages
- Existing `user_email` scoping on all Supabase queries must be preserved

---

### Task 1: DB Migration

**Files:**
- Create: `supabase/migrations/20260623_recipe_tags.sql`

**Interfaces:**
- Produces: `recipes.is_favorite`, `recipes.is_quick`, `recipes.is_easy` columns (boolean, not null, default false)

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260623_recipe_tags.sql`:

```sql
-- Migration: add favorite/quick/easy flags to recipes
-- Run this in the Supabase SQL editor.

alter table recipes
  add column if not exists is_favorite boolean not null default false,
  add column if not exists is_quick    boolean not null default false,
  add column if not exists is_easy     boolean not null default false;
```

- [ ] **Step 2: Apply the migration**

Open the Supabase dashboard → SQL Editor → paste the contents of the file above → Run.

Verify: open the Table Editor, select `recipes`, confirm the three new columns appear with default `false`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260623_recipe_tags.sql
git commit -m "feat: add is_favorite, is_quick, is_easy columns to recipes"
```

---

### Task 2: Extend `useRecipes` hook

**Files:**
- Modify: `src/hooks/useRecipes.js`

**Interfaces:**
- Consumes: `recipes.is_favorite`, `recipes.is_quick`, `recipes.is_easy` (from Task 1)
- Produces:
  - Each recipe object gains `is_favorite: boolean`, `is_quick: boolean`, `is_easy: boolean`
  - `addRecipe({ name, categoryId, ingredientIds, sourceUrl, isFavorite, isQuick, isEasy })`
  - `updateRecipe(id, { name, categoryId, ingredientIds, sourceUrl, isFavorite, isQuick, isEasy })`
  - `toggleFlag(id, field, value)` where `field` is `'is_favorite' | 'is_quick' | 'is_easy'` and `value` is boolean

- [ ] **Step 1: Add fields to the select query**

In `src/hooks/useRecipes.js`, update the select string (currently line 20-27) to include the three new fields:

```js
supabase
  .from('recipes')
  .select(`
    id, name, source_url, created_at,
    is_favorite, is_quick, is_easy,
    category:meal_categories(id, name),
    recipe_ingredients(
      ingredient:ingredients(id, name, store)
    )
  `)
  .eq('user_email', email)
  .order('name'),
```

- [ ] **Step 2: Update `addRecipe` to write the new fields**

Replace the existing `addRecipe` function (lines 51-66):

```js
async function addRecipe({ name, categoryId, ingredientIds, sourceUrl, isFavorite = false, isQuick = false, isEasy = false }) {
  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .insert({
      name,
      category_id: categoryId || null,
      source_url: sourceUrl || null,
      is_favorite: isFavorite,
      is_quick: isQuick,
      is_easy: isEasy,
      user_email: email,
    })
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
```

- [ ] **Step 3: Update `updateRecipe` to write the new fields**

Replace the existing `updateRecipe` function (lines 68-89):

```js
async function updateRecipe(id, { name, categoryId, ingredientIds, sourceUrl, isFavorite = false, isQuick = false, isEasy = false }) {
  const { error: recipeErr } = await supabase
    .from('recipes')
    .update({
      name,
      category_id: categoryId || null,
      source_url: sourceUrl || null,
      is_favorite: isFavorite,
      is_quick: isQuick,
      is_easy: isEasy,
    })
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
```

- [ ] **Step 4: Add `toggleFlag` helper**

Add this function after `deleteRecipe`:

```js
async function toggleFlag(id, field, value) {
  const { error } = await supabase
    .from('recipes')
    .update({ [field]: value })
    .eq('id', id)
    .eq('user_email', email)
  if (error) throw error
  setRecipes(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
}
```

- [ ] **Step 5: Export `toggleFlag` from the return object**

Update the return statement at the bottom of `useRecipes`:

```js
return {
  recipes, categories, loading, error,
  addRecipe, updateRecipe, deleteRecipe,
  toggleFlag,
  addCategory, deleteCategory,
  refresh: fetchAll,
}
```

- [ ] **Step 6: Verify**

Run `npm test` — existing tests should still pass (they don't touch useRecipes). Confirm no JS errors in console when loading the Recipes page in the browser.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useRecipes.js
git commit -m "feat: extend useRecipes with flag fields and toggleFlag helper"
```

---

### Task 3: Add flag toggles to `RecipeForm`

**Files:**
- Modify: `src/components/RecipeForm.jsx`

**Interfaces:**
- Consumes: `initial.isFavorite`, `initial.isQuick`, `initial.isEasy` (optional booleans, default false)
- Produces: `onSave({ name, categoryId, ingredientIds, sourceUrl, isFavorite, isQuick, isEasy })`

- [ ] **Step 1: Add flag state variables**

After the existing `useState` declarations (after line 28 `const [saving, setSaving] = useState(false)`), add:

```js
const [isFavorite, setIsFavorite] = useState(initial?.isFavorite ?? false)
const [isQuick, setIsQuick] = useState(initial?.isQuick ?? false)
const [isEasy, setIsEasy] = useState(initial?.isEasy ?? false)
```

- [ ] **Step 2: Include flags in the `onSave` call**

Update line 65 (the `onSave` call inside `handleSubmit`):

```js
await onSave({
  name: name.trim(),
  categoryId: categoryId || null,
  ingredientIds,
  sourceUrl: sourceUrl.trim() || null,
  isFavorite,
  isQuick,
  isEasy,
})
```

- [ ] **Step 3: Add the flag toggle buttons to the form**

Insert a new block after the source URL `<input>` (after line 106, before the closing `</div>` of the `space-y-2` wrapper):

```jsx
{/* Flags */}
<div className="flex gap-2 flex-wrap">
  {[
    { key: 'isFavorite', label: '♥ Favorite', value: isFavorite, set: setIsFavorite },
    { key: 'isQuick',    label: '⚡ Quick',    value: isQuick,    set: setIsQuick    },
    { key: 'isEasy',     label: '✓ Easy',      value: isEasy,     set: setIsEasy     },
  ].map(flag => (
    <button
      key={flag.key}
      type="button"
      onClick={() => flag.set(v => !v)}
      className={`px-3 py-1.5 rounded-pill text-xs font-bold transition-colors ${
        flag.value
          ? 'bg-garden-patch text-fresh-herb'
          : 'bg-willow-mist text-stone-grey hover:bg-garden-patch/10'
      }`}
    >
      {flag.label}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Manual verification**

Start the dev server (`npm run dev`). Open Recipes → Add Recipe. Confirm the three toggle buttons appear below the URL field, toggle active/inactive state on click, and the values are included when saving (check the Supabase Table Editor after saving a recipe with flags set).

Open an existing recipe's Edit form — confirm the toggles reflect the saved values.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecipeForm.jsx
git commit -m "feat: add favorite/quick/easy toggles to RecipeForm"
```

---

### Task 4: Filter pills and card badges in `RecipesPage`

**Files:**
- Modify: `src/pages/RecipesPage.jsx`

**Interfaces:**
- Consumes:
  - `toggleFlag(id, field, value)` from `useRecipes` (Task 2)
  - `recipe.is_favorite`, `recipe.is_quick`, `recipe.is_easy` (Task 2)
  - `initial.isFavorite`, `initial.isQuick`, `initial.isEasy` passed to `RecipeForm` (Task 3)
  - `onSave` payload `{ isFavorite, isQuick, isEasy }` forwarded through `handleUpdate` (Task 3)

- [ ] **Step 1: Destructure `toggleFlag` from `useRecipes`**

Update line 10:

```js
const { recipes, categories, loading, addRecipe, updateRecipe, deleteRecipe, toggleFlag } = useRecipes()
```

- [ ] **Step 2: Add `activeFlags` state**

After the existing `const [filterCategory, setFilterCategory] = useState('all')` line, add:

```js
const [activeFlags, setActiveFlags] = useState(new Set())

function toggleFlagFilter(flag) {
  setActiveFlags(prev => {
    const next = new Set(prev)
    next.has(flag) ? next.delete(flag) : next.add(flag)
    return next
  })
}
```

- [ ] **Step 3: Apply flag filters to `displayed`**

Replace the existing `displayed` computation:

```js
const displayed = recipes
  .filter(r => filterCategory === 'all' || r.category?.id === filterCategory)
  .filter(r => !activeFlags.has('favorite') || r.is_favorite)
  .filter(r => !activeFlags.has('quick')    || r.is_quick)
  .filter(r => !activeFlags.has('easy')     || r.is_easy)
```

- [ ] **Step 4: Update `handleUpdate` to forward flag fields**

Replace the existing `handleUpdate` function:

```js
async function handleUpdate(data) {
  try {
    await updateRecipe(mode.edit.id, data)
    setMode(null)
  } catch {
    showToast("Couldn't update recipe, try again")
  }
}
```

(No change needed to `handleUpdate` itself — it already forwards the full `data` object. But update the `initial` prop passed to `RecipeForm` in edit mode to include the flag fields — see Step 6.)

- [ ] **Step 5: Add flag filter pills after the category pills**

Replace the category filter block (lines 114-129):

```jsx
{/* Filters */}
<div className="flex gap-2 flex-wrap mb-5">
  {[{ id: 'all', name: 'All' }, ...categories].map(c => (
    <button
      key={c.id}
      onClick={() => setFilterCategory(c.id)}
      className={`px-3 py-1.5 rounded-pill text-xs font-bold transition-colors uppercase ${
        filterCategory === c.id
          ? 'bg-garden-patch text-fresh-herb'
          : 'bg-willow-mist text-stone-grey hover:bg-garden-patch/10'
      }`}
    >
      {c.name}
    </button>
  ))}
  <span className="w-px bg-willow-mist mx-1" />
  {[
    { flag: 'favorite', label: '♥ Favorites' },
    { flag: 'quick',    label: '⚡ Quick'     },
    { flag: 'easy',     label: '✓ Easy'       },
  ].map(({ flag, label }) => (
    <button
      key={flag}
      onClick={() => toggleFlagFilter(flag)}
      className={`px-3 py-1.5 rounded-pill text-xs font-bold transition-colors ${
        activeFlags.has(flag)
          ? 'bg-garden-patch text-fresh-herb'
          : 'bg-willow-mist text-stone-grey hover:bg-garden-patch/10'
      }`}
    >
      {label}
    </button>
  ))}
</div>
```

- [ ] **Step 6: Add flag badges to recipe cards and wire heart toggle**

Replace the recipe card header block (lines 153-172, the name/category/source row) with:

```jsx
<div className="flex items-start justify-between">
  <div className="flex flex-wrap items-center gap-1.5">
    <span className="font-bold text-soil-shadow uppercase">{recipe.name}</span>
    {recipe.category && (
      <span className="text-xs bg-garden-patch/10 text-garden-patch font-bold px-2 py-0.5 rounded-pill uppercase">
        {recipe.category.name}
      </span>
    )}
    {recipe.is_favorite && (
      <button
        type="button"
        onClick={() => toggleFlag(recipe.id, 'is_favorite', false)}
        className="text-xs bg-garden-patch text-fresh-herb font-bold px-2 py-0.5 rounded-pill"
        title="Remove from favorites"
      >
        ♥
      </button>
    )}
    {!recipe.is_favorite && (
      <button
        type="button"
        onClick={() => toggleFlag(recipe.id, 'is_favorite', true)}
        className="text-xs bg-willow-mist text-stone-grey font-bold px-2 py-0.5 rounded-pill hover:bg-garden-patch/10"
        title="Add to favorites"
      >
        ♡
      </button>
    )}
    {recipe.is_quick && (
      <span className="text-xs bg-willow-mist text-stone-grey font-bold px-2 py-0.5 rounded-pill">⚡ Quick</span>
    )}
    {recipe.is_easy && (
      <span className="text-xs bg-willow-mist text-stone-grey font-bold px-2 py-0.5 rounded-pill">✓ Easy</span>
    )}
    {recipe.source_url && (
      <a
        href={recipe.source_url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-stone-grey hover:text-garden-patch transition-colors"
        onClick={e => e.stopPropagation()}
      >
        Source ↗
      </a>
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
```

- [ ] **Step 7: Pass flag fields to RecipeForm in edit mode**

Update the `initial` prop on the edit-mode `RecipeForm` (line 147):

```jsx
initial={{
  name: recipe.name,
  categoryId: recipe.category?.id,
  sourceUrl: recipe.source_url ?? '',
  ingredients: recipe.ingredients,
  isFavorite: recipe.is_favorite,
  isQuick: recipe.is_quick,
  isEasy: recipe.is_easy,
}}
```

- [ ] **Step 8: Manual verification**

With the dev server running:
1. Add a new recipe with ♥ and ⚡ active → confirm badges appear on the card
2. Click the heart badge on a favorited recipe → confirms it unfavorites (badge changes to ♡) without opening the form
3. Click ♡ on an unfavorited recipe → confirms it favorites
4. Click "♥ Favorites" filter pill → only favorited recipes show
5. Click "⚡ Quick" with Favorites active → only recipes with both flags show
6. Edit a flagged recipe → confirm toggles are pre-filled correctly, saving preserves flags

- [ ] **Step 9: Commit**

```bash
git add src/pages/RecipesPage.jsx
git commit -m "feat: add flag filter pills and card badges to RecipesPage"
```
