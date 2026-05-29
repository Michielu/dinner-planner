export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body ?? {}
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  let html
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!response.ok) {
      return res.status(422).json({ error: `Couldn't fetch that page (HTTP ${response.status}). Check the URL and try again.` })
    }
    html = await response.text()
  } catch {
    return res.status(422).json({ error: 'Failed to reach that URL — check it and try again.' })
  }

  const recipe = extractRecipe(html)
  if (!recipe) {
    return res.status(422).json({
      error: "No recipe data found on this page. Try a recipe from AllRecipes, NYT Cooking, Food Network, Budget Bytes, or similar sites.",
    })
  }

  res.json(recipe)
}

function extractRecipe(html) {
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      const recipe = findRecipeNode(data)
      if (recipe?.recipeIngredient?.length > 0) {
        return {
          name: recipe.name?.trim() ?? '',
          ingredients: recipe.recipeIngredient.filter(Boolean).map(s => String(s).trim()),
        }
      }
    } catch {
      // malformed JSON-LD — skip
    }
  }
  return null
}

function findRecipeNode(data) {
  if (!data || typeof data !== 'object') return null
  const types = [].concat(data['@type'] ?? [])
  if (types.includes('Recipe')) return data
  if (Array.isArray(data['@graph'])) {
    for (const node of data['@graph']) {
      const found = findRecipeNode(node)
      if (found) return found
    }
  }
  return null
}
