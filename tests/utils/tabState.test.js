import { describe, it, expect } from 'vitest'
import { getTabState } from '../../src/utils/tabState.js'

describe('getTabState', () => {
  it('returns active for the current phase', () => {
    expect(getTabState('plan', 'plan', new Set(['staples', 'pantry', 'plan']))).toBe('active')
  })

  it('returns visited for a phase in visitedPhases that is not current', () => {
    expect(getTabState('staples', 'plan', new Set(['staples', 'pantry', 'plan']))).toBe('visited')
  })

  it('returns unvisited for a phase not in visitedPhases', () => {
    expect(getTabState('grocery', 'plan', new Set(['staples', 'plan']))).toBe('unvisited')
  })

  it('active takes priority over visited (current phase is always in visitedPhases)', () => {
    expect(getTabState('staples', 'staples', new Set(['staples']))).toBe('active')
  })
})
