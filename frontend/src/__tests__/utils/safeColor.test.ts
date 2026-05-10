import { describe, it, expect } from 'vitest'
import { safeHexColor, safeHexColorTint } from '@/utils/safeColor'

const DEFAULT_FALLBACK = '#3B82F6'

describe('safeHexColor', () => {
  it('returns the input unchanged when given a valid #RRGGBB', () => {
    expect(safeHexColor('#FF0000')).toBe('#FF0000')
    expect(safeHexColor('#abc123')).toBe('#abc123')
  })

  it('returns the input unchanged when given a valid #RRGGBBAA', () => {
    expect(safeHexColor('#FF000080')).toBe('#FF000080')
    expect(safeHexColor('#deadbeef')).toBe('#deadbeef')
  })

  it('rejects 3-char shorthand and returns the default fallback', () => {
    // The current regex requires 6 or 8 hex digits — shorthand is rejected.
    expect(safeHexColor('#fff')).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor('#abc')).toBe(DEFAULT_FALLBACK)
  })

  it('rejects values without a leading hash', () => {
    expect(safeHexColor('FF0000')).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor('ff0000')).toBe(DEFAULT_FALLBACK)
  })

  it('rejects non-hex strings (CSS injection vectors)', () => {
    expect(safeHexColor('red')).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor('url(x)')).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor('rgb(255,0,0)')).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor('javascript:alert(1)')).toBe(DEFAULT_FALLBACK)
  })

  it('rejects non-string inputs', () => {
    expect(safeHexColor(null)).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor(undefined)).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor(123)).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor({})).toBe(DEFAULT_FALLBACK)
    expect(safeHexColor([])).toBe(DEFAULT_FALLBACK)
  })

  it('uses the supplied fallback when input is invalid', () => {
    expect(safeHexColor('not-a-color', '#000000')).toBe('#000000')
    expect(safeHexColor(null, '#FFFFFF')).toBe('#FFFFFF')
  })

  it('rejects empty string', () => {
    expect(safeHexColor('')).toBe(DEFAULT_FALLBACK)
  })

  it('rejects too-long hex strings', () => {
    expect(safeHexColor('#FF000000FF')).toBe(DEFAULT_FALLBACK)
  })
})

describe('safeHexColorTint', () => {
  it('appends 20 (12.5% alpha) to a valid #RRGGBB', () => {
    expect(safeHexColorTint('#FF0000')).toBe('#FF000020')
    expect(safeHexColorTint('#abc123')).toBe('#abc12320')
  })

  it('does not append 20 to an already-8-char #RRGGBBAA', () => {
    // base length is 9 (# + 8 chars), so the conditional skips appending.
    expect(safeHexColorTint('#FF000080')).toBe('#FF000080')
  })

  it('falls back to default + 20 when input is invalid', () => {
    expect(safeHexColorTint('not-a-color')).toBe(`${DEFAULT_FALLBACK}20`)
    expect(safeHexColorTint(null)).toBe(`${DEFAULT_FALLBACK}20`)
  })

  it('uses the supplied fallback (with 20 appended)', () => {
    expect(safeHexColorTint('garbage', '#000000')).toBe('#00000020')
  })

  it('does not append 20 when supplied fallback is already 8 chars', () => {
    expect(safeHexColorTint('garbage', '#000000FF')).toBe('#000000FF')
  })
})
