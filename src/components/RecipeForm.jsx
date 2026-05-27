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
export function RecipeForm({ categories, staples = [], initial, onSave, onAddExtra = () => Promise.resolve(), onCancel }) {
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

            // Snapshot membership before findOrCreate mutates the ingredients list
            const normalised = r.name.trim().toLowerCase()
            const inIngredients = allIngredients.some(i => i.name.toLowerCase() === normalised)
            const inStaples = staples.some(s => s.name.toLowerCase() === normalised)

            // Path 2 & 3: find-or-create in ingredients table
            const id = await findOrCreate(r.name.trim(), r.store)

            // Path 3 only: add to extras if brand new (not in ingredients or staples)
            if (!r.fromStaple && !inIngredients && !inStaples) {
              try { await onAddExtra(r.name.trim(), r.store) } catch { /* non-critical */ }
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
