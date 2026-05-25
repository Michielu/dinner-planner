import { useState } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { PlannerShell } from '../components/PlannerShell'
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

  // phase: 'staples' | 'pantry' | 'plan' | 'grocery'
  const [phase, setPhase] = useState('staples')
  const [visitedPhases, setVisitedPhases] = useState(new Set(['staples']))
  const [selectedStaples, setSelectedStaples] = useState([])
  const [pantryItems, setPantryItems] = useState([])
  const [slots, setSlots] = useState(EMPTY_SLOTS)
  const [activeDay, setActiveDay] = useState(null)

  function navigate(nextPhase) {
    setPhase(nextPhase)
    setVisitedPhases(prev => new Set([...prev, nextPhase]))
    setActiveDay(null) // close recipe picker on tab change
  }

  function handleStaplesNext(chosen) {
    setSelectedStaples(chosen)
    navigate('pantry')
  }

  function handlePantryStart(items) {
    setPantryItems(items)
    navigate('plan')
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
    setActiveDay(null)
    setPhase('staples')
    setVisitedPhases(new Set(['staples']))
  }

  if (loading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <PlannerShell phase={phase} visitedPhases={visitedPhases} onNavigate={navigate}>
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

      {phase === 'staples' && (
        <div className="max-w-md mx-auto p-8">
          <StapleChecker onNext={handleStaplesNext} />
        </div>
      )}

      {phase === 'pantry' && (
        <div className="max-w-md mx-auto p-8">
          <PantryInput onStart={handlePantryStart} />
        </div>
      )}

      {phase === 'plan' && (
        <div className="p-6">
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
              onClick={() => navigate('grocery')}
              className="bg-fresh-herb text-soil-shadow font-bold px-8 py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
            >
              Grocery list →
            </button>
          </div>
        </div>
      )}

      {phase === 'grocery' && (
        <GroceryList
          slots={slots}
          recipes={recipes}
          staples={selectedStaples}
        />
      )}
    </PlannerShell>
  )
}
