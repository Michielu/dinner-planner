import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

export function useRecipes() {
  const { email } = useAuth()
  const [recipes, setRecipes] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = useCallback(async () => {
    if (!email) { setLoading(false); return }
    setLoading(true)
    setError(null)

    const [recipesRes, categoriesRes] = await Promise.all([
      supabase
        .from('recipes')
        .select(`
          id, name, source_url, created_at,
          is_favorite, is_quick, is_easy,
          category:meal_categories(id, name),
          recipe_ingredients(
            ingredient:ingredients(id, name, store)
          )
        `)
        .eq('user_email', email)
        .order('name'),
      supabase
        .from('meal_categories')
        .select('id, name, sort_order')
        .eq('user_email', email)
        .order('sort_order'),
    ])

    if (recipesRes.error) { setError(recipesRes.error); setLoading(false); return }
    if (categoriesRes.error) { setError(categoriesRes.error); setLoading(false); return }

    setRecipes(
      recipesRes.data.map(r => ({
        ...r,
        ingredients: r.recipe_ingredients.map(ri => ri.ingredient),
      }))
    )
    setCategories(categoriesRes.data)
    setLoading(false)
  }, [email])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function addRecipe({ name, categoryId, ingredientIds, sourceUrl, isFavorite = false, isQuick = false, isEasy = false }) {
    const { data: recipe, error: recipeErr } = await supabase
      .from('recipes')
      .insert({
        name,
        category_id: categoryId || null,
        source_url: sourceUrl || null,
        is_favorite: isFavorite,
        is_quick: isQuick,
        is_easy: isEasy,
        user_email: email,
      })
      .select('id')
      .single()
    if (recipeErr) throw recipeErr

    if (ingredientIds.length > 0) {
      const { error: joinErr } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientIds.map(ingredient_id => ({ recipe_id: recipe.id, ingredient_id, user_email: email })))
      if (joinErr) throw joinErr
    }
    await fetchAll()
  }

  async function updateRecipe(id, { name, categoryId, ingredientIds, sourceUrl, isFavorite = false, isQuick = false, isEasy = false }) {
    const { error: recipeErr } = await supabase
      .from('recipes')
      .update({
        name,
        category_id: categoryId || null,
        source_url: sourceUrl || null,
        is_favorite: isFavorite,
        is_quick: isQuick,
        is_easy: isEasy,
      })
      .eq('id', id)
      .eq('user_email', email)
    if (recipeErr) throw recipeErr

    const { error: deleteErr } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', id)
    if (deleteErr) throw deleteErr

    if (ingredientIds.length > 0) {
      const { error: joinErr } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientIds.map(ingredient_id => ({ recipe_id: id, ingredient_id, user_email: email })))
      if (joinErr) throw joinErr
    }
    await fetchAll()
  }

  async function deleteRecipe(id) {
    const { error } = await supabase.from('recipes').delete().eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchAll()
  }

  async function toggleFlag(id, field, value) {
    const { error } = await supabase
      .from('recipes')
      .update({ [field]: value })
      .eq('id', id)
      .eq('user_email', email)
    if (error) throw error
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r))
  }

  async function addCategory(name) {
    const maxOrder = categories.reduce((m, c) => Math.max(m, c.sort_order), 0)
    const { error } = await supabase
      .from('meal_categories')
      .insert({ name, sort_order: maxOrder + 1, user_email: email })
    if (error) throw error
    await fetchAll()
  }

  async function deleteCategory(id) {
    const { error } = await supabase.from('meal_categories').delete().eq('id', id).eq('user_email', email)
    if (error) throw error
    await fetchAll()
  }

  return {
    recipes, categories, loading, error,
    addRecipe, updateRecipe, deleteRecipe,
    toggleFlag,
    addCategory, deleteCategory,
    refresh: fetchAll,
  }
}
