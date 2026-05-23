import { useState } from 'react'

/**
 * Props:
 *   recipes: Array<{id, name, category_id, ingredients: [{id, name}]}>
 *   categories: Array<{id, name}>
 *   pantryItems: string[] — ingredient names to match
 *   onSelect: ({type: 'recipe', recipe: {id, name}} | {type: 'eating_out'} | {type: 'flex'}) => void
 *   onClose: () => void
 *   day: string
 */
export function RecipePicker({ recipes, categories, pantryItems, onSelect, onClose, day }) {
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')

  const normalised = pantryItems.map(p => p.toLowerCase())

  function matchesPantry(recipe) {
    if (normalised.length === 0) return false
    return recipe.ingredients.some(ing =>
      normalised.some(p => ing.name.toLowerCase().includes(p))
    )
  }

  const bySearch = search.trim()
    ? recipes.filter(r => r.name.toLowerCase().includes(search.toLowerCase()))
    : recipes

  const byCategory = filterCategory === 'all'
    ? bySearch
    : bySearch.filter(r => r.category_id === filterCategory)

  const matches = byCategory.filter(matchesPantry)
  const rest = byCategory.filter(r => !matchesPantry(r))

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-grain-sand shadow-card flex flex-col h-full"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-willow-mist flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-widest uppercase text-garden-patch">Picking meal for</p>
            <p className="font-display font-light text-2xl tracking-tight text-soil-shadow capitalize">{day}</p>
          </div>
          <button onClick={onClose} className="text-stone-grey hover:text-soil-shadow text-2xl leading-none">&times;</button>
        </div>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search recipes…"
            className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
        </div>

        {/* Quick options */}
        <div className="px-4 pb-2 flex gap-2">
          <button
            onClick={() => onSelect({ type: 'eating_out' })}
            className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
          >
            🍽️ Eating Out
          </button>
          <button
            onClick={() => onSelect({ type: 'flex' })}
            className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
          >
            🎲 Flex Night
          </button>
        </div>

        {/* Category filter */}
        <div className="px-4 py-2 flex gap-2 flex-wrap border-b border-willow-mist">
          {[{ id: 'all', name: 'All' }, ...categories].map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCategory(c.id)}
              className={`px-3 py-1 rounded-pill text-xs font-bold transition-colors ${
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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {matches.length > 0 && (
            <>
              <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Uses what you have</p>
              {matches.map(r => (
                <button
                  key={r.id}
                  onClick={() => onSelect({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-fresh-herb/30 border border-fresh-herb/50 hover:bg-fresh-herb/50 transition-colors shadow-card"
                >
                  <span className="text-sm font-bold text-soil-shadow">{r.name}</span>
                  <span className="text-xs text-garden-patch ml-2">
                    {r.ingredients
                      .filter(i => normalised.some(p => i.name.toLowerCase().includes(p)))
                      .map(i => i.name)
                      .join(', ')}
                  </span>
                </button>
              ))}
              {rest.length > 0 && <hr className="border-willow-mist my-2" />}
            </>
          )}
          {rest.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
              className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors"
            >
              <span className="text-sm font-bold text-soil-shadow">{r.name}</span>
            </button>
          ))}

          {byCategory.length === 0 && (
            <p className="text-center text-stone-grey text-sm py-6">No recipes found.</p>
          )}

          {/* Add new recipe — opens in new tab to preserve planning state */}
          <a
            href="/recipes"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-3 rounded-2xl border-2 border-dashed border-willow-mist text-stone-grey text-sm font-bold hover:border-garden-patch hover:text-garden-patch transition-colors"
          >
            + Add new recipe ↗
          </a>
        </div>
      </div>
    </div>
  )
}
