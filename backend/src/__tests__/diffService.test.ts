/**
 * NX-2 (#440) — unit tests for the pure diff primitives in diffService.ts.
 *
 * Covers:
 *   - fieldLevelDiff classification: added / removed / changed / unchanged
 *   - fieldLevelDiff null/array normalisation
 *   - fieldLevelDiff attaches lineDiff only to changed multi-line fields
 *   - lineDiff op sequence: eq / add / del over a line-LCS
 *   - lineDiff edge cases: identical, all-add, all-del, empty
 *
 * Pure functions — no DB, no mocks.
 */
import { describe, it, expect } from 'vitest'
import { fieldLevelDiff, lineDiff } from '../services/diffService'

describe('NX-2 diffService — lineDiff (line-level LCS)', () => {
  it('identical input produces an all-eq op list', () => {
    const ops = lineDiff('line one\nline two', 'line one\nline two')
    expect(ops.map((o) => o.op)).toEqual(['eq', 'eq'])
    expect(ops.map((o) => o.text)).toEqual(['line one', 'line two'])
  })

  it('a changed middle line produces del then add', () => {
    const ops = lineDiff('a\nb\nc', 'a\nB\nc')
    expect(ops.map((o) => o.op)).toEqual(['eq', 'del', 'add', 'eq'])
    expect(ops).toContainEqual({ op: 'del', text: 'b' })
    expect(ops).toContainEqual({ op: 'add', text: 'B' })
  })

  it('an appended line produces a trailing add', () => {
    const ops = lineDiff('a\nb', 'a\nb\nc')
    expect(ops.map((o) => o.op)).toEqual(['eq', 'eq', 'add'])
    expect(ops[2]).toEqual({ op: 'add', text: 'c' })
  })

  it('a removed line produces a del', () => {
    const ops = lineDiff('a\nb\nc', 'a\nc')
    expect(ops.map((o) => o.op)).toEqual(['eq', 'del', 'eq'])
    expect(ops[1]).toEqual({ op: 'del', text: 'b' })
  })

  it('completely different content produces all del then all add', () => {
    const ops = lineDiff('x\ny', 'p\nq')
    const dels = ops.filter((o) => o.op === 'del').map((o) => o.text)
    const adds = ops.filter((o) => o.op === 'add').map((o) => o.text)
    expect(dels).toEqual(['x', 'y'])
    expect(adds).toEqual(['p', 'q'])
    expect(ops.some((o) => o.op === 'eq')).toBe(false)
  })

  it('both-empty input produces a single empty eq op', () => {
    const ops = lineDiff('', '')
    expect(ops).toEqual([{ op: 'eq', text: '' }])
  })
})

describe('NX-2 diffService — fieldLevelDiff (field-level classification)', () => {
  const FIELDS = ['title', 'description', 'priority'] as const

  it('classifies changed / unchanged / added / removed correctly', () => {
    const a = { title: 'Old title', description: '', priority: 'high' }
    const b = { title: 'New title', description: 'now has text', priority: 'high' }
    const result = fieldLevelDiff(a, b, FIELDS)

    const byName = Object.fromEntries(result.map((f) => [f.name, f]))
    expect(byName.title.changeType).toBe('changed')
    expect(byName.title.before).toBe('Old title')
    expect(byName.title.after).toBe('New title')
    expect(byName.description.changeType).toBe('added')
    expect(byName.priority.changeType).toBe('unchanged')
  })

  it('classifies a non-empty -> empty field as removed', () => {
    const result = fieldLevelDiff(
      { title: 'something' },
      { title: '' },
      ['title'],
    )
    expect(result[0].changeType).toBe('removed')
  })

  it('normalises null / undefined to empty string', () => {
    const result = fieldLevelDiff(
      { title: null, description: undefined },
      { title: 'set', description: '' },
      ['title', 'description'],
    )
    expect(result[0].changeType).toBe('added')
    expect(result[0].before).toBe('')
    expect(result[1].changeType).toBe('unchanged')
  })

  it('normalises an array field to a comma-joined string', () => {
    const result = fieldLevelDiff(
      { tags: ['a', 'b'] },
      { tags: ['a', 'b', 'c'] },
      ['tags'],
    )
    expect(result[0].changeType).toBe('changed')
    expect(result[0].before).toBe('a, b')
    expect(result[0].after).toBe('a, b, c')
  })

  it('attaches a lineDiff only to a changed multi-line field', () => {
    const a = { title: 'one-line', description: 'para one\npara two' }
    const b = { title: 'one-line-x', description: 'para one\npara TWO' }
    const result = fieldLevelDiff(a, b, ['title', 'description'], ['description'])

    const byName = Object.fromEntries(result.map((f) => [f.name, f]))
    // title is changed but not in multiLineFields -> no lineDiff
    expect(byName.title.changeType).toBe('changed')
    expect(byName.title.lineDiff).toBeUndefined()
    // description is changed AND multi-line -> carries a lineDiff
    expect(byName.description.changeType).toBe('changed')
    expect(byName.description.lineDiff).toBeDefined()
    expect(byName.description.lineDiff!.map((o) => o.op)).toEqual([
      'eq',
      'del',
      'add',
    ])
  })

  it('does not attach a lineDiff to an unchanged multi-line field', () => {
    const result = fieldLevelDiff(
      { description: 'same\ntext' },
      { description: 'same\ntext' },
      ['description'],
      ['description'],
    )
    expect(result[0].changeType).toBe('unchanged')
    expect(result[0].lineDiff).toBeUndefined()
  })
})
