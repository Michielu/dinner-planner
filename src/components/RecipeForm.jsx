import { useState } from 'react'
import { IngredientRow } from './IngredientAutocomplete'
import { useIngredients } from '../hooks/useIngredients'

/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store, notes}>
 *   stores: Array<{value, label, sort_order}>
 *   initial: {name, categoryId, sourceUrl, ingredients: [{name, store, id}]} | null
 *   onSave: ({name, categoryId, ingredientIds: string[], sourceUrl: string|null}) => Promise<void>
 *   onCancel: () => void
 */
export function RecipeForm({ categories, staples = [], stores, initial, onSave, onCancel }) {
  const { ingredients: allIngredients, findOrCreate } = useIngredients()
  const [name, setName] = useState(initial?.name ?? '')
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '')
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
      { _key: key, name: '', store: stores[0]?.value ?? 'aldi', existingId: null, fromStaple: false },
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
            return id
          })
      )
      await onSave({ name: name.trim(), categoryId: categoryId || null, ingredientIds, sourceUrl: sourceUrl.trim() || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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

      {/* Ingredients */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-stone-grey uppercase tracking-widest">Ingredients</p>
        {ingredientRows.map(row => (
          <IngredientRow
            key={row._key}
            allIngredients={allIngredients}
            staples={staples}
            stores={stores}
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
