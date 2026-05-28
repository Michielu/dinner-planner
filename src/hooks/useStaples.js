import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useStaples() {
  const [staples, setStaples] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStaples = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('staple_items')
      .select('id, name, store, notes, created_at')
      .order('name')
    if (!error) setStaples(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchStaples() }, [fetchStaples])

  async function addStaple({ name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .insert({ name, store, notes: notes || null })
    if (error) throw error
    await fetchStaples()
  }

  async function updateStaple(id, { name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .update({ name, store, notes: notes || null })
      .eq('id', id)
    if (error) throw error
    await fetchStaples()
  }

  async function deleteStaple(id) {
    const { error } = await supabase.from('staple_items').delete().eq('id', id)
    if (error) throw error
    await fetchStaples()
  }

  return { staples, loading, addStaple, updateStaple, deleteStaple }
}
