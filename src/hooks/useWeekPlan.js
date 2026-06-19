import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { normalizeSlots } from '../utils/weekPlan'
import { useAuth } from './useAuth'

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

export function useWeekPlan() {
  const { email } = useAuth()
  const [plan, setPlan] = useState(DEFAULTS)
  const [planCreatedAt, setPlanCreatedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const planIdRef = useRef(null)
  const planRef = useRef(DEFAULTS)

  useEffect(() => {
    if (!email) { setLoading(false); return }

    async function load() {
      const { data, error } = await supabase
        .from('week_plan')
        .select('*')
        .eq('user_email', email)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!error && data) {
        planIdRef.current = data.id
        setPlanCreatedAt(data.created_at)
        const loaded = {
          slots: normalizeSlots({ ...EMPTY_SLOTS, ...(data.slots ?? {}) }),
          selectedStapleIds: data.selected_staple_ids ?? [],
          pantryItems: data.pantry_items ?? [],
          addedIngredientIds: data.added_ingredient_ids ?? [],
          phase: VALID_PHASES.includes(data.phase) ? data.phase : 'plan',
          visitedPhases: (data.visited_phases ?? ['staples']).filter(p => VALID_PHASES.includes(p)),
        }
        planRef.current = loaded
        setPlan(loaded)
      }
      setLoading(false)
    }
    load()
  }, [email])

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
      user_email: email,
    }

    if (planIdRef.current) {
      supabase.from('week_plan').update(row).eq('id', planIdRef.current).eq('user_email', email).then(() => {})
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
      await supabase.from('week_plan').delete().eq('id', planIdRef.current).eq('user_email', email)
    }
    planIdRef.current = null
    planRef.current = DEFAULTS
    setPlan(DEFAULTS)
    setPlanCreatedAt(null)
  }

  return { plan, planCreatedAt, loading, updatePlan, resetPlan }
}
