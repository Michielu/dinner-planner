/**
 * Merges recipe ingredients and staple items into a deduplicated suggestion list.
 *
 * Ingredients appear first, then staples (excluding any staple whose name matches
 * an ingredient — case-insensitive). Results are sliced to maxResults.
 *
 * @param {Array<{id: string, name: string, store: string}>} allIngredients
 * @param {Array<{id: string, name: string, store: string, notes?: string|null}>} staples
 * @param {string} query — the text the user typed (must be non-empty)
 * @param {number} maxResults — max suggestions to return (default 8)
 * @returns {Array<{id: string, name: string, store: string, _isStaple: boolean}>}
 */
export function mergeSuggestions(allIngredients, staples, query, maxResults = 8) {
  const q = query.toLowerCase()

  const ingredientMatches = allIngredients
    .filter(i => i.name.toLowerCase().includes(q))
    .map(i => ({ id: i.id, name: i.name, store: i.store, _isStaple: false }))

  const ingredientNames = new Set(allIngredients.map(i => i.name.toLowerCase()))

  const stapleMatches = staples
    .filter(s => s.name.toLowerCase().includes(q) && !ingredientNames.has(s.name.toLowerCase()))
    .map(s => ({ id: s.id, name: s.name, store: s.store, _isStaple: true }))

  return [...ingredientMatches, ...stapleMatches].slice(0, maxResults)
}
