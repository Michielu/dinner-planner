import { describe, it, expect } from 'vitest'
import { slugify } from '../../src/utils/slugify.js'

describe('slugify', () => {
  it('lowercases and replaces spaces with underscores', () => {
    expect(slugify('Whole Foods')).toBe('whole_foods')
  })

  it('strips non-alphanumeric characters (except underscores)', () => {
    expect(slugify("Sam's Club")).toBe('sams_club')
  })

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  Aldi  ')).toBe('aldi')
  })

  it('collapses multiple spaces into a single underscore', () => {
    expect(slugify('Trader  Joe')).toBe('trader__joe')
  })

  it('returns the base slug when no collision', () => {
    expect(slugify('Target', ['aldi', 'sams_club'])).toBe('target')
  })

  it('appends _2 on first collision', () => {
    expect(slugify('Aldi', ['aldi'])).toBe('aldi_2')
  })

  it('appends _3 when _2 is also taken', () => {
    expect(slugify('Aldi', ['aldi', 'aldi_2'])).toBe('aldi_3')
  })

  it('works with no existing values argument', () => {
    expect(slugify('Costco')).toBe('costco')
  })
})
