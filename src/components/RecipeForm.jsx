import { useState } from 'react'
import { IngredientRow } from './IngredientAutocomplete'
import { useIngredients } from '../hooks/useIngredients'

/**
 * Props:
 *   categories: Array<{id, name}>
 *   initial: {name, categoryId, ingredients: [{name, store, id}]} | null
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
        {ingredientRows.map((row, i) => (
          <IngredientRow
            key={i}
            allIngredients={allIngredients}
            value={row}
            onChange={v => updateRow(i, v)}
            onRemove={() => removeRow(i)}
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
