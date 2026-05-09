import { describe, it, expect } from 'vitest'
import { csvSafeValue, csvSafeField, csvSafeRow, csvSafeRows } from '@/utils/csvExport'

describe('csvSafeValue', () => {
  it('returns empty string for null and undefined', () => {
    expect(csvSafeValue(null)).toBe('')
    expect(csvSafeValue(undefined)).toBe('')
  })

  it('passes plain strings through unchanged', () => {
    expect(csvSafeValue('hello')).toBe('hello')
    expect(csvSafeValue('Requirement 1')).toBe('Requirement 1')
  })

  it('coerces numbers and booleans via String()', () => {
    expect(csvSafeValue(42)).toBe('42')
    expect(csvSafeValue(0)).toBe('0')
    expect(csvSafeValue(true)).toBe('true')
    expect(csvSafeValue(false)).toBe('false')
  })

  it('prefixes formula triggers with apostrophe', () => {
    expect(csvSafeValue('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvSafeValue('+1')).toBe("'+1")
    expect(csvSafeValue('-2')).toBe("'-2")
    expect(csvSafeValue('@cmd')).toBe("'@cmd")
    expect(csvSafeValue('\tinjected')).toBe("'\tinjected")
    expect(csvSafeValue('\rinjected')).toBe("'\rinjected")
  })

  it('does not prefix when trigger is not the first character', () => {
    expect(csvSafeValue('a=b')).toBe('a=b')
    expect(csvSafeValue('val+x')).toBe('val+x')
  })
})

describe('csvSafeField', () => {
  it('passes plain values through with no quoting', () => {
    expect(csvSafeField('hello')).toBe('hello')
    expect(csvSafeField(42)).toBe('42')
  })

  it('quotes values containing comma', () => {
    expect(csvSafeField('a,b')).toBe('"a,b"')
  })

  it('quotes values containing newline', () => {
    expect(csvSafeField('a\nb')).toBe('"a\nb"')
    expect(csvSafeField('a\rb')).toBe('"a\rb"')
  })

  it('quotes values containing quote and doubles internal quotes (RFC 4180)', () => {
    expect(csvSafeField('say "hi"')).toBe('"say ""hi"""')
  })

  it('combines formula neutralisation with quoting', () => {
    // =A,B has both a formula trigger AND a comma — both treatments apply.
    expect(csvSafeField('=A,B')).toBe('"\'=A,B"')
  })

  it('handles null/undefined as empty string', () => {
    expect(csvSafeField(null)).toBe('')
    expect(csvSafeField(undefined)).toBe('')
  })
})

describe('csvSafeRow', () => {
  it('neutralises string values per key', () => {
    const out = csvSafeRow({ a: '=danger', b: 'safe', c: '+inject' })
    expect(out).toEqual({ a: "'=danger", b: 'safe', c: "'+inject" })
  })

  it('preserves null/undefined/number/boolean as-is', () => {
    const out = csvSafeRow({ a: 1, b: true, c: null, d: undefined, e: false })
    expect(out).toEqual({ a: 1, b: true, c: null, d: undefined, e: false })
  })

  it('neutralises strings inside arrays, leaves non-strings alone', () => {
    const out = csvSafeRow({ tags: ['=evil', 'fine', 42, null] })
    expect(out.tags).toEqual(["'=evil", 'fine', 42, null])
  })

  it('stringifies and neutralises complex objects', () => {
    const out = csvSafeRow({ meta: { x: 1 } })
    // JSON.stringify produces '{"x":1}' which does not start with a trigger char
    expect(out.meta).toBe('{"x":1}')
  })
})

describe('csvSafeRows', () => {
  it('maps csvSafeRow over an array', () => {
    const rows = [
      { name: '=evil', n: 1 },
      { name: 'good', n: 2 },
    ]
    const out = csvSafeRows(rows)
    expect(out).toEqual([
      { name: "'=evil", n: 1 },
      { name: 'good', n: 2 },
    ])
  })

  it('returns an empty array when input is empty', () => {
    expect(csvSafeRows([])).toEqual([])
  })
})
