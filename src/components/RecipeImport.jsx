import { useState } from 'react'
import { useIngredients } from '../hooks/useIngredients'
import { parseIngredientName, findMatches, preprocessPaste } from '../utils/ingredientParser'

/**
 * Props:
 *   categories: Array<{id, name}>
 *   staples: Array<{id, name, store}>
 *   stores: Array<{value, label}>
 *   addRecipe: ({name, categoryId, ingredientIds}) => Promise<void>
 *   onDone: () => void
 *   onCancel: () => void
 */
export function RecipeImport({ categories, staples, stores, addRecipe, onDone, onCancel }) {
  const { ingredients, loading: ingredientsLoading, findOrCreate } = useIngredients()

  const [phase, setPhase] = useState('url') // 'url' | 'loading' | 'review'
  const [url, setUrl] = useState('')
  const [fetchError, setFetchError] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [pasteName, setPasteName] = useState('')
  const [recipeName, setRecipeName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [rows, setRows] = useState([])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  function buildRows(rawIngredients) {
    return rawIngredients.map(raw => {
      const name = parseIngredientName(raw)
      const matches = findMatches(name, ingredients, staples)
      const best = matches[0] ?? null
      return {
        raw,
        name,
        mode: best ? 'match' : 'new',
        matchId: best?.id ?? null,
        matchIsStaple: best?._isStaple ?? false,
        store: best?.store ?? 'aldi',
        matches,
        editOpen: false,
      }
    })
  }

  async function handleScrape(e) {
    e.preventDefault()
    if (!url.trim()) return
    setFetchError('')
    setPhase('loading')
    try {
      const res = await fetch('/api/scrape-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to scrape recipe')
      setRecipeName(data.name)
      setRows(buildRows(data.ingredients))
      setPhase('review')
    } catch (err) {
      setFetchError(err.message)
      setPhase('url')
    }
  }

  function handlePasteReview(e) {
    e.preventDefault()
    const lines = preprocessPaste(pasteText)
    if (lines.length === 0) return
    setRecipeName(pasteName)
    setRows(buildRows(lines))
    setPhase('review')
  }

  function updateRow(i, patch) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  function removeRow(i) {
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleMatchChange(i, value) {
    if (value === '__new__') {
      updateRow(i, { mode: 'new', matchId: null, matchIsStaple: false, editOpen: false })
    } else {
      const m = rows[i].matches.find(m => m.id === value)
      updateRow(i, {
        mode: 'match',
        matchId: value,
        matchIsStaple: m?._isStaple ?? false,
        store: m?.store ?? 'aldi',
        editOpen: false,
      })
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!recipeName.trim()) return
    setSaving(true)
    setSaveError('')
    try {
      const ingredientIds = await Promise.all(
        rows.map(async row => {
          if (row.mode === 'match' && row.matchId) {
            if (row.matchIsStaple) {
              // Staples live in a different table — create a matching ingredient entry
              const match = row.matches.find(m => m.id === row.matchId)
              return findOrCreate(match.name, match.store)
            }
            return row.matchId
          }
          return findOrCreate(row.name.trim() || row.raw, row.store)
        })
      )
      await addRecipe({
        name: recipeName.trim(),
        categoryId: categoryId || null,
        ingredientIds: [...new Set(ingredientIds)],
      })
      onDone()
    } catch {
      setSaveError("Couldn't save the recipe — try again")
      setSaving(false)
    }
  }

  // ── URL / loading phase ───────────────────────────────────────────────────
  if (phase === 'url' || phase === 'loading') {
    return (
      <div className="bg-willow-mist rounded-card p-5 mb-6 shadow-card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-soil-shadow">Import Recipe</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-grey text-sm font-bold hover:text-soil-shadow transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* URL import */}
        <form onSubmit={handleScrape} className="flex gap-2 flex-wrap">
          <input
            value={url}
            onChange={e => { setUrl(e.target.value); setFetchError('') }}
            placeholder="Paste a recipe URL…"
            disabled={phase === 'loading'}
            className="flex-1 min-w-60 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={phase === 'loading' || ingredientsLoading || !url.trim()}
            className="bg-fresh-herb text-soil-shadow font-bold px-5 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
          >
            {phase === 'loading' ? 'Fetching…' : ingredientsLoading ? 'Loading…' : 'Import'}
          </button>
        </form>

        {fetchError && <p className="text-sm text-red-500">{fetchError}</p>}

        {/* Divider */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex-1 border-t border-stone-grey/20" />
          <span className="text-xs text-stone-grey font-bold">or paste ingredients</span>
          <div className="flex-1 border-t border-stone-grey/20" />
        </div>

        {/* Paste */}
        <form onSubmit={handlePasteReview} className="space-y-3">
          <input
            value={pasteName}
            onChange={e => setPasteName(e.target.value)}
            placeholder="Recipe name"
            className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"2 cups flour\n1 tsp salt\n1/2 cup butter, softened\n…"}
            rows={5}
            className="w-full border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb resize-none font-mono"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!pasteText.trim()}
              className="bg-fresh-herb text-soil-shadow font-bold px-6 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
            >
              Review →
            </button>
          </div>
        </form>
      </div>
    )
  }

  // ── Review phase ──────────────────────────────────────────────────────────
  const matchedRows = rows.map((r, i) => ({ ...r, i })).filter(r => r.mode === 'match')
  const newRows = rows.map((r, i) => ({ ...r, i })).filter(r => r.mode === 'new')

  return (
    <div className="bg-willow-mist rounded-card p-5 mb-6 shadow-card">
      <h2 className="font-bold text-soil-shadow mb-5">Review Recipe</h2>
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Name + category */}
        <div className="flex gap-3 flex-wrap">
          <input
            value={recipeName}
            onChange={e => setRecipeName(e.target.value)}
            placeholder="Recipe name"
            className="flex-1 min-w-48 border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
          />
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="border border-willow-mist rounded-2xl bg-field-cream px-4 py-2.5 text-sm focus:outline-none"
          >
            <option value="">No category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {/* Using existing */}
        {matchedRows.length > 0 && (
          <div>
            <p className="text-xs font-bold text-stone-grey uppercase tracking-wide mb-2">
              Using existing ({matchedRows.length})
            </p>
            <ul className="space-y-1.5">
              {matchedRows.map(row => {
                const matchedItem = row.matches.find(m => m.id === row.matchId)
                const storeName = stores.find(s => s.value === row.store)?.label ?? row.store
                return (
                  <li key={row.i} className="bg-field-cream rounded-2xl px-4 py-2.5 flex items-center gap-3 flex-wrap text-sm">
                    <span className="text-stone-grey flex-1 min-w-24 truncate">{row.name}</span>
                    {row.editOpen ? (
                      <select
                        autoFocus
                        value={row.matchId ?? '__new__'}
                        onChange={e => handleMatchChange(row.i, e.target.value)}
                        onBlur={() => updateRow(row.i, { editOpen: false })}
                        className="border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none"
                      >
                        {row.matches.map(m => (
                          <option key={m.id} value={m.id}>
                            {m._isStaple ? '★ ' : ''}{m.name} · {stores.find(s => s.value === m.store)?.label}
                          </option>
                        ))}
                        <option value="__new__">Add as new ingredient…</option>
                      </select>
                    ) : (
                      <>
                        <span className="font-bold text-garden-patch">
                          ✓ {matchedItem?.name ?? row.name}{row.matchIsStaple ? ' ★' : ''}
                        </span>
                        <span className="text-xs text-stone-grey">{storeName}</span>
                        <button
                          type="button"
                          onClick={() => updateRow(row.i, { editOpen: true })}
                          className="text-xs text-stone-grey hover:text-garden-patch font-bold transition-colors ml-auto"
                        >
                          edit
                        </button>
                        <button
                          type="button"
                          onClick={() => removeRow(row.i)}
                          className="text-stone-grey hover:text-red-500 font-bold text-sm transition-colors shrink-0"
                          aria-label="Remove ingredient"
                        >
                          ×
                        </button>
                      </>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* Adding new */}
        {newRows.length > 0 && (
          <div>
            <p className="text-xs font-bold text-stone-grey uppercase tracking-wide mb-2">
              Adding new ({newRows.length})
            </p>
            <ul className="space-y-1.5">
              {newRows.map(row => (
                <li key={row.i} className="bg-field-cream rounded-2xl px-4 py-2.5 flex items-center gap-2 flex-wrap">
                  <input
                    value={row.name}
                    onChange={e => updateRow(row.i, { name: e.target.value })}
                    className="flex-1 min-w-28 border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
                  />
                  <select
                    value={row.store}
                    onChange={e => updateRow(row.i, { store: e.target.value })}
                    className="border border-willow-mist rounded-xl bg-willow-mist px-3 py-1.5 text-sm focus:outline-none"
                  >
                    {stores.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                  {/* If there are potential matches the auto-matcher missed, surface them */}
                  {row.matches.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const best = row.matches[0]
                        updateRow(row.i, {
                          mode: 'match',
                          matchId: best.id,
                          matchIsStaple: best._isStaple,
                          store: best.store,
                        })
                      }}
                      className="text-xs text-garden-patch font-bold hover:underline whitespace-nowrap"
                    >
                      ← use "{row.matches[0].name}"
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeRow(row.i)}
                    className="text-stone-grey hover:text-red-500 font-bold text-sm transition-colors ml-auto shrink-0"
                    aria-label="Remove ingredient"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {saveError && <p className="text-sm text-red-500">{saveError}</p>}

        <div className="flex gap-3 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="text-stone-grey text-sm font-bold px-3 hover:text-soil-shadow transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !recipeName.trim()}
            className="bg-fresh-herb text-soil-shadow font-bold px-6 py-2.5 rounded-pill shadow-card hover:opacity-90 transition-opacity text-sm disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Recipe →'}
          </button>
        </div>
      </form>
    </div>
  )
}
