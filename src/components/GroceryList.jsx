import { useState } from 'react'
import { generateGroceryList } from '../utils/groceryList'
import { STORES } from '../utils/stores'

/**
 * Props:
 *   slots: Record<string, {type, recipe?: {id, name}} | null>
 *   recipes: Array<{id, name, ingredients: [{id, name, store}]}>
 *   staples: Array<{id, name, store, notes}>
 *   addedIngredients: Array<{id, name, store}>
 *   onRemoveAdded: (id: string) => void
 *   onRemoveStaple: (id: string) => void
 */
export function GroceryList({ slots, recipes, staples, addedIngredients = [], onRemoveAdded, onRemoveStaple }) {
  const [copyStatus, setCopyStatus] = useState(null)

  const slotArray = Object.entries(slots)
    .filter(([, slot]) => slot !== null)
    .map(([day, slot]) => ({ day, ...slot, recipeId: slot?.recipe?.id }))

  const list = generateGroceryList(slotArray, recipes, staples, addedIngredients)
  const total = Object.values(list).reduce((sum, items) => sum + items.length, 0)

  const storeColumns = STORES
    .map(s => ({ store: s, items: list[s.value] ?? [] }))
    .filter(col => col.items.length > 0)

  async function copyList() {
    const lines = []
    for (const { store, items } of storeColumns) {
      lines.push(store.label)
      for (const item of items) {
        const hint = item.isStaple
          ? (item.notes ? ` — ${item.notes}` : '')
          : item.meals?.length > 1
          ? ` (${item.meals.length} meals)`
          : item.meals?.length === 1
          ? ` (${item.meals[0]})`
          : ''
        lines.push(`  ${item.name}${hint}`)
      }
      lines.push('')
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
      {/* Store grid */}
      <div className="px-4 py-4 sm:px-6 sm:py-5">
        {total === 0 ? (
          <p className="text-center text-stone-grey py-8">No meals planned yet — nothing to buy.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {storeColumns.map(({ store, items }) => (
              <div key={store.value}>
                <h4 className="font-bold text-xs text-garden-patch mb-3 uppercase tracking-widest">{store.label}</h4>
                <ul className="space-y-2">
                  {items.map((item, i) => (
                    <li key={item.isAdded || item.isStaple ? item.id : i} className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-soil-shadow">{item.name}</span>
                      {item.isAdded && onRemoveAdded ? (
                        <button
                          onClick={() => onRemoveAdded(item.id)}
                          className="text-stone-grey hover:text-red-500 text-base leading-none transition-colors shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          ×
                        </button>
                      ) : item.isStaple && onRemoveStaple ? (
                        <button
                          onClick={() => onRemoveStaple(item.id)}
                          className="text-stone-grey hover:text-red-500 text-base leading-none transition-colors shrink-0"
                          aria-label={`Remove ${item.name}`}
                        >
                          ×
                        </button>
                      ) : item.isStaple ? (
                        <span className="text-xs text-stone-grey shrink-0">staple</span>
                      ) : item.meals?.length > 1 ? (
                        <span className="text-xs text-stone-grey shrink-0">{item.meals.length} meals</span>
                      ) : item.meals?.length === 1 ? (
                        <span className="text-xs text-stone-grey shrink-0 truncate max-w-[120px]">{item.meals[0]}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-4 sm:px-6 border-t border-willow-mist flex justify-end">
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
