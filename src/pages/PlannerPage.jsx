import { useState, useMemo } from 'react'
import { useRecipes } from '../hooks/useRecipes'
import { useGroceryExtras } from '../hooks/useGroceryExtras'
import { useStaples } from '../hooks/useStaples'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { RecipePicker } from '../components/RecipePicker'
import { GroceryList } from '../components/GroceryList'

export default function PlannerPage() {
  const { recipes, categories, loading: recipesLoading } = useRecipes()
  const { extras, addExtra, removeExtra } = useGroceryExtras()
  const { staples, loading: staplesLoading } = useStaples()
  const { plan, planCreatedAt, loading: planLoading, updatePlan, resetPlan } = useWeekPlan()

  // Transient UI state — no need to persist
  const [activeDay, setActiveDay] = useState(null)

  const { slots, selectedStapleIds, pantryItems, phase, visitedPhases } = plan

  // Resolve: raw persisted IDs + any staples added after the plan was created.
  // useMemo means this only runs after the loading guard passes (both staples
  // and plan are fully loaded), avoiding the async timing race.
  const resolvedSelectedStapleIds = useMemo(
    () => resolveSelectedStaples(selectedStapleIds, staples, planCreatedAt),
    [selectedStapleIds, staples, planCreatedAt]
  )

  // Full staple objects for StapleChecker and GroceryList
  const selectedStaples = staples.filter(s => resolvedSelectedStapleIds.includes(s.id))

  function navigate(nextPhase) {
    const updatedVisited = visitedPhases.includes(nextPhase)
      ? visitedPhases
      : [...visitedPhases, nextPhase]
    updatePlan({ phase: nextPhase, visitedPhases: updatedVisited })
    setActiveDay(null)
  }

  function handleStaplesNext(chosen) {
    const updatedVisited = visitedPhases.includes('pantry')
      ? visitedPhases
      : [...visitedPhases, 'pantry']
    updatePlan({
      selectedStapleIds: chosen.map(s => s.id),
      phase: 'pantry',
      visitedPhases: updatedVisited,
    })
  }

  function handleStaplesToggle(updatedSelected) {
    updatePlan({ selectedStapleIds: updatedSelected.map(s => s.id) })
  }

  function handlePantryStart(items) {
    const updatedVisited = visitedPhases.includes('plan')
      ? visitedPhases
      : [...visitedPhases, 'plan']
    updatePlan({ pantryItems: items, phase: 'plan', visitedPhases: updatedVisited })
  }

  function handleSlotClick(day) {
    setActiveDay(day)
  }

  function handleSelect(slot) {
    updatePlan({ slots: { ...slots, [activeDay]: slot } })
    setActiveDay(null)
  }

  async function handleReset() {
    await resetPlan()
    setActiveDay(null)
  }

  if (recipesLoading || staplesLoading || planLoading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <PlannerShell
      phase={phase}
      visitedPhases={new Set(visitedPhases)}
      onNavigate={navigate}
      onReset={handleReset}
    >
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
          <StapleChecker
            onNext={handleStaplesNext}
            initialSelected={selectedStaples}
            onToggle={handleStaplesToggle}
          />
        </div>
      )}

      {phase === 'pantry' && (
        <div className="max-w-md mx-auto p-8">
          <PantryInput onStart={handlePantryStart} initialSelected={pantryItems} />
        </div>
      )}

      {phase === 'plan' && (
        <div className="p-6">
          <div className="mb-6">
            <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">This Week</h1>
            {pantryItems.length > 0 && (
              <p className="text-sm text-garden-patch mt-0.5 font-bold">
                Using up: {pantryItems.map(i => i.name).join(', ')}
              </p>
            )}
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
          extras={extras}
          onAddExtra={addExtra}
          onRemoveExtra={removeExtra}
        />
      )}
    </PlannerShell>
  )
}
