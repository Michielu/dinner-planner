import { useState } from 'react'
import { useStaples } from '../hooks/useStaples'

const STORES = [
  { value: 'sams_club', label: "Sam's Club" },
  { value: 'aldi', label: 'Aldi' },
  { value: 'target', label: 'Target' },
]

/**
 * Props:
 *   onNext: (selectedStaples: Array<{id, name, store, notes}>) => void
 */
export function StapleChecker({ onNext }) {
  const { staples, addStaple } = useStaples()
  const [selected, setSelected] = useState([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newStore, setNewStore] = useState('aldi')
  const [saving, setSaving] = useState(false)

  function isSelected(id) {
    return selected.some(s => s.id === id)
  }

  function toggle(staple) {
    setSelected(prev =>
      isSelected(staple.id)
        ? prev.filter(s => s.id !== staple.id)
        : [...prev, staple]
    )
  }

  async function handleAddNew(e) {
    e.preventDefault()
    if (!newName.trim()) return
    setSaving(true)
    try {
      await addStaple({ name: newName.trim(), store: newStore, notes: null })
      setNewName('')
      setNewStore('aldi')
      setAdding(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16 bg-willow-mist rounded-card p-8 shadow-card">
      <p className="text-xs font-bold tracking-widest uppercase text-garden-patch mb-1">Step 1 of 2</p>
      <h2 className="font-display font-light text-3xl tracking-tight text-soil-shadow mb-1">Staple check</h2>
      <p className="text-sm text-stone-grey mb-6">Check off what you need this week.</p>

      <div className="bg-field-cream rounded-2xl overflow-hidden mb-5 max-h-72 overflow-y-auto">
        {staples.length === 0 && !adding && (
          <p className="px-4 py-4 text-sm text-stone-grey">No staples yet — add some below.</p>
        )}
        {staples.map(staple => (
          <button
            key={staple.id}
            onClick={() => toggle(staple)}
            className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm border-b border-willow-mist last:border-0 transition-colors ${
              isSelected(staple.id) ? 'bg-fresh-herb/20' : 'hover:bg-willow-mist/50'
            }`}
          >
            <div>
              <span className="font-bold text-soil-shadow">{staple.name}</span>
              <span className="text-xs text-stone-grey ml-2">{STORES.find(s => s.value === staple.store)?.label}</span>
              {staple.notes && <span className="text-xs text-stone-grey ml-1">— {staple.notes}</span>}
            </div>
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center text-xs shrink-0 transition-colors ${
              isSelected(staple.id) ? 'bg-fresh-herb border-fresh-herb text-soil-shadow' : 'border-stone-grey/40'
            }`}>
              {isSelected(staple.id) && '✓'}
            </div>
          </button>
        ))}

        {!adding ? (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-garden-patch font-bold hover:bg-willow-mist/50 transition-colors"
          >
            + Add new staple
          </button>
        ) : (
          <form onSubmit={handleAddNew} className="px-4 py-3 flex gap-2 bg-fresh-herb/10">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Staple name"
              className="flex-1 border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none focus:ring-2 focus:ring-fresh-herb"
            />
            <select
              value={newStore}
              onChange={e => setNewStore(e.target.value)}
              className="border border-willow-mist rounded-lg px-2 py-1.5 text-sm bg-field-cream focus:outline-none"
            >
              {STORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button type="submit" disabled={saving} className="bg-fresh-herb text-soil-shadow font-bold px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
              {saving ? '…' : 'Add'}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-stone-grey px-2 text-sm">Cancel</button>
          </form>
        )}
      </div>

      <button
        onClick={() => onNext(selected)}
        className="w-full bg-fresh-herb text-soil-shadow font-bold py-3 rounded-pill shadow-card hover:opacity-90 transition-opacity"
      >
        Next: Pantry →
      </button>
      <button
        onClick={() => onNext([])}
        className="w-full mt-2 text-stone-grey text-sm hover:text-soil-shadow"
      >
        Skip — no staples this week
      </button>
    </div>
  )
}
