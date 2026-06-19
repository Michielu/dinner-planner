import { useState, useRef, useEffect } from 'react'
import { mergeSuggestions } from '../utils/ingredientSuggestions'

/**
 * A single ingredient row: name autocomplete + store selector + remove button.
 *
 * Props:
 *   allIngredients: Array<{id, name, store}>
 *   staples: Array<{id, name, store, notes}>
 *   stores: Array<{value, label, sort_order}>
 *   value: {name: string, store: string, existingId: string|null, fromStaple: boolean}
 *   onChange: (value) => void
 *   onRemove: () => void
 */
export function IngredientRow({ allIngredients, staples = [], stores, value, onChange, onRemove }) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleNameChange(e) {
    const text = e.target.value
    onChange({ ...value, name: text, existingId: null, fromStaple: false })

    if (text.length < 1) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }
    const matches = mergeSuggestions(allIngredients, staples, text)
    setSuggestions(matches)
    setShowSuggestions(matches.length > 0)
  }

  function handleSelect(suggestion) {
    if (suggestion._isStaple) {
      onChange({ name: suggestion.name, store: suggestion.store, existingId: null, fromStaple: true })
    } else {
      onChange({ name: suggestion.name, store: suggestion.store, existingId: suggestion.id, fromStaple: false })
    }
    setSuggestions([])
    setShowSuggestions(false)
  }

  return (
    <div className="flex gap-2 items-start" ref={containerRef}>
      <div className="flex-1 relative">
        <input
          value={value.name}
          onChange={handleNameChange}
          onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
          placeholder="Ingredient name"
          className="w-full border border-willow-mist rounded-xl bg-field-cream px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
        />
        {showSuggestions && (
          <ul className="absolute z-10 mt-1 w-full bg-field-cream border border-willow-mist rounded-xl shadow-card text-sm max-h-48 overflow-y-auto">
            {suggestions.map(s => (
              <li
                key={`${s._isStaple ? 's' : 'i'}-${s.id}`}
                onMouseDown={() => handleSelect(s)}
                className="px-3 py-2 hover:bg-willow-mist cursor-pointer flex justify-between items-center"
              >
                <span className="font-bold text-soil-shadow">{s.name}</span>
                <span className="flex items-center gap-1.5">
                  {s._isStaple && (
                    <span className="text-xs text-garden-patch font-bold" title="In your staples list">staple</span>
                  )}
                  <span className="text-stone-grey text-xs">
                    {stores.find(st => st.value === s.store)?.label}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <select
        value={value.store}
        onChange={e => onChange({ ...value, store: e.target.value })}
        className="border border-willow-mist rounded-xl bg-field-cream px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-fresh-herb"
      >
        {stores.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="text-stone-grey hover:text-red-500 px-2 py-2 text-lg leading-none transition-colors"
      >
        &times;
      </button>
    </div>
  )
}
