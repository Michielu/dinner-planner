import { useState } from 'react'
import { generateGroceryList } from '../utils/groceryList'

const STORE_CONFIG = [
  { key: 'sams_club', label: "Sam's Club" },
  { key: 'aldi',     label: 'Aldi' },
  { key: 'target',   label: 'Target' },
]

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 */
export function GroceryList({ slots, recipes, staples }) {
  const [copyStatus, setCopyStatus] = useState(null) // null | 'copied' | 'error'

  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  async function copyList() {
    const lines = STORE_CONFIG
      .filter(s => list[s.key].length > 0)
      .flatMap(s => [
        s.label,
        ...list[s.key].map(i => `  □ ${i.name}${i.isStaple ? ' ★' : ''}`),
        '',
      ])
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
      setCopyStatus('copied')
      setTimeout(() => setCopyStatus(null), 2000)
    } catch {
      setCopyStatus('error')
      setTimeout(() => setCopyStatus(null), 3000)
    }
  }

  return (
    <div className="flex flex-col">
      <div className="px-6 py-5 border-b border-willow-mist">
        <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow">Grocery List</h2>
      </div>

      <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
        {total === 0 ? (
          <p className="text-center text-stone-grey py-8">No meals planned yet — nothing to buy.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STORE_CONFIG.map(store => (
              <div key={store.key}>
                <h3 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h3>
                {list[store.key].length === 0 ? (
                  <p className="text-xs text-stone-grey/50">Nothing from here</p>
                ) : (
                  <ul className="space-y-2">
                    {list[store.key].map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-stone-grey mt-0.5 shrink-0">□</span>
                        <span>
                          <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                          {item.isStaple && (
                            <span className="ml-1 text-xs text-fresh-herb font-bold">★</span>
                          )}
                          {item.notes && (
                            <span className="block text-xs text-stone-grey">{item.notes}</span>
                          )}
                          {!item.isStaple && item.meals && item.meals.length > 0 && (
                            <span className="block text-xs text-stone-grey">{item.meals.join(', ')}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
        {total > 0 && (
          <p className="text-xs text-stone-grey mt-6">★ staple — check if you have enough</p>
        )}
      </div>

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
