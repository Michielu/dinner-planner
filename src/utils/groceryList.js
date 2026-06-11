import { STORES } from './stores.js'

/**
 * Generates a grocery list grouped by store.
 *
 * @param {Array<{day: string, type: 'recipe'|'eating_out'|'flex', recipeId?: string}>} slots
 * @param {Array<{id: string, name: string, ingredients: Array<{id: string, name: string, store: string}>}>} recipes
 * @param {Array<{id: string, name: string, store: string, notes: string|null}>} staples
 * @param {Array<{id: string, name: string, store: string}>} addedIngredients
 * @returns {Record<string, Array>} — one key per store; each holds an array of items
 *   Recipe item:  {name, isStaple: false, isAdded: false, meals: string[]}
 *   Staple item:  {name, isStaple: true,  isAdded: false, notes: string|null}
 *   Added item:   {name, isStaple: false, isAdded: true,  id: string}
 */
export function generateGroceryList(slots, recipes, staples, addedIngredients = []) {
  const recipeMap = new Map(recipes.map(r => [r.id, r]))

  // ingredient id → {name, store, meals: string[]}
  const ingredientMap = new Map()

  for (const slot of slots) {
    if (slot.type !== 'recipe' || !slot.recipeId) continue
    const recipe = recipeMap.get(slot.recipeId)
    if (!recipe) continue
    for (const ing of recipe.ingredients) {
      if (!ingredientMap.has(ing.id)) {
        ingredientMap.set(ing.id, { name: ing.name, store: ing.store, meals: [] })
      }
      const entry = ingredientMap.get(ing.id)
      if (!entry.meals.includes(recipe.name)) {
        entry.meals.push(recipe.name)
      }
    }
  }

  const result = Object.fromEntries(STORES.map(s => [s.value, []]))

  for (const item of ingredientMap.values()) {
    if (!result[item.store]) result[item.store] = []
    result[item.store].push({ name: item.name, isStaple: false, isAdded: false, meals: item.meals })
  }

  for (const staple of staples) {
    if (!result[staple.store]) result[staple.store] = []
    result[staple.store].push({ id: staple.id, name: staple.name, isStaple: true, isAdded: false, notes: staple.notes ?? null })
  }

  for (const ing of addedIngredients) {
    if (!result[ing.store]) result[ing.store] = []
    result[ing.store].push({ name: ing.name, isStaple: false, isAdded: true, id: ing.id })
  }

  for (const store of Object.keys(result)) {
    result[store].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  }

  return result
}
