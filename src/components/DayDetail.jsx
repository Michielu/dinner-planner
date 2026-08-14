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

const MEAL_TYPES = new Set(['recipe', 'eating_out', 'flex'])

export function DayDetail({ day, slots, recipes, categories, pantryItems, onAdd, onRemove, onClose, ingredients = [], stores = [], onCreateIngredient }) {
  const [mode, setMode] = useState(null) // null | 'meal' | 'ingredient'
  const [filterCategory, setFilterCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [activeFlags, setActiveFlags] = useState(new Set())
  const [ingSearch, setIngSearch] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [createStore, setCreateStore] = useState(() => stores[0]?.value ?? '')
  const [isCreating, setIsCreating] = useState(false)

  // Attach original index so onRemove receives the right position in the full slots array
  const mealSlots = slots
    .map((s, i) => ({ ...s, _index: i }))
    .filter(s => MEAL_TYPES.has(s.type))

  const pinnedSlots = slots
    .map((s, i) => ({ ...s, _index: i }))
    .filter(s => s.type === 'pinned_ingredient')

  const alreadyPinnedIds = new Set(pinnedSlots.map(s => s.ingredient?.id))

  function toggleFlag(flag) {
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

  const filteredIngredients = ingSearch.trim()
    ? ingredients.filter(i => i.name.toLowerCase().includes(ingSearch.toLowerCase()))
    : ingredients

  const showCreate = ingSearch.trim().length > 0 &&
    !ingredients.some(i => i.name.toLowerCase() === ingSearch.trim().toLowerCase())

  function resetPicker() {
    setMode(null)
    setSearch('')
    setIngSearch('')
    setFilterCategory('all')
    setActiveFlags(new Set())
    setExpanded(false)
    setCreateStore(stores[0]?.value ?? '')
    setIsCreating(false)
  }

  function handlePickRecipe(slot) { onAdd(slot); resetPicker() }
  function handlePickIngredient(ing) {
    onAdd({ type: 'pinned_ingredient', ingredient: { id: ing.id, name: ing.name, store: ing.store } })
    resetPicker()
  }

  async function handleCreateIngredient() {
    const name = ingSearch.trim()
    setIsCreating(true)
    try {
      const id = await onCreateIngredient(name, createStore)
      onAdd({ type: 'pinned_ingredient', ingredient: { id, name, store: createStore } })
      resetPicker()
    } catch (err) {
      console.error('Failed to create ingredient:', err)
    } finally {
      setIsCreating(false)
    }
  }

  function handleBackdropClick() {
    if (mode) resetPicker()
    else onClose()
  }

  return (
    <div
      className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-grain-sand rounded-t-3xl sm:rounded-3xl shadow-card w-full sm:max-w-sm flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 sm:hidden">
          <div className="w-10 h-1 bg-willow-mist rounded-full" />
        </div>

        <div className="px-5 py-4 flex items-center justify-between border-b border-willow-mist">
          {mode ? (
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

        {!mode ? (
          <div className="overflow-y-auto flex-1">
            {/* Meals section */}
            <div className="px-4 pt-4 pb-3">
              <p className="text-xs font-bold tracking-widest uppercase text-stone-grey mb-3">Meals</p>
              <div className="space-y-2">
                {mealSlots.map(s => {
                  const sourceUrl = s.type === 'recipe'
                    ? recipes.find(r => r.id === s.recipe?.id)?.source_url
                    : null
                  return (
                    <div key={s._index}>
                      <button
                        onClick={() => onRemove(s._index)}
                        className="flex items-center gap-1.5 bg-fresh-herb/30 hover:bg-red-100 text-soil-shadow hover:text-red-600 rounded-full px-3 py-2 text-sm font-bold transition-colors group"
                      >
                        {s.type === 'recipe' ? <span className="uppercase">{s.recipe?.name}</span> : SLOT_LABEL[s.type]}
                        <span className="text-xs opacity-50 group-hover:opacity-100">✕</span>
                      </button>
                      {sourceUrl && (
                        <a href={sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="block ml-3 mt-0.5 text-xs text-garden-patch hover:underline font-bold">
                          Source ↗
                        </a>
                      )}
                    </div>
                  )
                })}
                {mealSlots.length === 0 && (
                  <p className="text-sm text-stone-grey/40 py-1">No meals yet</p>
                )}
              </div>
              <button
                onClick={() => setMode('meal')}
                className="mt-3 w-full border-2 border-dashed border-willow-mist text-stone-grey hover:border-garden-patch hover:text-garden-patch rounded-2xl py-2.5 text-sm font-bold transition-colors"
              >
                + Add meal
              </button>
            </div>

            <div className="mx-4 border-t border-willow-mist" />

            {/* Grocery additions section */}
            <div className="px-4 pt-4 pb-5">
              <p className="text-xs font-bold tracking-widest uppercase text-stone-grey mb-3">Grocery additions</p>
              <div className="space-y-2">
                {pinnedSlots.map(s => (
                  <button
                    key={s._index}
                    onClick={() => onRemove(s._index)}
                    className="flex items-center gap-1.5 bg-field-cream border border-willow-mist hover:bg-red-50 hover:border-red-200 text-stone-grey hover:text-red-500 rounded-full px-3 py-2 text-sm font-bold transition-colors group"
                  >
                    <span className="uppercase">{s.ingredient?.name}</span>
                    <span className="text-xs opacity-50 group-hover:opacity-100">✕</span>
                  </button>
                ))}
                {pinnedSlots.length === 0 && (
                  <p className="text-sm text-stone-grey/40 py-1">Nothing added yet</p>
                )}
              </div>
              <button
                onClick={() => setMode('ingredient')}
                className="mt-3 w-full border-2 border-dashed border-willow-mist text-stone-grey hover:border-garden-patch hover:text-garden-patch rounded-2xl py-2.5 text-sm font-bold transition-colors"
              >
                + Add ingredient
              </button>
            </div>
          </div>
        ) : mode === 'meal' ? (
          <>
            <div className="px-4 pt-3 pb-2 flex gap-2 border-b border-willow-mist">
              <button onClick={() => handlePickRecipe({ type: 'eating_out' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors">
                🍽️ Eating Out
              </button>
              <button onClick={() => handlePickRecipe({ type: 'flex' })}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors">
                🎲 Flex Night
              </button>
            </div>

            <div className="px-4 pt-2 pb-2 flex gap-2">
              {FLAGS.map(({ flag, icon, label }) => (
                <button key={flag} onClick={() => toggleFlag(flag)}
                  className={`flex-1 border-2 rounded-2xl py-2 text-sm font-bold transition-colors ${
                    activeFlags.has(flag)
                      ? 'border-garden-patch bg-garden-patch/10 text-garden-patch'
                      : 'border-willow-mist text-stone-grey hover:border-garden-patch/40 hover:text-soil-shadow'
                  }`}>
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="px-4 pt-1 pb-2">
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search recipes…"
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>

            <div className="px-4 pb-3 flex gap-2 flex-wrap border-b border-willow-mist">
              {[{ id: 'all', name: 'All' }, ...categories].map(c => (
                <button key={c.id} onClick={() => setFilterCategory(c.id)}
                  className={`px-3 py-1 rounded-pill text-xs font-bold transition-colors ${
                    filterCategory === c.id
                      ? 'bg-garden-patch text-fresh-herb'
                      : 'bg-willow-mist text-stone-grey hover:bg-garden-patch/10'
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {pantryMatches.length > 0 && (
                <>
                  <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Uses what you have</p>
                  {pantryMatches.map(r => (
                    <button key={r.id}
                      onClick={() => handlePickRecipe({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                      className="w-full text-left px-4 py-3 rounded-2xl bg-fresh-herb/30 border border-fresh-herb/50 hover:bg-fresh-herb/50 transition-colors shadow-card">
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
                <button key={r.id}
                  onClick={() => handlePickRecipe({ type: 'recipe', recipe: { id: r.id, name: r.name } })}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors">
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
              <a href="/recipes" target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 mt-2 px-4 py-3 rounded-2xl border-2 border-dashed border-willow-mist text-stone-grey text-sm font-bold hover:border-garden-patch hover:text-garden-patch transition-colors">
                + Add new recipe ↗
              </a>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pt-3 pb-2">
              <input value={ingSearch} onChange={e => { setIngSearch(e.target.value); setExpanded(false) }}
                placeholder="Search ingredients…"
                autoFocus
                className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {filteredIngredients.map(ing => (
                <button
                  key={ing.id}
                  onClick={() => !alreadyPinnedIds.has(ing.id) && handlePickIngredient(ing)}
                  disabled={alreadyPinnedIds.has(ing.id)}
                  className={`w-full text-left px-4 py-3 rounded-2xl transition-colors ${
                    alreadyPinnedIds.has(ing.id)
                      ? 'bg-willow-mist/50 text-stone-grey/40 cursor-default'
                      : 'bg-willow-mist hover:bg-fresh-herb/20'
                  }`}
                >
                  <span className="text-sm font-bold text-soil-shadow uppercase">{ing.name}</span>
                  {alreadyPinnedIds.has(ing.id) && <span className="ml-2 text-xs text-stone-grey/50">added</span>}
                </button>
              ))}

              {showCreate && !expanded && (
                <button
                  onClick={() => setExpanded(true)}
                  className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl border-2 border-dashed border-garden-patch/40 text-garden-patch hover:border-garden-patch hover:bg-garden-patch/5 transition-colors"
                >
                  <span className="text-lg leading-none">+</span>
                  <span className="text-sm font-bold">Create &ldquo;{ingSearch.trim()}&rdquo;</span>
                </button>
              )}

              {showCreate && expanded && (
                <div className="rounded-2xl border-2 border-garden-patch/50 bg-garden-patch/5 px-4 py-3 space-y-3">
                  <p className="text-sm font-bold text-soil-shadow">
                    + Create &ldquo;{ingSearch.trim()}&rdquo;
                  </p>
                  <div className="flex gap-2 items-center">
                    <select
                      value={createStore}
                      onChange={e => setCreateStore(e.target.value)}
                      className="flex-1 border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                    >
                      {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <button
                      onClick={handleCreateIngredient}
                      disabled={isCreating}
                      className="bg-garden-patch text-fresh-herb font-bold px-4 py-2 rounded-xl text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {isCreating ? '…' : 'Add'}
                    </button>
                    <button
                      onClick={() => setExpanded(false)}
                      className="text-stone-grey hover:text-soil-shadow text-sm px-2 py-2 leading-none"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )}

              {filteredIngredients.length === 0 && !showCreate && (
                <p className="text-center text-stone-grey text-sm py-6">No ingredients found.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
