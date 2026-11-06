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
    const favoriteCounts = {}
    if (ids.length > 0) {
      const { data: copies, error: copiesErr } = await supabase
        .from('recipes')
        .select('copied_from_recipe_id, is_favorite')
        .in('copied_from_recipe_id', ids)
      if (copiesErr) { setError(copiesErr); setLoading(false); return }
      copies.forEach(c => {
        const id = c.copied_from_recipe_id
        saveCounts[id] = (saveCounts[id] ?? 0) + 1
        if (c.is_favorite) favoriteCounts[id] = (favoriteCounts[id] ?? 0) + 1
      })
    }

    // favorites = the sharer's own ♥ plus every copy marked ♥; most favorited first, then most saved, then A–Z
    setSharedRecipes(
      data
        .map(r => {
          const favorites = (r.is_favorite ? 1 : 0) + (favoriteCounts[r.id] ?? 0)
          return {
            ...r,
            ingredients: r.recipe_ingredients.map(ri => ri.ingredient).filter(Boolean),
            saves: saveCounts[r.id] ?? 0,
            favorites,
            is_favorite: favorites > 0,
          }
        })
        .sort((a, b) => b.favorites - a.favorites || b.saves - a.saves || a.name.localeCompare(b.name))
    )
    setLoading(false)
  }, [email])

  useEffect(() => { fetchShared() }, [fetchShared])

  return { sharedRecipes, loading, error, refresh: fetchShared }
}
