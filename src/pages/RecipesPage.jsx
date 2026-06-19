import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useStores } from '../hooks/useStores'
import { RecipeForm } from '../components/RecipeForm'
import { RecipeImport } from '../components/RecipeImport'
import { useToast, Toast } from '../components/Toast'

export default function RecipesPage() {
  const { recipes, categories, loading, addRecipe, updateRecipe, deleteRecipe } = useRecipes()
  const { staples, loading: staplesLoading } = useStaples()
  const { stores, loading: storesLoading } = useStores()
  const { toast, showToast, dismissToast } = useToast()
  const [mode, setMode] = useState(null) // null | 'add' | 'import' | {edit: recipe}
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

  async function handleRemoveIngredient(recipe, ingredientId) {
    try {
      await updateRecipe(recipe.id, {
        name: recipe.name,
        categoryId: recipe.category?.id ?? null,
        ingredientIds: recipe.ingredients.filter(i => i.id !== ingredientId).map(i => i.id),
        sourceUrl: recipe.source_url ?? null,
      })
    } catch {
      showToast("Couldn't remove ingredient, try again")
    }
  }

  if (loading || staplesLoading || storesLoading) return <div className="p-3 sm:p-6 text-stone-grey">Loading…</div>

  return (
    <div className="p-3 sm:p-6 max-w-3xl mx-auto">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={dismissToast} />}

      <div className="flex items-center justify-between mb-5">
        <h1 className="font-display font-light text-3xl text-soil-shadow">Recipes</h1>
        {mode === null && (
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
                stores={stores}
                initial={{ name: recipe.name, categoryId: recipe.category?.id, sourceUrl: recipe.source_url ?? '', ingredients: recipe.ingredients }}
                onSave={handleUpdate}
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
                        className="inline-flex items-center gap-1 text-xs bg-field-cream text-stone-grey px-2.5 py-0.5 rounded-pill font-bold"
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
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
