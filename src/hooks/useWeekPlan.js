import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const EMPTY_SLOTS = {
  monday: null, tuesday: null, wednesday: null,
  thursday: null, friday: null, saturday: null, sunday: null,
}

const DEFAULTS = {
  slots: EMPTY_SLOTS,
  selectedStapleIds: [],
  pantryItems: [],
  phase: 'staples',
  visitedPhases: ['staples'],
}

/**
 * Owns the persisted week-plan state.
 *
 * Does NOT resolve auto-checked staples — that's done in PlannerPage using
 * resolveSelectedStaples(plan.selectedStapleIds, staples, planCreatedAt) after
 * both the plan and staples have finished loading.
 *
 * @returns {{ plan, planCreatedAt, loading, updatePlan, resetPlan }}
 *   plan: { slots, selectedStapleIds (raw), pantryItems, phase, visitedPhases }
 *   planCreatedAt: ISO string | null
 *   updatePlan(patch) — shallow-merges patch and upserts to Supabase (optimistic)
 *   resetPlan() — deletes the DB row and resets local state to DEFAULTS
 */
export function useWeekPlan() {
  const [plan, setPlan] = useState(DEFAULTS)
  const [planCreatedAt, setPlanCreatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  // Refs avoid stale-closure bugs in updatePlan/resetPlan
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
          phase: data.phase ?? 'staples',
          visitedPhases: data.visited_phases ?? ['staples'],
        }
        planRef.current = loaded
        setPlan(loaded)
      }
      setLoading(false)
    }
    load()
  }, []) // runs once on mount

  async function updatePlan(patch) {
    const next = { ...planRef.current, ...patch }
    planRef.current = next
    setPlan(next)

    const row = {
      slots: next.slots,
      selected_staple_ids: next.selectedStapleIds,
      pantry_items: next.pantryItems,
      phase: next.phase,
      visited_phases: next.visitedPhases,
      updated_at: new Date().toISOString(),
    }

    if (planIdRef.current) {
      // fire-and-forget update
      supabase.from('week_plan').update(row).eq('id', planIdRef.current).then(() => {})
    } else {
      // first write — insert and capture the new ID + created_at
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
