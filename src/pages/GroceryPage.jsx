import { useState, useMemo } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useIngredients } from '../hooks/useIngredients'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { useStores } from '../hooks/useStores'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { GroceryList } from '../components/GroceryList'
import { STORES } from '../utils/stores'

export default function GroceryPage() {
  const { recipes, loading: recipesLoading } = useRecipes()
  const { staples, loading: staplesLoading } = useStaples()
  const { ingredients, loading: ingredientsLoading, findOrCreate } = useIngredients()
  const { plan, planCreatedAt, loading: planLoading, updatePlan, resetPlan } = useWeekPlan()
  const { stores, loading: storesLoading } = useStores()

  const [query, setQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newItemStore, setNewItemStore] = useState('aldi')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const { slots, selectedStapleIds, addedIngredientIds } = plan

  const resolvedStapleIds = useMemo(
    () => resolveSelectedStaples(selectedStapleIds, staples, planCreatedAt),
    [selectedStapleIds, staples, planCreatedAt]
  )
  const selectedStaples = staples.filter(s => resolvedStapleIds.includes(s.id))
  const addedIngredients = ingredients.filter(i => addedIngredientIds.includes(i.id))

  // Search: combine ingredients + staples, filter by query, exclude already-added items
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const seen = new Set()
    const ingredientHits = ingredients
      .filter(i => i.name.toLowerCase().includes(q) && !addedIngredientIds.includes(i.id))
      .map(i => ({ ...i, isStaple: false }))
    const stapleHits = staples
      .filter(s => s.name.toLowerCase().includes(q) && !resolvedStapleIds.includes(s.id))
      .map(s => ({ ...s, isStaple: true }))
    return [...ingredientHits, ...stapleHits]
      .filter(r => { if (seen.has(r.name.toLowerCase())) return false; seen.add(r.name.toLowerCase()); return true })
      .slice(0, 8)
  }, [query, ingredients, staples, addedIngredientIds, resolvedStapleIds])

  const hasExactMatch = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return false
    return ingredients.some(i => i.name.toLowerCase() === q) || staples.some(s => s.name.toLowerCase() === q)
  }, [query, ingredients, staples])

  function handleAddExisting(item) {
    if (item.isStaple) {
      if (!resolvedStapleIds.includes(item.id)) {
        updatePlan({ selectedStapleIds: [...resolvedStapleIds, item.id] })
      }
    } else {
      if (!addedIngredientIds.includes(item.id)) {
        updatePlan({ addedIngredientIds: [...addedIngredientIds, item.id] })
      }
    }
    setQuery('')
    setShowDropdown(false)
    setAddingNew(false)
  }

  async function handleAddNew() {
    if (!query.trim()) return
    setSaving(true)
    setSaveError(false)
    try {
      const id = await findOrCreate(query.trim(), newItemStore)
      updatePlan({ addedIngredientIds: [...addedIngredientIds, id] })
      setQuery('')
      setNewItemStore('aldi')
      setAddingNew(false)
      setShowDropdown(false)
    } catch {
      setSaveError(true)
    } finally {
      setSaving(false)
    }
  }

  function handleRemoveAdded(id) {
    updatePlan({ addedIngredientIds: addedIngredientIds.filter(x => x !== id) })
  }

  function handleRemoveStaple(id) {
    updatePlan({ selectedStapleIds: resolvedStapleIds.filter(x => x !== id) })
  }

  const loading = recipesLoading || staplesLoading || ingredientsLoading || planLoading || storesLoading

  if (loading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6">
      <div className="bg-willow-mist rounded-card shadow-card overflow-hidden">

        {/* Header */}
        <div className="px-4 py-4 sm:px-6 sm:py-5 border-b border-willow-mist flex items-center justify-between gap-4">
          <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">Grocery List</h1>
          <button
            type="button"
            onClick={resetPlan}
            className="text-xs text-stone-grey hover:text-soil-shadow font-bold transition-colors shrink-0"
          >
            ↺ Start over
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-willow-mist">
          <div className="relative">
            <input
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                setShowDropdown(true)
                setAddingNew(false)
                setSaveError(false)
              }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              onKeyDown={e => { if (e.key === 'Escape') { setShowDropdown(false); setAddingNew(false) } }}
              placeholder="Search to add an item…"
              className="w-full border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            />

            {showDropdown && query.trim() && (searchResults.length > 0 || !hasExactMatch) && (
              <div className="absolute left-0 right-0 border border-willow-mist border-t-0 rounded-b-xl bg-field-cream z-10 overflow-hidden shadow-card">
                {searchResults.map(item => (
                  <button
                    key={item.id}
                    onMouseDown={() => handleAddExisting(item)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:bg-willow-mist/50 border-b border-willow-mist last:border-0"
                  >
                    <span>
                      <span className="font-bold text-soil-shadow">{item.name}</span>
                      <span className="text-stone-grey ml-2 text-xs">
                        · {STORES.find(s => s.value === item.store)?.label}
                      </span>
                      {item.isStaple && (
                        <span className="ml-2 text-xs bg-willow-mist text-garden-patch px-1.5 py-0.5 rounded-full">staple</span>
                      )}
                    </span>
                    <span className="text-garden-patch text-xs font-bold shrink-0 ml-2">+ Add</span>
                  </button>
                ))}

                {!hasExactMatch && (
                  <button
                    onMouseDown={() => { setAddingNew(true); setShowDropdown(false) }}
                    className="w-full px-3 py-2.5 text-sm text-left text-garden-patch font-bold hover:bg-willow-mist/50 border-t border-willow-mist first:border-t-0"
                  >
                    ✚ Add "{query.trim()}" as new ingredient…
                  </button>
                )}
              </div>
            )}
          </div>

          {/* New-item form — lives outside the dropdown so blur can't kill it */}
          {addingNew && (
            <div className="mt-2 flex gap-2 items-center bg-fresh-herb/10 rounded-xl px-3 py-2.5 flex-wrap">
              <span className="text-sm font-bold text-soil-shadow flex-1 min-w-0 truncate">"{query.trim()}"</span>
              <select
                value={newItemStore}
                onChange={e => setNewItemStore(e.target.value)}
                className="border border-willow-mist rounded-lg px-2 py-1 text-sm bg-field-cream focus:outline-none"
              >
                {STORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button
                onClick={handleAddNew}
                disabled={saving}
                className="bg-fresh-herb text-soil-shadow font-bold px-3 py-1 rounded-lg text-sm disabled:opacity-50"
              >
                {saving ? '…' : 'Add'}
              </button>
              <button
                onClick={() => setAddingNew(false)}
                className="text-stone-grey text-sm px-1"
              >
                Cancel
              </button>
              {saveError && <span className="text-red-500 text-xs w-full">Failed to save — try again</span>}
            </div>
          )}
        </div>

        {/* List */}
        <GroceryList
          slots={slots}
          recipes={recipes}
          staples={selectedStaples}
          addedIngredients={addedIngredients}
          stores={stores}
          onRemoveAdded={handleRemoveAdded}
          onRemoveStaple={handleRemoveStaple}
        />

      </div>
    </div>
  )
}
