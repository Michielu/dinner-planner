import { useState } from 'react'

const SLOT_LABEL = {
  eating_out: '🍽️ Eating Out',
  flex: '🎲 Flex Night',
}

const FLAGS = [
  { flag: 'favorite', icon: '♥', label: 'Favorite' },
  { flag: 'quick',    icon: '⚡', label: 'Quick'   },
  { flag: 'easy',     icon: '✓', label: 'Easy'     },
]

export function DayDetail({ day, slots, recipes, categories, pantryItems, onAdd, onRemove, onClose }) {
  const [picking, setPicking] = useState(slots.length === 0)
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [activeFlags, setActiveFlags] = useState(new Set())

  function toggleFlagFilter(flag) {
    setActiveFlags(prev => {
      const next = new Set(prev)
      next.has(flag) ? next.delete(flag) : next.add(flag)
      return next
    })
  }

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

  const byCategory = bySearch
    .filter(r => filterCategory === 'all' || r.category?.id === filterCategory)
    .filter(r => !activeFlags.has('favorite') || r.is_favorite)
    .filter(r => !activeFlags.has('quick')    || r.is_quick)
    .filter(r => !activeFlags.has('easy')     || r.is_easy)

  const pantryMatches = byCategory.filter(matchesPantry)
  const rest = byCategory.filter(r => !matchesPantry(r))

  function resetPicker() {
    setPicking(false)
    setSearch('')
    setFilterCategory('all')
    setActiveFlags(new Set())
  }

  function handlePick(slot) {
    onAdd(slot)
    resetPicker()
  }

  function handleBackdropClick() {
    if (picking) resetPicker()
    else onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-grain-sand rounded-t-3xl sm:rounded-3xl shadow-card w-full sm:max-w-sm flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-willow-mist rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between border-b border-willow-mist">
          {picking ? (
            <button onClick={resetPicker} className="text-sm text-stone-grey hover:text-soil-shadow">
              ← Back
            </button>
          ) : (
            <p className="font-display font-light text-2xl tracking-tight text-soil-shadow capitalize">{day}</p>
          )}
          <button onClick={onClose} className="text-stone-grey hover:text-soil-shadow text-2xl leading-none hidden sm:block">
            &times;
          </button>
        </div>

        {!picking ? (
          <>
            {/* Meal pills */}
            <div className="overflow-y-auto px-4 pt-4 pb-2 space-y-2">
              {slots.map((s, i) => {
                const sourceUrl = s.type === 'recipe'
                  ? recipes.find(r => r.id === s.recipe?.id)?.source_url
                  : null
                return (
                  <div key={i}>
                    <button
                      onClick={() => onRemove(i)}
                      className="flex items-center gap-1.5 bg-fresh-herb/30 hover:bg-red-100 text-soil-shadow hover:text-red-600 rounded-full px-3 py-2 text-sm font-bold transition-colors group"
                    >
                      {s.type === 'recipe' ? <span className="uppercase">{s.recipe?.name}</span> : SLOT_LABEL[s.type]}
                      <span className="text-xs opacity-50 group-hover:opacity-100">✕</span>
                    </button>
                    {sourceUrl && (
                      <a
                        href={sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block ml-3 mt-0.5 text-xs text-garden-patch hover:underline font-bold"
                      >
                        Source ↗
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="px-5 text-xs text-stone-grey/60 mb-3">tap a meal to remove it</p>
            <div className="px-4 pb-5">
              <button
                onClick={() => setPicking(true)}
                className="w-full bg-garden-patch text-fresh-herb font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity"
              >
                + Add meal
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Quick options */}
            <div className="px-4 pt-3 pb-2 flex gap-2 border-b border-willow-mist">
              <button
                onClick={() => handlePick({ type: 'eating_out' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
              >
                🍽️ Eating Out
              </button>
              <button
                onClick={() => handlePick({ type: 'flex' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
              >
                🎲 Flex Night
              </button>
            </div>

            {/* Flag toggles */}
            <div className="px-4 pt-2 pb-2 flex gap-2">
              {FLAGS.map(({ flag, icon, label }) => (
                <button
                  key={flag}
                  onClick={() => toggleFlagFilter(flag)}
                  className={`flex-1 border-2 rounded-2xl py-2 text-sm font-bold transition-colors ${
                    activeFlags.has(flag)
                      ? 'border-garden-patch bg-garden-patch/10 text-garden-patch'
                      : 'border-willow-mist text-stone-grey hover:border-garden-patch/40 hover:text-soil-shadow'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="px-4 pt-1 pb-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search recipes…"
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>

            {/* Category filter */}
            <div className="px-4 pb-3 flex gap-2 flex-wrap border-b border-willow-mist">
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
              {pantryMatches.length > 0 && (
                <>
                  <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Uses what you have</p>
                  {pantryMatches.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handlePick({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                      className="w-full text-left px-4 py-3 rounded-2xl bg-fresh-herb/30 border border-fresh-herb/50 hover:bg-fresh-herb/50 transition-colors shadow-card"
                    >
                      <span className="text-sm font-bold text-soil-shadow uppercase">{r.name}</span>
                      <span className="text-xs text-garden-patch ml-2 uppercase">
                        {r.ingredients
                          .filter(i => normalised.some(p => i.name.toLowerCase().includes(p)))
                          .map(i => i.name)
                          .join(', ')}
                      </span>
                      <span className="ml-1 inline-flex gap-1">
                        {r.is_favorite && <span className="text-xs text-garden-patch">♥</span>}
                        {r.is_quick    && <span className="text-xs text-stone-grey">⚡</span>}
                        {r.is_easy     && <span className="text-xs text-stone-grey">✓</span>}
                      </span>
                    </button>
                  ))}
                  {rest.length > 0 && <hr className="border-willow-mist my-2" />}
                </>
              )}
              {rest.map(r => (
                <button
                  key={r.id}
                  onClick={() => handlePick({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors"
                >
                  <span className="text-sm font-bold text-soil-shadow uppercase">{r.name}</span>
                  <span className="ml-1 inline-flex gap-1">
                    {r.is_favorite && <span className="text-xs text-garden-patch">♥</span>}
                    {r.is_quick    && <span className="text-xs text-stone-grey">⚡</span>}
                    {r.is_easy     && <span className="text-xs text-stone-grey">✓</span>}
                  </span>
                </button>
              ))}
              {byCategory.length === 0 && (
                <p className="text-center text-stone-grey text-sm py-6">No recipes found.</p>
              )}
              <a
                href="/recipes"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-3 rounded-2xl border-2 border-dashed border-willow-mist text-stone-grey text-sm font-bold hover:border-garden-patch hover:text-garden-patch transition-colors"
              >
                + Add new recipe ↗
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
