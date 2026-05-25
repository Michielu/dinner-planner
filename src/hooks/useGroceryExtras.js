import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useGroceryExtras() {
  const [extras, setExtras] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchExtras = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('grocery_extras')
      .select('id, name, store')
      .order('created_at', { ascending: false })
    if (!error) setExtras(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchExtras() }, [fetchExtras])

  async function addExtra(name, store) {
    const { error } = await supabase
      .from('grocery_extras')
      .insert({ name, store })
    if (error) throw error
    await fetchExtras()
  }

  async function removeExtra(id) {
    const { error } = await supabase.from('grocery_extras').delete().eq('id', id)
    if (error) throw error
    await fetchExtras()
  }

  return { extras, loading, addExtra, removeExtra }
}
