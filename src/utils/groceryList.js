/**
 * Generates a grocery list grouped by store.
 *
 * @param {Array<{day: string, type: 'recipe'|'eating_out'|'flex', recipeId?: string}>} slots
 * @param {Array<{id: string, name: string, ingredients: Array<{id: string, name: string, store: string}>}>} recipes
 * @param {Array<{id: string, name: string, store: string, notes: string|null}>} staples
 * @param {Array<{id: string, name: string, store: string}>} extras
 * @returns {Record<string, Array>} — one key per store; each holds an array of items
 *   Recipe item:  {name, isStaple: false, isExtra: false, meals: string[]}
 *   Staple item:  {name, isStaple: true,  isExtra: false, notes: string|null}
 *   Extra item:   {name, isStaple: false, isExtra: true,  id: string, meals: []}
 */
export function generateGroceryList(slots, recipes, staples, extras = []) {
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

  const result = { sams_club: [], aldi: [], target: [] }

  for (const item of ingredientMap.values()) {
    result[item.store].push({ name: item.name, isStaple: false, isExtra: false, meals: item.meals })
  }

  for (const staple of staples) {
    result[staple.store].push({ name: staple.name, isStaple: true, isExtra: false, notes: staple.notes ?? null })
  }

  for (const extra of extras) {
    if (!result[extra.store]) result[extra.store] = []
    result[extra.store].push({ name: extra.name, isStaple: false, isExtra: true, id: extra.id, meals: [] })
  }

  return result
}
