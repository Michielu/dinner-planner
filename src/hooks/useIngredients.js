import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useIngredients() {
  const { email } = useAuth()
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchIngredients = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, store')
      .eq('user_email', email)
      .order('name')
    if (!error) setIngredients(data)
    setLoading(false)
  }, [email])

  useEffect(() => { fetchIngredients() }, [fetchIngredients])

  async function findOrCreate(name, store) {
    const normalised = name.trim().toLowerCase()
    const existing = ingredients.find(i => i.name.toLowerCase() === normalised)
    if (existing) return existing.id

    const { data, error } = await supabase
      .from('ingredients')
      .insert({ name: name.trim(), store, user_email: email })
      .select('id')
      .single()
    if (error) throw error
    await fetchIngredients()
    return data.id
  }

  async function deleteIngredient(id) {
    const { error } = await supabase.from('ingredients').delete().eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchIngredients()
  }

  async function updateIngredient(id, patch) {
    const { error } = await supabase.from('ingredients').update(patch).eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchIngredients()
  }

  return { ingredients, loading, findOrCreate, deleteIngredient, updateIngredient, refresh: fetchIngredients }
}
