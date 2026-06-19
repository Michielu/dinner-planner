import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { slugify } from '../utils/slugify'
import { useAuth } from './useAuth'

export function useStores() {
  const { email } = useAuth()
  const [stores, setStores] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchStores = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('stores')
      .select('id, value, label, sort_order')
      .eq('user_email', email)
      .order('sort_order')
    if (!error) setStores(data)
    setLoading(false)
  }, [email])

  useEffect(() => { fetchStores() }, [fetchStores])

  async function addStore({ label }) {
    const value = slugify(label, stores.map(s => s.value))
    const sort_order = stores.length > 0
      ? Math.max(...stores.map(s => s.sort_order)) + 1
      : 0
    const { error } = await supabase
      .from('stores')
      .insert({ value, label: label.trim(), sort_order, user_email: email })
    if (error) throw error
    await fetchStores()
  }

  async function deleteStore(value) {
    const { count: ingCount } = await supabase
      .from('ingredients')
      .select('*', { count: 'exact', head: true })
      .eq('store', value)
      .eq('user_email', email)

    const { count: stapleCount } = await supabase
      .from('staple_items')
      .select('*', { count: 'exact', head: true })
      .eq('store', value)
      .eq('user_email', email)

    if ((ingCount ?? 0) > 0 || (stapleCount ?? 0) > 0) {
      throw { inUse: true }
    }

    const { error } = await supabase
      .from('stores')
      .delete()
      .eq('value', value)
      .eq('user_email', email)
    if (error) throw error
    await fetchStores()
  }

  return { stores, loading, addStore, deleteStore }
}
