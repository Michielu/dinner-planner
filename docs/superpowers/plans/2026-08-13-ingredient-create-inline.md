# Inline Ingredient Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create a new ingredient directly from the Day Detail ingredient picker when their search term doesn't match any existing ingredient.

**Architecture:** Three focused changes — DayDetail gets new props (`stores`, `onCreateIngredient`) and an expand-in-place create row; PlannerPage passes those props down; the throwaway prototype files are deleted.

**Tech Stack:** React 18, Vite, Tailwind CSS, Supabase (via existing `useIngredients` hook)

## Global Constraints

- Plain JSX — no TypeScript
- Tailwind CSS only — no inline styles, no new CSS files
- No new dependencies
- Use existing design tokens: `bg-garden-patch`, `text-fresh-herb`, `bg-willow-mist`, `text-soil-shadow`, `text-stone-grey`, `border-willow-mist`, `bg-field-cream`, `rounded-2xl`, `font-bold`, `text-sm`, `tracking-widest`, `uppercase`

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/components/DayDetail.jsx` | Modify | New props `stores`, `onCreateIngredient`; new state `expanded`, `createStore`; create row UI in ingredient picker panel |
| `src/pages/PlannerPage.jsx` | Modify | Destructure `findOrCreate` from `useIngredients`; pass `stores` and `onCreateIngredient` to `<DayDetail>` |
| `src/pages/PrototypeIngredientCreate.jsx` | Delete | Throwaway prototype |
| `src/App.jsx` | Modify | Remove prototype import and route |

---

## Task 1: Update DayDetail with create row

**Files:**
- Modify: `src/components/DayDetail.jsx`

**Interfaces:**
- Consumes: `stores: Array<{value: string, label: string}>` (new prop), `onCreateIngredient: async (name: string, store: string) => string` (new prop, returns new ingredient `id`)
- Produces: nothing consumed by later tasks

No utility logic is added — all changes are state and rendering inside DayDetail. No unit test applies; verify in the browser after Task 2.

- [ ] **Step 1: Add `stores` and `onCreateIngredient` to the component signature**

In `src/components/DayDetail.jsx`, line 16, update the prop destructure:

```jsx
export function DayDetail({ day, slots, recipes, categories, pantryItems, onAdd, onRemove, onClose, ingredients = [], stores = [], onCreateIngredient }) {
```

- [ ] **Step 2: Add `expanded` and `createStore` state**

After the existing `useState` declarations (after line 21), add:

```jsx
const [expanded, setExpanded] = useState(false)
const [createStore, setCreateStore] = useState(() => stores[0]?.value ?? '')
```

- [ ] **Step 3: Reset new state in `resetPicker`**

In the `resetPicker` function (currently lines 68–74), add resets for the new state:

```jsx
function resetPicker() {
  setMode(null)
  setSearch('')
  setIngSearch('')
  setFilterCategory('all')
  setActiveFlags(new Set())
  setExpanded(false)
  setCreateStore(stores[0]?.value ?? '')
}
```

- [ ] **Step 4: Derive `showCreate` flag**

After the `filteredIngredients` declaration (currently line 64), add:

```jsx
const showCreate = ingSearch.trim().length > 0 &&
  !ingredients.some(i => i.name.toLowerCase() === ingSearch.trim().toLowerCase())
```

- [ ] **Step 5: Add `handleCreateIngredient` function**

After `handlePickIngredient` (after line 80), add:

```jsx
async function handleCreateIngredient() {
  const name = ingSearch.trim()
  const id = await onCreateIngredient(name, createStore)
  onAdd({ type: 'pinned_ingredient', ingredient: { id, name, store: createStore } })
  resetPicker()
}
```

- [ ] **Step 6: Replace the ingredient picker panel JSX**

In the ingredient picker branch (currently lines 273–302, the `else` block after `mode === 'meal'`), replace the entire contents with the new version that includes the create row:

```jsx
        ) : (
          <>
            <div className="px-4 pt-3 pb-2">
              <input value={ingSearch} onChange={e => { setIngSearch(e.target.value); setExpanded(false) }}
                placeholder="Search ingredients…"
                autoFocus
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
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

              {showCreate && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-garden-patch/40 text-garden-patch hover:border-garden-patch hover:bg-garden-patch/5 transition-colors"
                >
                  <span className="text-lg leading-none">+</span>
                  <span className="text-sm font-bold">Create &ldquo;{ingSearch.trim()}&rdquo;</span>
                </button>
              )}

              {showCreate && expanded && (
                <div className="rounded-2xl border-2 border-garden-patch/50 bg-garden-patch/5 px-4 py-3 space-y-3">
                  <p className="text-sm font-bold text-soil-shadow">
                    + Create &ldquo;{ingSearch.trim()}&rdquo;
                  </p>
                  <div className="flex gap-2 items-center">
                    <select
                      value={createStore}
                      onChange={e => setCreateStore(e.target.value)}
                      className="flex-1 border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                    >
                      {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button
                      onClick={handleCreateIngredient}
                      className="bg-garden-patch text-fresh-herb font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90 transition-opacity"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setExpanded(false)}
                      className="text-stone-grey hover:text-soil-shadow text-sm px-2 py-2 leading-none"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {filteredIngredients.length === 0 && !showCreate && (
                <p className="text-center text-stone-grey text-sm py-6">No ingredients found.</p>
              )}
            </div>
          </>
        )}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/DayDetail.jsx
git commit -m "feat: add inline ingredient create row to day detail picker"
```

---

## Task 2: Wire PlannerPage to pass new props

**Files:**
- Modify: `src/pages/PlannerPage.jsx`

**Interfaces:**
- Consumes: `findOrCreate` from `useIngredients` (already returned by the hook, just not destructured); `stores` from `useStores` (already fetched, just not passed to DayDetail)
- Produces: nothing consumed by later tasks

- [ ] **Step 1: Destructure `findOrCreate` from `useIngredients`**

In `PlannerPage.jsx` line 21, update the destructure:

```jsx
const { ingredients, loading: ingredientsLoading, findOrCreate } = useIngredients()
```

- [ ] **Step 2: Add `onCreateIngredient` handler**

After the `handleDetailRemove` function (after line 73), add:

```jsx
async function handleCreateIngredient(name, store) {
  return findOrCreate(name, store)
}
```

- [ ] **Step 3: Pass `stores` and `onCreateIngredient` to DayDetail**

Find the `<DayDetail>` JSX block (lines 86–97) and add the two new props:

```jsx
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
          stores={stores}
          onCreateIngredient={handleCreateIngredient}
        />
```

- [ ] **Step 4: Verify in the browser**

Start the dev server (`npm run dev`) and navigate to `http://localhost:5173`.

Open any day, tap **+ Add ingredient**, type a name that doesn't exist (e.g. "dragon fruit"). Confirm:
- The dashed "+ Create 'dragon fruit'" row appears at the bottom
- Tapping it expands a store dropdown + **Add** button + **✕** dismiss
- Tapping **Add** closes the picker and the new ingredient appears as a pill in "Grocery additions"
- Tapping the day again confirms the ingredient is pinned
- Typing a name that exactly matches an existing ingredient (case-insensitive) hides the create row

- [ ] **Step 5: Commit**

```bash
git add src/pages/PlannerPage.jsx
git commit -m "feat: wire findOrCreate and stores into DayDetail for inline ingredient creation"
```

---

## Task 3: Delete prototype files

**Files:**
- Delete: `src/pages/PrototypeIngredientCreate.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Delete the prototype page file**

```bash
rm src/pages/PrototypeIngredientCreate.jsx
```

- [ ] **Step 2: Remove prototype import and route from App.jsx**

In `src/App.jsx`, remove the import line:

```jsx
import PrototypeIngredientCreate from './pages/PrototypeIngredientCreate'
```

And remove the route line:

```jsx
          {import.meta.env.DEV && <Route path="/prototype/ingredient-create" element={<PrototypeIngredientCreate />} />}
```

- [ ] **Step 3: Confirm dev server still compiles**

```bash
npm run dev
```

Confirm no import errors in the terminal.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "chore: delete ingredient create prototype"
```
