import { useState } from 'react'
import { generateGroceryList } from '../utils/groceryList'
import { STORES } from '../utils/stores'

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 *   extras: Array<{id, name, store}>
 *   onAddExtra: (name: string, store: string) => Promise<void>
 *   onRemoveExtra: (id: string) => Promise<void>
 */
export function GroceryList({ slots, recipes, staples, extras = [], onAddExtra, onRemoveExtra }) {
  const [copyStatus, setCopyStatus] = useState(null) // null | 'copied' | 'error'
  const [addingExtra, setAddingExtra] = useState(false)
  const [newExtraName, setNewExtraName] = useState('')
  const [newExtraStore, setNewExtraStore] = useState('aldi')

  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples, extras)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  // Staple columns — stores that have at least one staple
  const stapleColumns = STORES
    .map(s => ({ store: s, items: (list[s.value] ?? []).filter(i => i.isStaple) }))
    .filter(col => col.items.length > 0)

  // Extra columns — stores that have at least one non-staple item
  const extraColumns = STORES
    .map(s => ({ store: s, items: (list[s.value] ?? []).filter(i => !i.isStaple) }))
    .filter(col => col.items.length > 0)

  async function handleAddExtra() {
    if (!newExtraName.trim()) return
    try {
      await onAddExtra(newExtraName.trim(), newExtraStore)
      setNewExtraName('')
      setNewExtraStore('aldi')
      setAddingExtra(false)
    } catch {
      // Supabase error — form stays open so user can retry
    }
  }

  async function copyList() {
    const lines = []
    if (stapleColumns.length > 0) {
      lines.push('Staples')
      for (const { store, items } of stapleColumns) {
        lines.push(`  ${store.label}`)
        for (const item of items) lines.push(`    □ ${item.name}`)
      }
      lines.push('')
    }
    if (extraColumns.length > 0) {
      lines.push('Extra Grocery Items')
      for (const { store, items } of extraColumns) {
        lines.push(`  ${store.label}`)
        for (const item of items) {
          const meals = item.meals?.length ? ` (${item.meals.join(', ')})` : ''
          lines.push(`    □ ${item.name}${meals}`)
        }
      }
    }
    try {
      await navigator.clipboard.writeText(lines.join('\n').trim())
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch {
      setCopyStatus('error')
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-6 py-5 border-b border-willow-mist flex items-center justify-between gap-4">
        <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow">Grocery List</h2>
        {onAddExtra && (
          <button
            onClick={() => setAddingExtra(true)}
            className="shrink-0 bg-fresh-herb text-soil-shadow font-bold text-sm px-4 py-2 rounded-pill shadow-card hover:opacity-90 transition-opacity"
          >
            + Add item
          </button>
        )}
      </div>

      {/* Inline add-item form */}
      {addingExtra && onAddExtra && (
        <div className="px-6 py-3 border-b border-willow-mist flex gap-2 flex-wrap items-center bg-fresh-herb/10">
          <input
            autoFocus
            value={newExtraName}
            onChange={e => setNewExtraName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddExtra()}
            placeholder="Item name"
            className="flex-1 min-w-32 border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <select
            value={newExtraStore}
            onChange={e => setNewExtraStore(e.target.value)}
            className="border border-willow-mist rounded-xl bg-field-cream px-2 py-2 text-sm focus:outline-none"
          >
            {STORES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            onClick={handleAddExtra}
            disabled={!newExtraName.trim()}
            className="bg-fresh-herb text-soil-shadow font-bold px-3 py-2 rounded-xl text-sm disabled:opacity-50"
          >
            Add
          </button>
          <button
            onClick={() => { setAddingExtra(false); setNewExtraName(''); setNewExtraStore('aldi') }}
            className="text-stone-grey px-2 text-sm"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Store grid */}
      <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
        {total === 0 ? (
          <p className="text-center text-stone-grey py-8">No meals planned yet — nothing to buy.</p>
        ) : (
          <div className="space-y-8">
            {/* Staples section */}
            {stapleColumns.length > 0 && (
              <div>
                <h3 className="font-display font-light text-lg text-soil-shadow mb-3">Staples</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {stapleColumns.map(({ store, items }) => (
                    <div key={store.value}>
                      <h4 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h4>
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-stone-grey mt-0.5 shrink-0">□</span>
                            <span className="flex-1">
                              <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                              {item.notes && (
                                <span className="block text-xs text-stone-grey">{item.notes}</span>
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Extra Grocery Items section */}
            {extraColumns.length > 0 && (
              <div>
                <h3 className="font-display font-light text-lg text-soil-shadow mb-3">Extra Grocery Items</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {extraColumns.map(({ store, items }) => (
                    <div key={store.value}>
                      <h4 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h4>
                      <ul className="space-y-2">
                        {items.map((item, i) => (
                          <li key={item.isExtra ? item.id : i} className="flex items-start gap-2">
                            <span className="text-stone-grey mt-0.5 shrink-0">□</span>
                            <span className="flex-1">
                              <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                              {item.meals?.length > 0 && (
                                <span className="block text-xs text-stone-grey">{item.meals.join(', ')}</span>
                              )}
                            </span>
                            {item.isExtra && onRemoveExtra && (
                              <button
                                onClick={() => onRemoveExtra(item.id)}
                                className="text-stone-grey hover:text-red-500 text-base leading-none transition-colors shrink-0 mt-0.5"
                              >
                                ×
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-willow-mist flex gap-3 justify-end">
        <button
          onClick={copyList}
          className={`px-5 py-2.5 text-sm font-bold rounded-pill shadow-card transition-opacity ${
            copyStatus === 'error'
              ? 'bg-red-400 text-white'
              : 'bg-fresh-herb text-soil-shadow hover:opacity-90'
          }`}
        >
          {copyStatus === 'copied' ? '✓ Copied!' : copyStatus === 'error' ? 'Copy failed' : '📋 Copy list'}
        </button>
      </div>
    </div>
  )
}
