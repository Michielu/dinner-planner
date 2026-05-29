import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useIngredients() {
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchIngredients = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('ingredients')
      .select('id, name, store')
      .order('name')
    if (!error) setIngredients(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchIngredients() }, [fetchIngredients])

  // Finds or creates an ingredient by name. Returns the ingredient id.
  async function findOrCreate(name, store) {
    const normalised = name.trim().toLowerCase()
    const existing = ingredients.find(i => i.name.toLowerCase() === normalised)
    if (existing) return existing.id

    const { data, error } = await supabase
      .from('ingredients')
      .insert({ name: name.trim(), store })
      .select('id')
      .single()
    if (error) throw error
    await fetchIngredients()
    return data.id
  }

  async function deleteIngredient(id) {
    const { error } = await supabase.from('ingredients').delete().eq('id', id)
    if (error) throw error
    await fetchIngredients()
  }

  async function updateIngredient(id, patch) {
    const { error } = await supabase.from('ingredients').update(patch).eq('id', id)
    if (error) throw error
    await fetchIngredients()
  }

  return { ingredients, loading, findOrCreate, deleteIngredient, updateIngredient, refresh: fetchIngredients }
}
