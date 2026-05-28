import { describe, it, expect } from 'vitest'
import { resolveSelectedStaples } from '../../src/utils/weekPlan.js'

const PLAN_CREATED = '2026-05-26T10:00:00.000Z'

const STAPLES = [
  { id: 'a', created_at: '2026-05-25T09:00:00.000Z' }, // before plan
  { id: 'b', created_at: '2026-05-25T09:00:00.000Z' }, // before plan
  { id: 'c', created_at: '2026-05-27T08:00:00.000Z' }, // after plan — auto-check
  { id: 'd', created_at: '2026-05-28T12:00:00.000Z' }, // after plan — auto-check
]

describe('resolveSelectedStaples', () => {
  it('returns persisted IDs unchanged when no new staples exist', () => {
    const result = resolveSelectedStaples(['a'], STAPLES.slice(0, 2), PLAN_CREATED)
    expect(result).toEqual(['a'])
  })

  it('auto-adds staples created after plan started', () => {
    const result = resolveSelectedStaples(['a'], STAPLES, PLAN_CREATED)
    expect(result).toContain('a') // persisted
    expect(result).toContain('c') // new
    expect(result).toContain('d') // new
    expect(result).not.toContain('b') // old, not selected
  })

  it('does not duplicate IDs already in persisted list', () => {
    const result = resolveSelectedStaples(['a', 'c'], STAPLES, PLAN_CREATED)
    expect(result.filter(id => id === 'c').length).toBe(1)
  })

  it('returns persisted IDs as-is when planCreatedAt is null', () => {
    const result = resolveSelectedStaples(['a', 'b'], STAPLES, null)
    expect(result).toEqual(['a', 'b'])
  })

  it('returns empty array when no persisted IDs and no new staples', () => {
    const result = resolveSelectedStaples([], STAPLES.slice(0, 2), PLAN_CREATED)
    expect(result).toEqual([])
  })
})
