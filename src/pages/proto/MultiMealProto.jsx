// PROTOTYPE: Multiple meals per day — 3 UI variants
// Question: How should multiple recipes per day look and feel in the week grid?
// Variants switchable via ?variant=A|B|C on the planner route.
// Delete or promote once a variant is chosen.

import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const MOCK_RECIPES = [
  { id: '1', name: 'Chili' },
  { id: '2', name: 'Corn Bread' },
  { id: '3', name: 'Pasta Bolognese' },
  { id: '4', name: 'Caesar Salad' },
  { id: '5', name: 'Chicken Stir Fry' },
  { id: '6', name: 'Tacos' },
  { id: '7', name: 'Lentil Soup' },
]

const INITIAL_SLOTS = {
  monday: [
    { type: 'recipe', recipe: { id: '1', name: 'Chili' } },
    { type: 'recipe', recipe: { id: '2', name: 'Corn Bread' } },
  ],
  tuesday: [{ type: 'recipe', recipe: { id: '3', name: 'Pasta Bolognese' } }],
  wednesday: null,
  thursday: [{ type: 'eating_out' }],
  friday: [
    { type: 'recipe', recipe: { id: '5', name: 'Chicken Stir Fry' } },
    { type: 'recipe', recipe: { id: '6', name: 'Tacos' } },
  ],
  saturday: null,
  sunday: null,
}

function slotLabel(s) {
  if (s.type === 'eating_out') return '🍽️ Eating Out'
  if (s.type === 'flex') return '🎲 Flex Night'
  return s.recipe?.name ?? 'Recipe'
}

// ── Variant A: Side Drawer ────────────────────────────────────────────────────
// Day detail lives in a right-side drawer (like the existing RecipePicker).
// Empty day → skip drawer, go straight to picker.
// Filled day → open drawer showing recipes + remove buttons + "Add another" button.

function VariantA() {
  const [slots, setSlots] = useState(INITIAL_SLOTS)
  const [activeDay, setActiveDay] = useState(null) // drawer open for this day
  const [picking, setPicking] = useState(false)    // showing mini picker inside drawer

  const activeDaySlots = activeDay ? (slots[activeDay] ?? []) : []

  function handleDayClick(key) {
    const daySlots = slots[key]
    if (!daySlots || daySlots.length === 0) {
      setActiveDay(key)
      setPicking(true)
    } else {
      setActiveDay(key)
      setPicking(false)
    }
  }

  function handleRemove(idx) {
    const updated = activeDaySlots.filter((_, i) => i !== idx)
    setSlots(s => ({ ...s, [activeDay]: updated.length ? updated : null }))
  }

  function handlePick(recipe) {
    const updated = [...activeDaySlots, { type: 'recipe', recipe }]
    setSlots(s => ({ ...s, [activeDay]: updated }))
    setPicking(false)
  }

  function handleSpecial(type) {
    setSlots(s => ({ ...s, [activeDay]: [{ type }] }))
    setActiveDay(null)
    setPicking(false)
  }

  function close() {
    setActiveDay(null)
    setPicking(false)
  }

  return (
    <>
      <div className="space-y-2">
        {DAYS.map(day => {
          const key = day.toLowerCase()
          const daySlots = slots[key] ?? []
          const recipes = daySlots.filter(s => s.type === 'recipe')
          const special = daySlots.find(s => s.type !== 'recipe')
          return (
            <button
              key={day}
              onClick={() => handleDayClick(key)}
              className="w-full flex items-center gap-4 bg-willow-mist rounded-2xl px-5 py-4 shadow-card hover:opacity-90 transition-opacity text-left"
            >
              <span className="w-24 text-sm text-stone-grey font-bold tracking-wide shrink-0">{day}</span>
              <div className="flex-1 min-w-0">
                {special ? (
                  <span className="text-sm text-stone-grey italic">{slotLabel(special)}</span>
                ) : recipes.length > 0 ? (
                  <span className="text-sm text-soil-shadow font-bold">
                    {recipes.map(s => s.recipe.name).join(' + ')}
                  </span>
                ) : (
                  <span className="text-sm text-stone-grey/50">+ pick meal</span>
                )}
              </div>
              {recipes.length > 1 && (
                <span className="text-xs bg-garden-patch/20 text-garden-patch rounded-full px-2 py-0.5 font-bold shrink-0">
                  {recipes.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeDay && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={close}>
          <div
            className="w-full max-w-sm bg-grain-sand shadow-card flex flex-col h-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-willow-mist flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-garden-patch">
                  {picking ? 'Add meal for' : 'Meals for'}
                </p>
                <p className="font-display font-light text-2xl tracking-tight text-soil-shadow capitalize">{activeDay}</p>
              </div>
              <button onClick={close} className="text-stone-grey hover:text-soil-shadow text-2xl leading-none">&times;</button>
            </div>

            {!picking ? (
              <>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {activeDaySlots.map((s, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl bg-willow-mist">
                      <span className="text-sm font-bold text-soil-shadow">{slotLabel(s)}</span>
                      <button
                        onClick={() => handleRemove(i)}
                        className="text-stone-grey hover:text-red-400 ml-3 text-base leading-none transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="px-4 pb-6">
                  <button
                    onClick={() => setPicking(true)}
                    className="w-full border-2 border-dashed border-willow-mist rounded-2xl py-3 text-sm font-bold text-stone-grey hover:border-garden-patch hover:text-garden-patch transition-colors"
                  >
                    + Add another meal
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-2 flex gap-2 border-b border-willow-mist">
                  <button
                    onClick={() => handleSpecial('eating_out')}
                    className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
                  >
                    🍽️ Eating Out
                  </button>
                  <button
                    onClick={() => handleSpecial('flex')}
                    className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
                  >
                    🎲 Flex Night
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                  {activeDaySlots.length > 0 && (
                    <button
                      onClick={() => setPicking(false)}
                      className="text-sm text-stone-grey mb-1 hover:text-soil-shadow"
                    >
                      ← Back to {activeDay}
                    </button>
                  )}
                  {MOCK_RECIPES.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handlePick(r)}
                      className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors"
                    >
                      <span className="text-sm font-bold text-soil-shadow">{r.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Variant B: Bottom Sheet Modal ─────────────────────────────────────────────
// Day detail opens as a centered bottom sheet / card (not a side panel).
// Feels more like a quick action sheet than a full drawer.
// Recipes are shown as pills that can be tapped to remove.

function VariantB() {
  const [slots, setSlots] = useState(INITIAL_SLOTS)
  const [activeDay, setActiveDay] = useState(null)
  const [picking, setPicking] = useState(false)

  const activeDaySlots = activeDay ? (slots[activeDay] ?? []) : []

  function handleDayClick(key) {
    setActiveDay(key)
    setPicking(!slots[key] || slots[key].length === 0)
  }

  function handleRemove(idx) {
    const updated = activeDaySlots.filter((_, i) => i !== idx)
    setSlots(s => ({ ...s, [activeDay]: updated.length ? updated : null }))
    if (updated.length === 0) setActiveDay(null)
  }

  function handlePick(recipe) {
    const updated = [...activeDaySlots, { type: 'recipe', recipe }]
    setSlots(s => ({ ...s, [activeDay]: updated }))
    setPicking(false)
  }

  function handleSpecial(type) {
    setSlots(s => ({ ...s, [activeDay]: [{ type }] }))
    setActiveDay(null)
    setPicking(false)
  }

  function close() {
    setActiveDay(null)
    setPicking(false)
  }

  return (
    <>
      <div className="space-y-2">
        {DAYS.map(day => {
          const key = day.toLowerCase()
          const daySlots = slots[key] ?? []
          const recipes = daySlots.filter(s => s.type === 'recipe')
          const special = daySlots.find(s => s.type !== 'recipe')
          return (
            <button
              key={day}
              onClick={() => handleDayClick(key)}
              className="w-full flex items-start gap-4 bg-willow-mist rounded-2xl px-5 py-4 shadow-card hover:opacity-90 transition-opacity text-left"
            >
              <span className="w-24 text-sm text-stone-grey font-bold tracking-wide shrink-0 pt-0.5">{day}</span>
              <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                {special ? (
                  <span className="text-sm text-stone-grey italic self-center">{slotLabel(special)}</span>
                ) : recipes.length > 0 ? (
                  recipes.map((s, i) => (
                    <span
                      key={i}
                      className="text-xs bg-fresh-herb/30 text-soil-shadow font-bold px-2.5 py-1 rounded-full"
                    >
                      {s.recipe.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-stone-grey/50 self-center">+ pick meal</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {activeDay && (
        <div
          className="fixed inset-0 z-40 bg-black/30 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={close}
        >
          <div
            className="bg-grain-sand rounded-t-3xl sm:rounded-3xl shadow-card w-full sm:max-w-sm flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle + header */}
            <div className="flex justify-center pt-3 sm:hidden">
              <div className="w-10 h-1 bg-willow-mist rounded-full" />
            </div>
            <div className="px-5 py-4 flex items-center justify-between border-b border-willow-mist">
              <p className="font-display font-light text-2xl tracking-tight text-soil-shadow capitalize">{activeDay}</p>
              <button onClick={close} className="text-stone-grey text-2xl leading-none hidden sm:block">&times;</button>
            </div>

            {!picking ? (
              <>
                <div className="overflow-y-auto px-4 pt-4 pb-2 flex flex-wrap gap-2">
                  {activeDaySlots.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleRemove(i)}
                      className="flex items-center gap-1.5 bg-fresh-herb/30 hover:bg-red-100 text-soil-shadow hover:text-red-600 rounded-full px-3 py-2 text-sm font-bold transition-colors group"
                    >
                      {slotLabel(s)}
                      <span className="text-xs opacity-50 group-hover:opacity-100">✕</span>
                    </button>
                  ))}
                </div>
                <p className="px-5 text-xs text-stone-grey/60 mb-2">tap a meal to remove it</p>
                <div className="px-4 pb-5 flex gap-2">
                  <button
                    onClick={() => setPicking(true)}
                    className="flex-1 bg-garden-patch text-fresh-herb font-bold py-3 rounded-2xl text-sm hover:opacity-90 transition-opacity"
                  >
                    + Add meal
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-4 pt-3 pb-2 flex gap-2 border-b border-willow-mist">
                  {activeDaySlots.length > 0 && (
                    <button onClick={() => setPicking(false)} className="text-sm text-stone-grey hover:text-soil-shadow">
                      ←
                    </button>
                  )}
                  <button
                    onClick={() => handleSpecial('eating_out')}
                    className="flex-1 border-2 border-willow-mist rounded-2xl py-1.5 text-xs font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
                  >
                    🍽️ Eating Out
                  </button>
                  <button
                    onClick={() => handleSpecial('flex')}
                    className="flex-1 border-2 border-willow-mist rounded-2xl py-1.5 text-xs font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
                  >
                    🎲 Flex Night
                  </button>
                </div>
                <div className="overflow-y-auto px-4 py-3 space-y-2">
                  {MOCK_RECIPES.map(r => (
                    <button
                      key={r.id}
                      onClick={() => handlePick(r)}
                      className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors"
                    >
                      <span className="text-sm font-bold text-soil-shadow">{r.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ── Variant C: Inline Expansion ───────────────────────────────────────────────
// No modal or drawer. Tapping a day expands the row inline.
// Recipes appear as a sub-list with remove buttons. "+ Add" opens the existing
// side-drawer picker (only the picker, not a day-detail view).

function VariantC() {
  const [slots, setSlots] = useState(INITIAL_SLOTS)
  const [expandedDay, setExpandedDay] = useState(null)
  const [pickingDay, setPickingDay] = useState(null)

  function handleDayClick(key) {
    const daySlots = slots[key]
    if (!daySlots || daySlots.length === 0) {
      setPickingDay(key)
    } else {
      setExpandedDay(prev => prev === key ? null : key)
    }
  }

  function handleRemove(day, idx) {
    const updated = (slots[day] ?? []).filter((_, i) => i !== idx)
    setSlots(s => ({ ...s, [day]: updated.length ? updated : null }))
    if (updated.length === 0) setExpandedDay(null)
  }

  function handlePick(recipe) {
    const updated = [...(slots[pickingDay] ?? []), { type: 'recipe', recipe }]
    setSlots(s => ({ ...s, [pickingDay]: updated }))
    setPickingDay(null)
    setExpandedDay(pickingDay)
  }

  function handleSpecial(type) {
    setSlots(s => ({ ...s, [pickingDay]: [{ type }] }))
    setPickingDay(null)
  }

  return (
    <>
      <div className="space-y-2">
        {DAYS.map(day => {
          const key = day.toLowerCase()
          const daySlots = slots[key] ?? []
          const recipes = daySlots.filter(s => s.type === 'recipe')
          const special = daySlots.find(s => s.type !== 'recipe')
          const isExpanded = expandedDay === key

          return (
            <div key={day} className="bg-willow-mist rounded-2xl shadow-card overflow-hidden">
              <button
                onClick={() => handleDayClick(key)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:opacity-90 transition-opacity text-left"
              >
                <span className="w-24 text-sm text-stone-grey font-bold tracking-wide shrink-0">{day}</span>
                <div className="flex-1 min-w-0">
                  {special ? (
                    <span className="text-sm text-stone-grey italic">{slotLabel(special)}</span>
                  ) : recipes.length > 0 ? (
                    <span className="text-sm text-soil-shadow font-bold">
                      {recipes.map(s => s.recipe.name).join(', ')}
                    </span>
                  ) : (
                    <span className="text-sm text-stone-grey/50">+ pick meal</span>
                  )}
                </div>
                {daySlots.length > 0 && (
                  <span className="text-stone-grey text-xs transition-transform duration-150" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}>
                    ▾
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-4 pt-1 border-t border-willow-mist/60 space-y-2">
                  {daySlots.map((s, i) => (
                    <div key={i} className="flex items-center justify-between py-1">
                      <span className="text-sm font-bold text-soil-shadow">{slotLabel(s)}</span>
                      <button
                        onClick={() => handleRemove(key, i)}
                        className="text-stone-grey hover:text-red-400 text-sm transition-colors ml-3"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => setPickingDay(key)}
                    className="text-sm text-garden-patch font-bold hover:text-soil-shadow transition-colors pt-1"
                  >
                    + Add another meal
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {pickingDay && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setPickingDay(null)}>
          <div
            className="w-full max-w-sm bg-grain-sand shadow-card flex flex-col h-full"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-willow-mist flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase text-garden-patch">Picking meal for</p>
                <p className="font-display font-light text-2xl tracking-tight text-soil-shadow capitalize">{pickingDay}</p>
              </div>
              <button onClick={() => setPickingDay(null)} className="text-stone-grey text-2xl leading-none">&times;</button>
            </div>
            <div className="px-4 py-2 flex gap-2 border-b border-willow-mist">
              <button
                onClick={() => handleSpecial('eating_out')}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
              >
                🍽️ Eating Out
              </button>
              <button
                onClick={() => handleSpecial('flex')}
                className="flex-1 border-2 border-willow-mist rounded-2xl py-2 text-sm font-bold text-stone-grey hover:border-fresh-herb hover:text-soil-shadow transition-colors"
              >
                🎲 Flex Night
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {MOCK_RECIPES.map(r => (
                <button
                  key={r.id}
                  onClick={() => handlePick(r)}
                  className="w-full text-left px-4 py-3 rounded-2xl bg-willow-mist hover:bg-fresh-herb/20 transition-colors"
                >
                  <span className="text-sm font-bold text-soil-shadow">{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Switcher ──────────────────────────────────────────────────────────────────

const VARIANTS = [
  { key: 'A', label: 'Side Drawer' },
  { key: 'B', label: 'Bottom Sheet' },
  { key: 'C', label: 'Inline Expand' },
]

function PrototypeSwitcher({ current, onChange }) {
  const idx = VARIANTS.findIndex(v => v.key === current)
  const prev = VARIANTS[(idx - 1 + VARIANTS.length) % VARIANTS.length]
  const next = VARIANTS[(idx + 1) % VARIANTS.length]
  const label = VARIANTS[idx]?.label ?? current

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-soil-shadow text-fresh-herb rounded-full px-4 py-2.5 shadow-card text-sm font-bold select-none">
      <button onClick={() => onChange(prev.key)} className="hover:opacity-70 transition-opacity px-1">←</button>
      <span className="min-w-[130px] text-center">{current} — {label}</span>
      <button onClick={() => onChange(next.key)} className="hover:opacity-70 transition-opacity px-1">→</button>
    </div>
  )
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function MultiMealProto() {
  const [searchParams, setSearchParams] = useSearchParams()
  const variant = searchParams.get('variant') ?? 'A'

  function setVariant(v) {
    setSearchParams(p => { p.set('variant', v); return p })
  }

  return (
    <>
      <div className="mb-4 px-1">
        <p className="text-xs font-bold tracking-widest uppercase text-garden-patch">Prototype</p>
        <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">This Week</h1>
        <p className="text-xs text-stone-grey mt-0.5">Mon has 2 recipes, Fri has 2 recipes — try adding/removing.</p>
      </div>

      {variant === 'A' && <VariantA />}
      {variant === 'B' && <VariantB />}
      {variant === 'C' && <VariantC />}

      {process.env.NODE_ENV !== 'production' && (
        <PrototypeSwitcher current={variant} onChange={setVariant} />
      )}
    </>
  )
}
