import { describe, it, expect } from 'vitest'
import { mergeSuggestions } from '../../src/utils/ingredientSuggestions.js'

const INGREDIENTS = [
  { id: 'i1', name: 'ground beef', store: 'sams_club' },
  { id: 'i2', name: 'pasta', store: 'aldi' },
  { id: 'i3', name: 'olive oil', store: 'aldi' },
]

const STAPLES = [
  { id: 's1', name: 'yogurt', store: 'sams_club', notes: 'check if low' },
  { id: 's2', name: 'fruit', store: 'aldi', notes: null },
  { id: 's3', name: 'pasta', store: 'aldi', notes: null }, // same name as ingredient i2
]

describe('mergeSuggestions', () => {
  it('returns ingredient matches with _isStaple: false', () => {
    const result = mergeSuggestions(INGREDIENTS, [], 'beef')
    expect(result).toEqual([
      { id: 'i1', name: 'ground beef', store: 'sams_club', _isStaple: false },
    ])
  })

  it('returns staple matches with _isStaple: true', () => {
    const result = mergeSuggestions([], STAPLES, 'yogurt')
    expect(result).toEqual([
      { id: 's1', name: 'yogurt', store: 'sams_club', _isStaple: true },
    ])
  })

  it('deduplicates: drops staple when ingredient with same name exists, keeps ingredient version', () => {
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'pasta')
    expect(result.filter(r => r.name === 'pasta')).toHaveLength(1)
    expect(result.find(r => r.name === 'pasta')._isStaple).toBe(false)
  })

  it('is case-insensitive for query filtering', () => {
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'BEEF')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('ground beef')
  })

  it('deduplication is case-insensitive', () => {
    const ingredientsUppercase = [{ id: 'i4', name: 'Yogurt', store: 'sams_club' }]
    const result = mergeSuggestions(ingredientsUppercase, STAPLES, 'yogurt')
    const yogurts = result.filter(r => r.name.toLowerCase() === 'yogurt')
    expect(yogurts).toHaveLength(1)
    expect(yogurts[0]._isStaple).toBe(false)
  })

  it('ingredient matches appear before staple matches', () => {
    // 'i' matches: 'olive oil' (ingredient) and 'fruit' (staple, not in ingredients)
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'i')
    const firstStapleIndex = result.findIndex(r => r._isStaple)
    const lastIngredientIndex = result.reduce((acc, r, i) => (!r._isStaple ? i : acc), -1)
    expect(firstStapleIndex).toBeGreaterThan(-1)    // at least one staple result
    expect(lastIngredientIndex).toBeGreaterThan(-1)  // at least one ingredient result
    expect(lastIngredientIndex).toBeLessThan(firstStapleIndex)
  })

  it('respects maxResults', () => {
    const manyIngredients = Array.from({ length: 10 }, (_, i) => ({
      id: `i${i}`, name: `item ${i}`, store: 'aldi',
    }))
    const result = mergeSuggestions(manyIngredients, [], 'item', 3)
    expect(result).toHaveLength(3)
  })

  it('returns empty array when nothing matches query', () => {
    const result = mergeSuggestions(INGREDIENTS, STAPLES, 'zzz')
    expect(result).toEqual([])
  })

  it('returns empty array when both lists are empty', () => {
    const result = mergeSuggestions([], [], 'pasta')
    expect(result).toEqual([])
  })

  it('returns empty array for empty query', () => {
    const result = mergeSuggestions(INGREDIENTS, STAPLES, '')
    expect(result).toEqual([])
  })

  it('applies default maxResults of 8 when not specified', () => {
    const manyIngredients = Array.from({ length: 10 }, (_, i) => ({
      id: `ix${i}`, name: `thing ${i}`, store: 'aldi',
    }))
    const result = mergeSuggestions(manyIngredients, [], 'thing')
    expect(result).toHaveLength(8)
  })
})
