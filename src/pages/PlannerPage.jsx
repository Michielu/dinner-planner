import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useRecipes } from '../hooks/useRecipes'
import { useStaples } from '../hooks/useStaples'
import { useWeekPlan } from '../hooks/useWeekPlan'
import { useStores } from '../hooks/useStores'
import { resolveSelectedStaples } from '../utils/weekPlan'
import { PlannerShell } from '../components/PlannerShell'
import { StapleChecker } from '../components/StapleChecker'
import { PantryInput } from '../components/PantryInput'
import { WeekGrid } from '../components/WeekGrid'
import { DayDetail } from '../components/DayDetail'

export default function PlannerPage() {
  const navigate = useNavigate()
  const { recipes, categories, loading: recipesLoading } = useRecipes()
  const { staples, loading: staplesLoading } = useStaples()
  const { plan, planCreatedAt, loading: planLoading, updatePlan } = useWeekPlan()
  const { stores, loading: storesLoading } = useStores()

  const [detailDay, setDetailDay] = useState(null)

  const { slots, selectedStapleIds, pantryItems, phase, visitedPhases } = plan

  const resolvedSelectedStapleIds = useMemo(
    () => resolveSelectedStaples(selectedStapleIds, staples, planCreatedAt),
    [selectedStapleIds, staples, planCreatedAt]
  )
  const selectedStaples = staples.filter(s => resolvedSelectedStapleIds.includes(s.id))

  function navigatePlanner(nextPhase) {
    const updatedVisited = visitedPhases.includes(nextPhase)
      ? visitedPhases
      : [...visitedPhases, nextPhase]
    updatePlan({ phase: nextPhase, visitedPhases: updatedVisited })
    setDetailDay(null)
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
    setDetailDay(day)
  }

  // DayDetail: append a new slot to the day's array
  function handleDetailAdd(slot) {
    const dayArr = slots[detailDay] ?? []
    updatePlan({ slots: { ...slots, [detailDay]: [...dayArr, slot] } })
  }

  // DayDetail: remove slot at index; clear day if array empties
  function handleDetailRemove(index) {
    const dayArr = slots[detailDay] ?? []
    const updated = dayArr.filter((_, i) => i !== index)
    updatePlan({ slots: { ...slots, [detailDay]: updated.length ? updated : null } })
    if (updated.length === 0) setDetailDay(null)
  }

  if (recipesLoading || staplesLoading || planLoading || storesLoading) return (
    <div className="p-6 text-stone-grey font-body">Loading…</div>
  )

  return (
    <PlannerShell
      phase={phase}
      visitedPhases={new Set(visitedPhases)}
      onNavigate={navigatePlanner}
    >
      {detailDay && (
        <DayDetail
          day={detailDay}
          slots={slots[detailDay] ?? []}
          recipes={recipes}
          categories={categories}
          pantryItems={pantryItems.map(i => i.name)}
          onAdd={handleDetailAdd}
          onRemove={handleDetailRemove}
          onClose={() => setDetailDay(null)}
        />
      )}

      {phase === 'staples' && (
        <div className="max-w-md mx-auto p-4 sm:p-8">
          <StapleChecker
            stores={stores}
            onNext={handleStaplesNext}
            initialSelected={selectedStaples}
            onToggle={handleStaplesToggle}
          />
        </div>
      )}

      {phase === 'pantry' && (
        <div className="max-w-md mx-auto p-4 sm:p-8">
          <PantryInput stores={stores} onStart={handlePantryStart} initialSelected={pantryItems} />
        </div>
      )}

      {phase === 'plan' && (
        <div className="p-4 sm:p-6">
          <div className="mb-6">
            <h1 className="font-display font-light text-3xl tracking-tight text-soil-shadow">This Week</h1>
            {pantryItems.length > 0 && (
              <p className="text-sm text-garden-patch mt-0.5 font-bold">
                Using up: <span className="uppercase">{pantryItems.map(i => i.name).join(', ')}</span>
              </p>
            )}
          </div>

          <WeekGrid slots={slots} onSlotClick={handleSlotClick} />

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => navigate('/grocery')}
              className="bg-fresh-herb text-soil-shadow font-bold px-8 py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
            >
              Grocery list →
            </button>
          </div>
        </div>
      )}
    </PlannerShell>
  )
}
