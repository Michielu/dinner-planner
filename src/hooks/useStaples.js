import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useStaples() {
  const { email } = useAuth()
  const [staples, setStaples] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStaples = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('staple_items')
      .select('id, name, store, notes, created_at')
      .eq('user_email', email)
      .order('name')
    if (!error) setStaples(data)
    setLoading(false)
  }, [email])

  useEffect(() => { fetchStaples() }, [fetchStaples])

  async function addStaple({ name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .insert({ name, store, notes: notes || null, user_email: email })
    if (error) throw error
    await fetchStaples()
  }

  async function updateStaple(id, { name, store, notes }) {
    const { error } = await supabase
      .from('staple_items')
      .update({ name, store, notes: notes || null })
      .eq('id', id)
      .eq('user_email', email)
    if (error) throw error
    await fetchStaples()
  }

  async function deleteStaple(id) {
    const { error } = await supabase.from('staple_items').delete().eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchStaples()
  }

  return { staples, loading, addStaple, updateStaple, deleteStaple }
}
