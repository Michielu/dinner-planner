import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_SLOTS = {
  monday: null, tuesday: null, wednesday: null,
  thursday: null, friday: null, saturday: null, sunday: null,
}

const VALID_PHASES = ['staples', 'pantry', 'plan']

const DEFAULTS = {
  slots: EMPTY_SLOTS,
  selectedStapleIds: [],
  pantryItems: [],
  addedIngredientIds: [],
  phase: 'staples',
  visitedPhases: ['staples'],
}

/**
 * Owns the persisted week-plan state.
 *
 * @returns {{ plan, planCreatedAt, loading, updatePlan, resetPlan }}
 *   plan: { slots, selectedStapleIds, pantryItems, addedIngredientIds, phase, visitedPhases }
 *   planCreatedAt: ISO string | null
 *   updatePlan(patch) — shallow-merges patch and upserts to Supabase (optimistic)
 *   resetPlan() — deletes the DB row and resets local state to DEFAULTS
 */
export function useWeekPlan() {
  const [plan, setPlan] = useState(DEFAULTS)
  const [planCreatedAt, setPlanCreatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const planIdRef = useRef(null)
  const planRef = useRef(DEFAULTS)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('week_plan')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        planIdRef.current = data.id
        setPlanCreatedAt(data.created_at)
        const loaded = {
          slots: { ...EMPTY_SLOTS, ...(data.slots ?? {}) },
          selectedStapleIds: data.selected_staple_ids ?? [],
          pantryItems: data.pantry_items ?? [],
          addedIngredientIds: data.added_ingredient_ids ?? [],
          // normalize stale 'grocery' phase from old persisted data
          phase: VALID_PHASES.includes(data.phase) ? data.phase : 'plan',
          visitedPhases: (data.visited_phases ?? ['staples']).filter(p => VALID_PHASES.includes(p)),
        }
        planRef.current = loaded
        setPlan(loaded)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function updatePlan(patch) {
    const next = { ...planRef.current, ...patch }
    planRef.current = next
    setPlan(next)

    const row = {
      slots: next.slots,
      selected_staple_ids: next.selectedStapleIds,
      pantry_items: next.pantryItems,
      added_ingredient_ids: next.addedIngredientIds,
      phase: next.phase,
      visited_phases: next.visitedPhases,
      updated_at: new Date().toISOString(),
    }

    if (planIdRef.current) {
      supabase.from('week_plan').update(row).eq('id', planIdRef.current).then(() => {})
    } else {
      const { data } = await supabase
        .from('week_plan')
        .insert(row)
        .select('id, created_at')
        .single()
      if (data) {
        planIdRef.current = data.id
        setPlanCreatedAt(data.created_at)
      }
    }
  }

  async function resetPlan() {
    if (planIdRef.current) {
      await supabase.from('week_plan').delete().eq('id', planIdRef.current)
    }
    planIdRef.current = null
    planRef.current = DEFAULTS
    setPlan(DEFAULTS)
    setPlanCreatedAt(null)
  }

  return { plan, planCreatedAt, loading, updatePlan, resetPlan }
}
