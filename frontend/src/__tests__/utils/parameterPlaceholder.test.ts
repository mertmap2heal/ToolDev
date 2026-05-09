import { describe, it, expect } from 'vitest'
import {
  resolveParameterPlaceholders,
  extractParameterIds,
  toPlaceholder,
  placeholdersToEditorSpans,
  editorSpansToPlaceholders,
  type ParameterResolveEntry,
} from '@/utils/parameterPlaceholder'

const ID_A = '11111111-1111-1111-1111-111111111111'
const ID_B = '22222222-2222-2222-2222-222222222222'

function makeMap(entries: ParameterResolveEntry[]): Map<string, ParameterResolveEntry> {
  const m = new Map<string, ParameterResolveEntry>()
  for (const e of entries) m.set(e.id, e)
  return m
}

describe('toPlaceholder', () => {
  it('formats a parameter id into the canonical placeholder', () => {
    expect(toPlaceholder(ID_A)).toBe(`{{param:${ID_A}}}`)
  })
})

describe('resolveParameterPlaceholders', () => {
  const params = makeMap([
    { id: ID_A, name: 'voltage', defaultValue: '5', unit: 'V' },
    {
      id: ID_B,
      name: 'pressure',
      defaultValue: '100',
      unit: 'kPa',
      tolerance: '5',
    },
  ])

  it('returns empty string for empty input', () => {
    expect(resolveParameterPlaceholders('', params, 'name')).toBe('')
  })

  it('replaces placeholders with parameter name in name mode', () => {
    expect(
      resolveParameterPlaceholders(`Set {{param:${ID_A}}} now`, params, 'name')
    ).toBe('Set voltage now')
  })

  it('replaces placeholders with resolved value in resolved mode', () => {
    expect(
      resolveParameterPlaceholders(`{{param:${ID_A}}}`, params, 'resolved')
    ).toBe('5 V')
  })

  it('includes tolerance and unit when present', () => {
    expect(
      resolveParameterPlaceholders(`{{param:${ID_B}}}`, params, 'resolved')
    ).toBe('100 ±5 kPa')
  })

  it('handles unknown ids by emitting [Unknown parameter: <8>]', () => {
    const unknown = '99999999-9999-9999-9999-999999999999'
    const out = resolveParameterPlaceholders(`{{param:${unknown}}}`, params, 'name')
    expect(out).toBe('[Unknown parameter: 99999999]')
  })

  it('matches placeholders case-insensitively on the UUID', () => {
    const upperId = ID_A.toUpperCase()
    const out = resolveParameterPlaceholders(`{{param:${upperId}}}`, params, 'name')
    expect(out).toBe('voltage')
  })

  it('replaces multiple occurrences', () => {
    const out = resolveParameterPlaceholders(
      `{{param:${ID_A}}} and {{param:${ID_B}}}`,
      params,
      'name'
    )
    expect(out).toBe('voltage and pressure')
  })

  it('uses resolvedDisplay when present in resolved mode', () => {
    const m = makeMap([
      { id: ID_A, name: 'v', defaultValue: '1', unit: 'V', resolvedDisplay: 'PRECOMPUTED' },
    ])
    expect(
      resolveParameterPlaceholders(`{{param:${ID_A}}}`, m, 'resolved')
    ).toBe('PRECOMPUTED')
  })
})

describe('extractParameterIds', () => {
  it('returns empty array for empty input', () => {
    expect(extractParameterIds('')).toEqual([])
  })

  it('extracts ids from {{param:uuid}} placeholders', () => {
    const ids = extractParameterIds(`{{param:${ID_A}}} and {{param:${ID_B}}}`)
    expect(ids.sort()).toEqual([ID_A, ID_B].sort())
  })

  it('extracts ids from data-param-id span attributes', () => {
    const html = `<span data-param-id="${ID_A}">voltage</span>`
    expect(extractParameterIds(html)).toEqual([ID_A])
  })

  it('lowercases extracted ids', () => {
    const upper = ID_A.toUpperCase()
    const ids = extractParameterIds(`{{param:${upper}}}`)
    expect(ids).toEqual([ID_A])
  })

  it('deduplicates repeated ids across both formats', () => {
    const html = `{{param:${ID_A}}} <span data-param-id="${ID_A}">x</span>`
    expect(extractParameterIds(html)).toEqual([ID_A])
  })
})

describe('placeholdersToEditorSpans', () => {
  it('returns empty string when input is empty', () => {
    expect(placeholdersToEditorSpans('', new Map())).toBe('')
  })

  it('replaces {{param:id}} with a span containing the parameter name', () => {
    const m = new Map([[ID_A, { id: ID_A, name: 'voltage' }]])
    const out = placeholdersToEditorSpans(`Use {{param:${ID_A}}}.`, m)
    expect(out).toBe(
      `Use <span data-param-id="${ID_A}" class="param-ref">voltage</span>.`
    )
  })

  it('escapes HTML special characters in parameter names', () => {
    const m = new Map([[ID_A, { id: ID_A, name: '<bad>' }]])
    const out = placeholdersToEditorSpans(`{{param:${ID_A}}}`, m)
    expect(out).toContain('&lt;bad&gt;')
    expect(out).not.toContain('<bad>')
  })

  it('emits an [Unknown:<8>] span when the parameter is not found', () => {
    const out = placeholdersToEditorSpans(`{{param:${ID_A}}}`, new Map())
    expect(out).toContain('[Unknown: 11111111]')
  })
})

describe('editorSpansToPlaceholders', () => {
  it('returns empty string when input is empty', () => {
    expect(editorSpansToPlaceholders('')).toBe('')
  })

  it('replaces editor spans with the canonical placeholder form', () => {
    const html = `Use <span data-param-id="${ID_A}" class="param-ref">voltage</span> here`
    expect(editorSpansToPlaceholders(html)).toBe(`Use {{param:${ID_A}}} here`)
  })

  it('handles multiple spans in one document', () => {
    const html =
      `<span data-param-id="${ID_A}">a</span> and ` +
      `<span data-param-id="${ID_B}">b</span>`
    expect(editorSpansToPlaceholders(html)).toBe(
      `{{param:${ID_A}}} and {{param:${ID_B}}}`
    )
  })

  it('round-trips placeholders -> spans -> placeholders', () => {
    const m = new Map([[ID_A, { id: ID_A, name: 'voltage' }]])
    const original = `Set {{param:${ID_A}}} now.`
    const spans = placeholdersToEditorSpans(original, m)
    expect(editorSpansToPlaceholders(spans)).toBe(original)
  })
})
