import { useState, useMemo } from 'react'
import { useIngredients } from '../hooks/useIngredients'

/**
 * Props:
 *   stores: Array<{value, label, sort_order}>
 *   onStart: (selectedIngredients: Array<{id, name, store}>) => void
 *   initialSelected: Array<{id, name, store}>
 */
export function PantryInput({ stores, onStart, initialSelected = [] }) {
  const { ingredients, findOrCreate } = useIngredients()
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(initialSelected)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStore, setNewStore] = useState('aldi')
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    if (!search.trim()) return ingredients
    return ingredients.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
  }, [ingredients, search])

  function isSelected(id) {
    return selected.some(s => s.id === id)
  }

  function toggle(ingredient) {
    setSelected(prev =>
      isSelected(ingredient.id)
        ? prev.filter(s => s.id !== ingredient.id)
        : [...prev, ingredient]
    )
  }

  function deselect(id) {
    setSelected(prev => prev.filter(s => s.id !== id))
  }

  async function handleAddNew(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      const id = await findOrCreate(newName.trim(), newStore)
      const ingredient = { id, name: newName.trim(), store: newStore }
      setSelected(prev => [...prev, ingredient])
      setNewName('')
      setNewStore('aldi')
      setAdding(false)
      setSearch('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 2 of 4</p>
      <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow mb-1">Pantry check</h2>
      <p className="text-sm text-stone-grey mb-5">What needs using up this week?</p>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selected.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1 bg-fresh-herb text-soil-shadow text-sm font-bold px-3 py-1 rounded-pill shadow-card">
              {s.name}
              <button onClick={() => deselect(s.id)} className="opacity-70 hover:opacity-100 text-base leading-none ml-1">&times;</button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-grey text-sm">🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ingredients…"
          className="w-full border border-willow-mist rounded-2xl bg-field-cream pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
        />
      </div>

      <div className="bg-field-cream rounded-2xl overflow-hidden mb-5 max-h-64 overflow-y-auto">
        {filtered.length === 0 && !adding && (
          <p className="px-4 py-3 text-sm text-stone-grey">No ingredients found.</p>
        )}
        {filtered.map(ing => (
          <button
            key={ing.id}
            onClick={() => toggle(ing)}
            className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm border-b border-willow-mist last:border-0 transition-colors ${
              isSelected(ing.id) ? 'bg-fresh-herb/20' : 'hover:bg-willow-mist/50'
            }`}
          >
            <div>
              <span className="font-bold text-soil-shadow">{ing.name}</span>
              <span className="text-xs text-stone-grey ml-2">{stores.find(s => s.value === ing.store)?.label}</span>
            </div>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs shrink-0 transition-colors ${
              isSelected(ing.id) ? 'bg-fresh-herb border-fresh-herb text-soil-shadow' : 'border-stone-grey/40'
            }`}>
              {isSelected(ing.id) && '✓'}
            </div>
          </button>
        ))}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-garden-patch font-bold hover:bg-willow-mist/50 transition-colors"
          >
            + Add new ingredient
          </button>
        ) : (
          <form onSubmit={handleAddNew} className="px-4 py-3 flex gap-2 bg-fresh-herb/10">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Ingredient name"
              className="flex-1 border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            />
            <select
              value={newStore}
              onChange={e => setNewStore(e.target.value)}
              className="border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none"
            >
              {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="submit" disabled={saving} className="bg-fresh-herb text-soil-shadow font-bold px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {saving ? '…' : 'Add'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-stone-grey px-2 text-sm">Cancel</button>
          </form>
        )}
      </div>

      <button
        onClick={() => onStart(selected)}
        className="w-full bg-fresh-herb text-soil-shadow font-bold py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
      >
        Let's plan →
      </button>
      <button
        onClick={() => onStart([])}
        className="w-full mt-2 text-stone-grey text-sm hover:text-soil-shadow"
      >
        Skip — nothing to use up
      </button>
    </>
  )
}
