export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { url } = req.body ?? {}
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'url is required' })
  }

  // ── Attempt 1: direct fetch + JSON-LD extraction ─────────────────────────
  const direct = await tryDirectFetch(url)
  if (direct.recipe) return res.json(direct.recipe)

  // ── Attempt 2: Jina AI Reader (handles JS-heavy and bot-protected pages) ──
  const jina = await tryJinaReader(url)
  if (jina.recipe) return res.json(jina.recipe)

  // ── Both failed ────────────────────────────────────────────────────────────
  const msg = (direct.status === 403 || jina.blocked)
    ? "This site blocks automated access. Try a different recipe site (AllRecipes, Budget Bytes, Food Network, etc.) or paste the recipe manually."
    : "No recipe data found on this page. Make sure it's a recipe page and try again."

  return res.status(422).json({ error: msg })
}

// ── Direct fetch + JSON-LD ──────────────────────────────────────────────────

async function tryDirectFetch(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      },
    })
    if (!response.ok) return { status: response.status }
    const html = await response.text()
    const recipe = extractFromJsonLd(html)
    return { recipe }
  } catch {
    return {}
  }
}

function extractFromJsonLd(html) {
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
    } catch { /* malformed JSON-LD */ }
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

// ── Jina AI Reader fallback ─────────────────────────────────────────────────

async function tryJinaReader(url) {
  try {
    const response = await fetch(`https://r.jina.ai/${encodeURIComponent(url)}`, {
      headers: {
        'Accept': 'text/plain',
        'X-Return-Format': 'markdown',
      },
    })
    if (!response.ok) return { blocked: response.status === 403 }
    const markdown = await response.text()

    // Jina sometimes includes JSON-LD in a code block — try that first
    const jsonLdBlock = markdown.match(/```(?:json)?\s*(\{[\s\S]*?"@type"[\s\S]*?Recipe[\s\S]*?\})\s*```/i)
    if (jsonLdBlock) {
      try {
        const recipe = findRecipeNode(JSON.parse(jsonLdBlock[1]))
        if (recipe?.recipeIngredient?.length > 0) {
          return {
            recipe: {
              name: recipe.name?.trim() ?? '',
              ingredients: recipe.recipeIngredient.filter(Boolean).map(s => String(s).trim()),
            },
          }
        }
      } catch { /* not valid JSON */ }
    }

    // Fall back to parsing the ingredients section from markdown text
    const recipe = extractFromMarkdown(markdown)
    if (recipe) return { recipe }
    return {}
  } catch {
    return {}
  }
}

function extractFromMarkdown(markdown) {
  // Recipe title: first H1
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const name = titleMatch?.[1]?.replace(/\*+/g, '').trim() ?? ''

  // Ingredients section: lines after "## Ingredients" (or similar headings)
  // until the next heading
  const sectionMatch = markdown.match(
    /##?\s*(?:ingredients?|what you['']?ll need)[^\n]*\n([\s\S]+?)(?=\n##|\n#[^#]|$)/i
  )
  if (!sectionMatch) return null

  const lines = sectionMatch[1]
    .split('\n')
    .map(l => l.replace(/^[-*•▢□▪◦·]\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter(l => l.length > 2 && !/^(##?|ingredient|for the|for\s)/i.test(l))

  if (lines.length === 0) return null
  return { name, ingredients: lines }
}
