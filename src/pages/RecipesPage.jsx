import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useRecipes } from '../hooks/useRecipes'
import { useSharedRecipes } from '../hooks/useSharedRecipes'
import { useIngredients } from '../hooks/useIngredients'
import { useStaples } from '../hooks/useStaples'
import { useStores } from '../hooks/useStores'
import { RecipeForm } from '../components/RecipeForm'
import { RecipeImport } from '../components/RecipeImport'
import { AddSharedRecipe } from '../components/AddSharedRecipe'
import { useToast, Toast } from '../components/Toast'

const FLAG_FILTERS = [
  { flag: 'favorite', field: 'is_favorite', label: '♥ Favorite' },
  { flag: 'quick',    field: 'is_quick',    label: '⚡ Quick'    },
  { flag: 'easy',     field: 'is_easy',     label: '✓ Easy'      },
]

const HIDE_HAVE_KEY = 'dinner_planner_hide_have'

export default function RecipesPage() {
  const { email } = useAuth()
  const { recipes, categories, loading, addRecipe, updateRecipe, deleteRecipe, toggleFlag } = useRecipes()
  const { sharedRecipes, loading: sharedLoading, refresh: refreshShared } = useSharedRecipes()
  const { ingredients, findOrCreate } = useIngredients()
  const { staples, loading: staplesLoading } = useStaples()
  const { stores, loading: storesLoading } = useStores()
  const { toast, showToast, dismissToast } = useToast()
  const [mode, setMode] = useState(null) // null | 'add' | 'import' | {edit: recipe}
  const [view, setView] = useState('mine') // 'mine' | 'everyone'
  const [filterCategory, setFilterCategory] = useState('all')
  const [activeFlags, setActiveFlags] = useState(new Set())
  const [search, setSearch] = useState('')
  const [hideHave, setHideHave] = useState(() => localStorage.getItem(HIDE_HAVE_KEY) === 'true')
  const [adding, setAdding] = useState(null) // shared recipe being copied

  function toggleFlagFilter(flag) {
    setActiveFlags(prev => {
      const next = new Set(prev)
      next.has(flag) ? next.delete(flag) : next.add(flag)
      return next
    })
  }

  function switchView(next) {
    setView(next)
    setMode(null)
    setFilterCategory('all')
    if (next === 'everyone') refreshShared()
  }

  function toggleHideHave() {
    setHideHave(prev => {
      localStorage.setItem(HIDE_HAVE_KEY, String(!prev))
      return !prev
    })
  }

  const query = search.trim().toLowerCase()

  const matchesSearch = r => !query
    || r.name.toLowerCase().includes(query)
    || r.ingredients.some(i => i.name.toLowerCase().includes(query))

  const matchesFlags = r => FLAG_FILTERS.every(({ flag, field }) => !activeFlags.has(flag) || r[field])

  const myBase = recipes
    .filter(matchesSearch)
    .filter(r => filterCategory === 'all' || r.category?.id === filterCategory)
  const displayed = myBase.filter(matchesFlags)

  // Why a shared recipe counts as one you already have, or null if it doesn't
  const myRecipeNames = new Set(recipes.map(r => r.name.trim().toLowerCase()))
  function haveReason(r) {
    if (r.user_email === email) return 'yours'
    if (recipes.some(m => m.copied_from_recipe_id === r.id)) return 'added'
    if (myRecipeNames.has(r.name.trim().toLowerCase())) return 'same'
    return null
  }

  const haveCount = sharedRecipes.filter(haveReason).length
  const everyonePool = hideHave ? sharedRecipes.filter(r => !haveReason(r)) : sharedRecipes
  const everyoneBase = everyonePool.filter(matchesSearch)
  const everyoneDisplayed = everyoneBase.filter(matchesFlags)

  const flagBase = view === 'mine' ? myBase : everyoneBase
  const flagCount = field => flagBase.filter(r => r[field]).length

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

  async function handleRemoveIngredient(recipe, ingredientId) {
    try {
      await updateRecipe(recipe.id, {
        name: recipe.name,
        categoryId: recipe.category?.id ?? null,
        ingredientIds: recipe.ingredients.filter(i => i.id !== ingredientId).map(i => i.id),
        sourceUrl: recipe.source_url ?? null,
        isFavorite: recipe.is_favorite,
        isQuick: recipe.is_quick,
        isEasy: recipe.is_easy,
      })
    } catch {
      showToast("Couldn't remove ingredient, try again")
    }
  }

  async function handleToggleShare(recipe) {
    try {
      await toggleFlag(recipe.id, 'is_shared', !recipe.is_shared)
      refreshShared()
    } catch {
      showToast("Couldn't change sharing, try again")
    }
  }

  async function handleAddShared({ categoryId, isFavorite, isQuick, isEasy, newIngredientStores }) {
    try {
      const ingredientIds = []
      for (const ing of adding.ingredients) {
        const id = await findOrCreate(ing.name, newIngredientStores[ing.name] ?? ing.store)
        if (!ingredientIds.includes(id)) ingredientIds.push(id)
      }
      await addRecipe({
        name: adding.name,
        categoryId,
        ingredientIds,
        sourceUrl: adding.source_url ?? null,
        isFavorite,
        isQuick,
        isEasy,
        copiedFromRecipeId: adding.id,
        copiedFromEmail: adding.user_email,
      })
      showToast(`Added ${adding.name} to your recipes`, 'success')
      setAdding(null)
      refreshShared()
    } catch {
      showToast("Couldn't add recipe, try again")
    }
  }

  if (loading || staplesLoading || storesLoading) return <div className="p-3 sm:p-6 text-stone-grey">Loading…</div>

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display font-light text-3xl text-soil-shadow">Recipes</h1>
        {mode === null && view === 'mine' && (
          <div className="flex gap-2">
            <button
              onClick={() => setMode('import')}
              className="border border-garden-patch text-garden-patch font-bold px-4 py-2.5 rounded-pill hover:bg-garden-patch/10 transition-colors text-sm"
            >
              ↓ Import from URL
            </button>
            <button
              onClick={() => setMode('add')}
              className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm"
            >
              + Add Recipe
            </button>
          </div>
        )}
      </div>

      {/* Mine / Everyone switch */}
      <div className="flex bg-willow-mist rounded-pill p-1 mb-3">
        {[
          { value: 'mine',     label: 'Mine',     count: recipes.length },
          { value: 'everyone', label: 'Everyone', count: everyonePool.length },
        ].map(v => (
          <button
            key={v.value}
            onClick={() => switchView(v.value)}
            className={`flex-1 rounded-pill py-2 text-sm font-bold transition-colors ${
              view === v.value
                ? 'bg-field-cream text-garden-patch shadow-card'
                : 'text-stone-grey hover:text-soil-shadow'
            }`}
          >
            {v.label} <span className="font-normal opacity-70">{v.count}</span>
          </button>
        ))}
      </div>

      {/* Import from URL */}
      {mode === 'import' && (
        <RecipeImport
          categories={categories}
          staples={staples}
          stores={stores}
          addRecipe={addRecipe}
          onDone={() => setMode(null)}
          onCancel={() => setMode(null)}
        />
      )}

      {/* Manual add form */}
      {mode === 'add' && (
        <div className="bg-willow-mist rounded-card p-5 mb-6 shadow-card">
          <h2 className="font-bold text-soil-shadow mb-4">New Recipe</h2>
          <RecipeForm
            categories={categories}
            staples={staples}
            stores={stores}
            initial={null}
            onSave={handleAdd}
            onCancel={() => setMode(null)}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative mb-3">
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={view === 'mine' ? 'Search recipes or ingredients…' : "Search everyone's recipes…"}
          className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb [&::-webkit-search-cancel-button]:hidden"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-grey hover:text-soil-shadow text-lg leading-none p-1"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>

      {/* Flag filters */}
      <div className="flex gap-2 mb-3">
        {FLAG_FILTERS.map(({ flag, field, label }) => (
          <button
            key={flag}
            onClick={() => toggleFlagFilter(flag)}
            className={`flex-1 border-2 rounded-2xl py-2 text-sm font-bold transition-colors ${
              activeFlags.has(flag)
                ? 'border-garden-patch bg-garden-patch/10 text-garden-patch'
                : 'border-willow-mist text-stone-grey hover:border-garden-patch/40 hover:text-soil-shadow'
            }`}
          >
            {label} <span className="font-normal opacity-70">{flagCount(field)}</span>
          </button>
        ))}
      </div>

      {view === 'everyone' ? (
        <>
          {/* Hide recipes already in your list */}
          <div className="flex items-center justify-between gap-3 px-1 mb-5">
            <span className="text-sm font-bold text-stone-grey">
              Hide recipes I already have
              {!hideHave && haveCount > 0 && <span className="font-normal"> ({haveCount})</span>}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={hideHave}
              aria-label="Hide recipes I already have"
              onClick={toggleHideHave}
              className={`relative w-10 h-6 rounded-full shrink-0 transition-colors ${hideHave ? 'bg-garden-patch' : 'bg-stone-grey/40'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-field-cream transition-transform ${hideHave ? 'translate-x-4' : ''}`} />
            </button>
          </div>

          {/* Shared recipe list */}
          {sharedLoading && sharedRecipes.length === 0 && (
            <p className="text-center py-16 text-stone-grey">Loading…</p>
          )}
          {!sharedLoading && everyoneDisplayed.length === 0 && (
            <div className="text-center py-16 text-stone-grey">
              <p className="text-4xl mb-3">🌍</p>
              <p>
                {sharedRecipes.length === 0
                  ? 'Nobody has shared a recipe yet. Switch on Share on one of yours to be the first.'
                  : query ? `No shared recipes match "${search.trim()}".` : 'No shared recipes match the active filters.'}
              </p>
            </div>
          )}
          <ul className="space-y-3">
            {everyoneDisplayed.map(recipe => {
              const reason = haveReason(recipe)
              return (
                <li key={recipe.id} className="bg-willow-mist rounded-card px-5 py-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-bold text-soil-shadow uppercase">{recipe.name}</span>
                      {recipe.category && (
                        <span className="text-xs bg-garden-patch/10 text-garden-patch font-bold px-2 py-0.5 rounded-pill uppercase">
                          {recipe.category.name}
                        </span>
                      )}
                      {recipe.is_favorite && (
                        <span className="text-xs bg-garden-patch text-fresh-herb font-bold px-2 py-0.5 rounded-pill">♥</span>
                      )}
                      {recipe.is_quick && (
                        <span className="text-xs bg-field-cream text-stone-grey font-bold px-2 py-0.5 rounded-pill">⚡ Quick</span>
                      )}
                      {recipe.is_easy && (
                        <span className="text-xs bg-field-cream text-stone-grey font-bold px-2 py-0.5 rounded-pill">✓ Easy</span>
                      )}
                      {recipe.source_url && (
                        <a
                          href={recipe.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-stone-grey hover:text-garden-patch transition-colors"
                        >
                          Source ↗
                        </a>
                      )}
                    </div>
                    {reason === 'yours' ? (
                      <span className="text-sm text-stone-grey shrink-0">Yours</span>
                    ) : reason === 'added' ? (
                      <span className="text-sm font-bold text-garden-patch shrink-0">✓ Added</span>
                    ) : reason === 'same' ? (
                      <span className="text-sm text-stone-grey shrink-0">✓ In your list</span>
                    ) : (
                      <button
                        onClick={() => setAdding(recipe)}
                        className="bg-fresh-herb text-soil-shadow font-bold px-4 py-1.5 rounded-pill text-sm hover:opacity-90 transition-opacity shrink-0"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                  {recipe.ingredients.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {recipe.ingredients.map(ing => (
                        <span
                          key={ing.id}
                          className="text-xs bg-field-cream text-stone-grey px-2.5 py-0.5 rounded-pill font-bold uppercase"
                        >
                          {ing.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 pt-2 border-t border-field-cream flex items-center justify-between gap-3 text-xs text-stone-grey">
                    <span className="break-all">{reason === 'yours' ? 'Shared by you' : recipe.user_email}</span>
                    {recipe.saves > 0 && <span className="shrink-0">saved by {recipe.saves}</span>}
                  </div>
                </li>
              )
            })}
          </ul>

          {adding && (
            <AddSharedRecipe
              recipe={adding}
              categories={categories}
              ingredients={ingredients}
              stores={stores}
              onSave={handleAddShared}
              onCancel={() => setAdding(null)}
            />
          )}
        </>
      ) : (
      <>
      {/* Category filter */}
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
      </div>

      {/* Recipe list */}
      {displayed.length === 0 && (
        <div className="text-center py-16 text-stone-grey">
          <p className="text-4xl mb-3">🍳</p>
          <p>{recipes.length === 0 ? 'No recipes yet. Add your first one!' : query ? `No recipes match "${search.trim()}".` : 'No recipes match the active filters.'}</p>
        </div>
      )}

      <ul className="space-y-3">
        {displayed.map(recipe => (
          <li key={recipe.id} className="bg-willow-mist rounded-card px-5 py-4 shadow-card">
            {mode?.edit?.id === recipe.id ? (
              <RecipeForm
                categories={categories}
                staples={staples}
                stores={stores}
                initial={{
                  name: recipe.name,
                  categoryId: recipe.category?.id,
                  sourceUrl: recipe.source_url ?? '',
                  ingredients: recipe.ingredients,
                  isFavorite: recipe.is_favorite,
                  isQuick: recipe.is_quick,
                  isEasy: recipe.is_easy,
                }}
                onSave={handleUpdate}
                onCancel={() => setMode(null)}
              />
            ) : (
              <div>
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
                {recipe.ingredients.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {recipe.ingredients.map(ing => (
                      <span
                        key={ing.id}
                        className="inline-flex items-center gap-1 text-xs bg-field-cream text-stone-grey px-2.5 py-0.5 rounded-pill font-bold uppercase"
                      >
                        {ing.name}
                        <span className="text-stone-grey/60">· {stores.find(s => s.value === ing.store)?.label}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveIngredient(recipe, ing.id)}
                          className="text-stone-grey/50 hover:text-red-500 leading-none transition-colors p-1 -m-1"
                          aria-label={`Remove ${ing.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 pt-2 border-t border-field-cream flex items-center justify-between gap-3 text-xs text-stone-grey">
                  {recipe.copied_from_email ? (
                    <span className="break-all">From {recipe.copied_from_email}</span>
                  ) : (
                    <>
                      <span>{recipe.is_shared ? 'Shared with everyone' : 'Only you can see this'}</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={recipe.is_shared}
                        aria-label={`Share ${recipe.name} with everyone`}
                        onClick={() => handleToggleShare(recipe)}
                        className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${recipe.is_shared ? 'bg-garden-patch' : 'bg-stone-grey/40'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-field-cream transition-transform ${recipe.is_shared ? 'translate-x-4' : ''}`} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      </>
      )}
    </div>
  )
}
