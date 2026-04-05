import { describe, it, expect } from 'vitest'
import { filterIdsExcluding } from './requirementScopeMerge'

describe('filterIdsExcluding', () => {
  it('removes excluded ids', () => {
    expect(filterIdsExcluding(['a', 'b', 'c'], ['b'])).toEqual(['a', 'c'])
  })

  it('returns input when exclude is empty', () => {
    expect(filterIdsExcluding(['a', 'b'], [])).toEqual(['a', 'b'])
  })

  it('returns empty when all excluded', () => {
    expect(filterIdsExcluding(['x'], ['x'])).toEqual([])
  })
})
