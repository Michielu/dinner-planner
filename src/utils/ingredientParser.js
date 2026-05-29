const LEADING_QUANTITY = /^[0-9¼½¾⅓⅔⅛⅙⅕⅜⅝⅞\s\-\.\/⅐-⅞¼-¾]+/
const UNIT = /^(cups?|tbsps?|tsps?|tablespoons?|teaspoons?|fl\.?\s*oz\.?|ounces?|oz\.?|lbs?\.?|pounds?|grams?|\bg\b|kg|ml|millilitres?|milliliters?|litres?|liters?|\bl\b|pinch(?:es)?|dash(?:es)?|slices?|cloves?|heads?|bunches?|sprigs?|cans?|packages?|pkgs?|sticks?|pieces?|pcs?|medium|large|small)\s+/i

/**
 * Strip quantity/unit prefix from a raw ingredient string.
 * "2 cups all-purpose flour, sifted" → "all-purpose flour"
 */
export function parseIngredientName(raw) {
  let s = raw.trim()
  s = s.replace(LEADING_QUANTITY, '').trim()
  s = s.replace(UNIT, '').trim()
  s = s.replace(/^of\s+/i, '').trim()          // "cup of milk" → "milk"
  s = s.replace(/,.*$/, '').trim()              // "flour, sifted" → "flour"
  s = s.replace(/\s*\([^)]*\)/g, '').trim()     // "milk (whole)" → "milk"
  // lowercase first letter for consistency with DB
  if (s.length > 0) s = s[0].toLowerCase() + s.slice(1)
  return s || raw.trim()
}

/**
 * Find existing ingredients/staples that are likely the same thing as parsedName.
 * Uses bidirectional substring match so "all-purpose flour" matches "flour" and vice versa.
 */
export function findMatches(parsedName, ingredients, staples, maxResults = 5) {
  const q = parsedName.toLowerCase().trim()
  if (!q) return []

  const seen = new Set()
  const results = []

  const all = [
    ...ingredients.map(i => ({ ...i, _isStaple: false })),
    ...staples.map(s => ({ ...s, _isStaple: true })),
  ]

  for (const item of all) {
    const name = item.name.toLowerCase()
    if (seen.has(name)) continue
    if (name.includes(q) || q.includes(name)) {
      seen.add(name)
      results.push(item)
      if (results.length >= maxResults) break
    }
  }

  return results
}
