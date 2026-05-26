import { describe, it, expect } from 'vitest'
import { STORES } from '../../src/utils/stores.js'

describe('STORES', () => {
  it('exports an array of 4 stores', () => {
    expect(STORES).toHaveLength(4)
  })

  it('every entry has a value and a label', () => {
    for (const s of STORES) {
      expect(s).toHaveProperty('value')
      expect(s).toHaveProperty('label')
      expect(typeof s.value).toBe('string')
      expect(typeof s.label).toBe('string')
    }
  })

  it('includes "other" as the last entry', () => {
    const last = STORES[STORES.length - 1]
    expect(last.value).toBe('other')
    expect(last.label).toBe('Other')
  })

  it('includes the four stores in order', () => {
    const values = STORES.map(s => s.value)
    expect(values).toEqual(['sams_club', 'aldi', 'target', 'other'])
  })
})
