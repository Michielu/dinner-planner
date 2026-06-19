# Recipe Source URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `source_url` field to recipes so users can save and revisit the web page that helped them make a meal.

**Architecture:** A new nullable `source_url` column on the `recipes` table flows through `useRecipes` (select + add + update), is editable in `RecipeForm`, is auto-filled by `RecipeImport` from the fetched URL, and is shown as a clickable link on recipe cards in `RecipesPage`.

**Tech Stack:** React 18, Supabase (supabase-js v2), Tailwind CSS v3, Vitest. Migration pattern: SQL file in `supabase/migrations/` run manually in the Supabase SQL editor.

---

## File Map

| File | Action |
|------|--------|
| `supabase/migrations/20260619_add_recipe_source_url.sql` | **Create** — add column |
| `src/hooks/useRecipes.js` | Modify — select + addRecipe + updateRecipe |
| `src/components/RecipeForm.jsx` | Modify — add sourceUrl prop + URL input |
| `src/components/RecipeImport.jsx` | Modify — pass url as sourceUrl to addRecipe |
| `src/pages/RecipesPage.jsx` | Modify — pass sourceUrl in edit initial, render link on cards |

---

## Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260619_add_recipe_source_url.sql`

> ⚠️ **This task requires manual execution in the Supabase SQL editor.** The agent creates the file; a human must run the SQL.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/20260619_add_recipe_source_url.sql`:

```sql
-- Migration: add source_url to recipes for saving reference links
-- Run this in the Supabase SQL editor.

alter table recipes add column if not exists source_url text;
```

- [ ] **Step 2: Run the migration**

Open the Supabase dashboard → SQL editor → paste and run the SQL above.

- [ ] **Step 3: Verify**

In the Supabase Table Editor, open the `recipes` table. Confirm a `source_url` column of type `text` exists (nullable, no default).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260619_add_recipe_source_url.sql
git commit -m "feat: add source_url migration for recipes"
```

---

## Task 2: Update useRecipes Hook

**Files:**
- Modify: `src/hooks/useRecipes.js`

Add `source_url` to the select query, and include it in `addRecipe` and `updateRecipe`.

- [ ] **Step 1: Update the select query**

In `src/hooks/useRecipes.js`, find the `.select(...)` call (lines 17–23):

```js
        .select(`
          id, name, created_at,
          category:meal_categories(id, name),
          recipe_ingredients(
            ingredient:ingredients(id, name, store)
          )
        `)
```

Change to:

```js
        .select(`
          id, name, source_url, created_at,
          category:meal_categories(id, name),
          recipe_ingredients(
            ingredient:ingredients(id, name, store)
          )
        `)
```

- [ ] **Step 2: Update addRecipe**

Find `addRecipe` (line 46):

```js
  async function addRecipe({ name, categoryId, ingredientIds }) {
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .insert({ name, category_id: categoryId || null })
```

Change to:

```js
  async function addRecipe({ name, categoryId, ingredientIds, sourceUrl }) {
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .insert({ name, category_id: categoryId || null, source_url: sourceUrl || null })
```

- [ ] **Step 3: Update updateRecipe**

Find `updateRecipe` (line 63):

```js
  async function updateRecipe(id, { name, categoryId, ingredientIds }) {
    const { error: recipeErr } = await supabase
      .from('recipes')
      .update({ name, category_id: categoryId || null })
```

Change to:

```js
  async function updateRecipe(id, { name, categoryId, ingredientIds, sourceUrl }) {
    const { error: recipeErr } = await supabase
      .from('recipes')
      .update({ name, category_id: categoryId || null, source_url: sourceUrl || null })
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: 39 passed (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRecipes.js
git commit -m "feat: include source_url in useRecipes select, add, and update"
```

---

## Task 3: Update RecipeForm

**Files:**
- Modify: `src/components/RecipeForm.jsx`

Add `sourceUrl` to the `initial` prop, add a URL input field below the recipe name, and pass `sourceUrl` to `onSave`.

- [ ] **Step 1: Add sourceUrl state**

In `src/components/RecipeForm.jsx`, find the existing state declarations (lines 16–28):

```js
export function RecipeForm({ categories, staples = [], stores, initial, onSave, onCancel }) {
  const { ingredients: allIngredients, findOrCreate } = useIngredients()
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
```

Change to:

```js
export function RecipeForm({ categories, staples = [], stores, initial, onSave, onCancel }) {
  const { ingredients: allIngredients, findOrCreate } = useIngredients()
  const [name, setName] = useState(initial?.name ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
```

- [ ] **Step 2: Pass sourceUrl to onSave**

Find the `onSave` call in `handleSubmit` (line 64):

```js
      await onSave({ name: name.trim(), categoryId: categoryId || null, ingredientIds })
```

Change to:

```js
      await onSave({ name: name.trim(), categoryId: categoryId || null, ingredientIds, sourceUrl: sourceUrl.trim() || null })
```

- [ ] **Step 3: Add the URL input field**

Find the name input and the category chips section in the JSX (lines 73–97):

```jsx
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
```

Change to:

```jsx
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
```

Wait — actually insert the URL input as a separate row after the name+category block. Replace the entire `{/* Name + category */}` section:

```jsx
      {/* Name + category */}
      <div className="space-y-2">
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
        <input
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          placeholder="Source URL (optional)"
          type="text"
          className="w-full border border-willow-mist rounded-xl bg-field-cream px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
        />
      </div>
```

- [ ] **Step 4: Update the JSDoc comment**

Find the JSDoc at the top of the file (lines 5–12):

```js
/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store, notes}>
 *   stores: Array<{value, label, sort_order}>
 *   initial: {name, categoryId, ingredients: [{name, store, id}]} | null
 *   onSave: ({name, categoryId, ingredientIds: string[]}) => Promise<void>
 *   onCancel: () => void
 */
```

Change to:

```js
/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store, notes}>
 *   stores: Array<{value, label, sort_order}>
 *   initial: {name, categoryId, sourceUrl, ingredients: [{name, store, id}]} | null
 *   onSave: ({name, categoryId, ingredientIds: string[], sourceUrl: string|null}) => Promise<void>
 *   onCancel: () => void
 */
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: 39 passed.

- [ ] **Step 6: Commit**

```bash
git add src/components/RecipeForm.jsx
git commit -m "feat: add source URL input to RecipeForm"
```

---

## Task 4: Update RecipeImport

**Files:**
- Modify: `src/components/RecipeImport.jsx`

Pass the fetched `url` as `sourceUrl` when calling `addRecipe`.

- [ ] **Step 1: Update the addRecipe call**

In `src/components/RecipeImport.jsx`, find the `addRecipe` call (lines 119–123):

```js
      await addRecipe({
        name: recipeName.trim(),
        categoryId: categoryId || null,
        ingredientIds: [...new Set(ingredientIds)],
      })
```

Change to:

```js
      await addRecipe({
        name: recipeName.trim(),
        categoryId: categoryId || null,
        ingredientIds: [...new Set(ingredientIds)],
        sourceUrl: url.trim() || null,
      })
```

- [ ] **Step 2: Update the JSDoc comment**

Find the JSDoc at the top of the file (lines 6–12):

```js
/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store}>
 *   stores: Array<{value, label}>
 *   addRecipe: ({name, categoryId, ingredientIds}) => Promise<void>
 *   onDone: () => void
 *   onCancel: () => void
 */
```

Change to:

```js
/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store}>
 *   stores: Array<{value, label}>
 *   addRecipe: ({name, categoryId, ingredientIds, sourceUrl}) => Promise<void>
 *   onDone: () => void
 *   onCancel: () => void
 */
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 39 passed.

- [ ] **Step 4: Commit**

```bash
git add src/components/RecipeImport.jsx
git commit -m "feat: pass source URL to addRecipe in RecipeImport"
```

---

## Task 5: Update RecipesPage

**Files:**
- Modify: `src/pages/RecipesPage.jsx`

Pass `sourceUrl` in the edit form's `initial` prop, and render a "Source ↗" link on recipe cards.

- [ ] **Step 1: Pass sourceUrl to RecipeForm in edit mode**

Find the `<RecipeForm>` in edit mode (line 142–149):

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

Change to:

```jsx
              <RecipeForm
                categories={categories}
                staples={staples}
                stores={stores}
                initial={{ name: recipe.name, categoryId: recipe.category?.id, sourceUrl: recipe.source_url ?? '', ingredients: recipe.ingredients }}
                onSave={handleUpdate}
                onCancel={() => setMode(null)}
              />
```

- [ ] **Step 2: Render the source link on recipe cards**

Find the recipe name + category display section (lines 152–160):

```jsx
                  <div>
                    <span className="font-bold text-soil-shadow">{recipe.name}</span>
                    {recipe.category && (
                      <span className="ml-2 text-xs bg-garden-patch/10 text-garden-patch font-bold px-2 py-0.5 rounded-pill">
                        {recipe.category.name}
                      </span>
                    )}
                  </div>
```

Change to:

```jsx
                  <div>
                    <span className="font-bold text-soil-shadow">{recipe.name}</span>
                    {recipe.category && (
                      <span className="ml-2 text-xs bg-garden-patch/10 text-garden-patch font-bold px-2 py-0.5 rounded-pill">
                        {recipe.category.name}
                      </span>
                    )}
                    {recipe.source_url && (
                      <a
                        href={recipe.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-xs text-stone-grey hover:text-garden-patch transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        Source ↗
                      </a>
                    )}
                  </div>
```

- [ ] **Step 3: Run tests**

```bash
npm test
```

Expected: 39 passed.

- [ ] **Step 4: Commit**

```bash
git add src/pages/RecipesPage.jsx
git commit -m "feat: show source URL link on recipe cards, pass to edit form"
```
