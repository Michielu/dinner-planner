import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Recipes every user has chosen to share, with how many people have copied each one.
 */
export function useSharedRecipes() {
  const { email } = useAuth()
  const [sharedRecipes, setSharedRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchShared = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const { data, error: sharedErr } = await supabase
      .from('recipes')
      .select(`
        id, name, source_url, user_email,
        is_favorite, is_quick, is_easy,
        category:meal_categories(id, name),
        recipe_ingredients(
          ingredient:ingredients(id, name, store)
        )
      `)
      .eq('is_shared', true)
      .order('name')
    if (sharedErr) { setError(sharedErr); setLoading(false); return }

    const ids = data.map(r => r.id)
    const saveCounts = {}
    if (ids.length > 0) {
      const { data: copies, error: copiesErr } = await supabase
        .from('recipes')
        .select('copied_from_recipe_id')
        .in('copied_from_recipe_id', ids)
      if (copiesErr) { setError(copiesErr); setLoading(false); return }
      copies.forEach(c => {
        saveCounts[c.copied_from_recipe_id] = (saveCounts[c.copied_from_recipe_id] ?? 0) + 1
      })
    }

    setSharedRecipes(
      data.map(r => ({
        ...r,
        ingredients: r.recipe_ingredients.map(ri => ri.ingredient).filter(Boolean),
        saves: saveCounts[r.id] ?? 0,
      }))
    )
    setLoading(false)
  }, [email])

  useEffect(() => { fetchShared() }, [fetchShared])

  return { sharedRecipes, loading, error, refresh: fetchShared }
}
