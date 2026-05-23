import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { RecipePicker } from '../components/RecipePicker'
import { GroceryList } from '../components/GroceryList'

const EMPTY_SLOTS = {
  monday: null, tuesday: null, wednesday: null,
  thursday: null, friday: null, saturday: null, sunday: null,
}

export default function PlannerPage() {
  const { recipes, categories, loading } = useRecipes()
  const { staples } = useStaples()

  // phase: 'staples' | 'pantry' | 'planning' | 'grocery'
  const [phase, setPhase] = useState('staples')
  const [selectedStaples, setSelectedStaples] = useState([])
  const [pantryItems, setPantryItems] = useState([])
  const [slots, setSlots] = useState(EMPTY_SLOTS)
  const [activeDay, setActiveDay] = useState(null)

  function handleStaplesNext(chosen) {
    setSelectedStaples(chosen)
    setPhase('pantry')
  }

  function handlePantryStart(items) {
    setPantryItems(items)
    setPhase('planning')
  }

  function handleSlotClick(day) {
    setActiveDay(day)
  }

  function handleSelect(slot) {
    setSlots(prev => ({ ...prev, [activeDay]: slot }))
    setActiveDay(null)
  }

  function handleReset() {
    setSlots(EMPTY_SLOTS)
    setPantryItems([])
    setSelectedStaples([])
    setPhase('staples')
  }

  if (loading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  if (phase === 'staples') return <StapleChecker onNext={handleStaplesNext} />
  if (phase === 'pantry')  return <PantryInput onStart={handlePantryStart} />

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {activeDay && (
        <RecipePicker
          recipes={recipes}
          categories={categories}
          pantryItems={pantryItems.map(i => i.name)}
          onSelect={handleSelect}
          onClose={() => setActiveDay(null)}
          day={activeDay}
        />
      )}

      {phase === 'grocery' && (
        <GroceryList
          slots={slots}
          recipes={recipes}
          staples={selectedStaples}
          onClose={() => setPhase('planning')}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">This Week</h1>
          {pantryItems.length > 0 && (
            <p className="text-sm text-garden-patch mt-0.5 font-bold">
              Using up: {pantryItems.map(i => i.name).join(', ')}
            </p>
          )}
        </div>
        <button onClick={handleReset} className="text-sm text-stone-grey hover:text-soil-shadow font-bold">
          ↺ Start over
        </button>
      </div>

      <WeekGrid slots={slots} onSlotClick={handleSlotClick} />

      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setPhase('grocery')}
          className="bg-fresh-herb text-soil-shadow font-bold px-8 py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
        >
          Generate grocery list →
        </button>
      </div>
    </div>
  )
}
