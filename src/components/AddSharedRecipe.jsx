import { useState } from 'react'

const FLAGS = [
  { key: 'isFavorite', label: '♥ Favorite' },
  { key: 'isQuick',    label: '⚡ Quick'    },
  { key: 'isEasy',     label: '✓ Easy'      },
]

/**
 * Bottom sheet for copying someone else's shared recipe into your own list.
 * Ingredients you already have are matched by name; new ones need a store.
 *
 * Props:
 *   recipe:      shared recipe {id, name, user_email, category, ingredients: [{name, store}], is_quick, is_easy}
 *   categories:  your categories [{id, name}]
 *   ingredients: your ingredient catalog [{id, name, store}]
 *   stores:      your stores [{value, label}]
 *   onSave:      ({categoryId, isFavorite, isQuick, isEasy, newIngredientStores: {[name]: store}}) => Promise<void>
 *   onCancel:    () => void
 */
export function AddSharedRecipe({ recipe, categories, ingredients, stores, onSave, onCancel }) {
  const myIngredientNames = new Set(ingredients.map(i => i.name.toLowerCase()))
  const newIngredients = recipe.ingredients.filter(i => !myIngredientNames.has(i.name.toLowerCase()))

  const [categoryId, setCategoryId] = useState(
    () => categories.find(c => c.name.toLowerCase() === recipe.category?.name?.toLowerCase())?.id ?? ''
  )
  const [flags, setFlags] = useState({ isFavorite: false, isQuick: recipe.is_quick, isEasy: recipe.is_easy })
  // Default each new ingredient to your store with the same value as the sharer's, else your first store
  const [newIngredientStores, setNewIngredientStores] = useState(() =>
    Object.fromEntries(newIngredients.map(i => [
      i.name,
      stores.some(s => s.value === i.store) ? i.store : (stores[0]?.value ?? ''),
    ]))
  )
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({ categoryId: categoryId || null, ...flags, newIngredientStores })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="bg-grain-sand rounded-t-3xl sm:rounded-3xl shadow-card w-full sm:max-w-sm flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-willow-mist rounded-full" />
        </div>

        <div className="overflow-y-auto px-5 pt-4 pb-5 space-y-4">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-stone-grey break-all">
              Add to my recipes · from {recipe.user_email}
            </p>
            <p className="font-display text-xl text-soil-shadow uppercase mt-1">{recipe.name}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold tracking-widest uppercase text-stone-grey">Category</p>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            >
              <option value="">No category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-bold tracking-widest uppercase text-stone-grey">Tags</p>
            <div className="flex gap-2">
              {FLAGS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFlags(f => ({ ...f, [key]: !f[key] }))}
                  className={`flex-1 border-2 rounded-2xl py-2 text-sm font-bold transition-colors ${
                    flags[key]
                      ? 'border-garden-patch bg-garden-patch/10 text-garden-patch'
                      : 'border-willow-mist text-stone-grey hover:border-garden-patch/40 hover:text-soil-shadow'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {recipe.ingredients.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-bold tracking-widest uppercase text-stone-grey">
                Ingredients · {recipe.ingredients.length - newIngredients.length} matched, {newIngredients.length} new
              </p>
              <div className="divide-y divide-willow-mist">
                {recipe.ingredients.map(ing => {
                  const isNew = !myIngredientNames.has(ing.name.toLowerCase())
                  return (
                    <div key={ing.id} className="flex items-center justify-between gap-2 py-2">
                      <span className="text-sm font-bold text-soil-shadow uppercase">
                        {ing.name}
                        {isNew && <span className="ml-1.5 text-[10px] bg-fresh-herb/50 rounded px-1 py-0.5">NEW</span>}
                      </span>
                      {isNew ? (
                        <select
                          value={newIngredientStores[ing.name]}
                          onChange={e => setNewIngredientStores(s => ({ ...s, [ing.name]: e.target.value }))}
                          aria-label={`Store for ${ing.name}`}
                          className="border border-willow-mist rounded-xl bg-field-cream px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                        >
                          {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      ) : (
                        <span className="text-xs font-bold text-garden-patch whitespace-nowrap">✓ In your catalog</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-garden-patch text-field-cream rounded-2xl py-3.5 text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {saving ? 'Adding…' : 'Add to my recipes'}
          </button>
          <button onClick={onCancel} className="w-full py-1 text-sm text-stone-grey hover:text-soil-shadow">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
