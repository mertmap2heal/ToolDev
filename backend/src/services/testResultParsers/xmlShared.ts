/**
 * Shared XML + key-matching helpers for the test-result parsers (N-2.4).
 *
 * XXE / XML-bomb safety
 * ---------------------
 * fast-xml-parser does NOT resolve external entities and does NOT fetch
 * external DTDs (no network/file access), so classic XXE file-read / SSRF is
 * structurally impossible. We additionally set `processEntities: false` so the
 * parser does not expand ANY entity — this kills the billion-laughs /
 * XML-bomb entity-expansion class even though the built-in expansion is
 * bounded. Test-result XML never legitimately needs entity expansion.
 *
 * The 8 MB upload cap (enforced by multer at the route) plus the element-count
 * guard below bound CPU and memory for a hostile but well-formed payload.
 */
import { XMLParser } from 'fast-xml-parser'
import { ParseError } from './types'

/** Max test-result elements a single uploaded file may contain. */
export const MAX_RESULT_ELEMENTS = 10000

/**
 * An XXE-safe, attribute-aware XMLParser instance shared by all XML parsers.
 * - `processEntities: false` disables ALL entity expansion (XML-bomb defence).
 * - fast-xml-parser performs no DTD / external-entity resolution by default.
 */
export function createSafeXmlParser(): XMLParser {
  return new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    processEntities: false,
    htmlEntities: false,
    // Keep text content of mixed nodes addressable.
    textNodeName: '#text',
    // Tag/attribute values are kept as strings; we coerce numbers ourselves
    // so a key like "001" is never silently turned into a number.
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
  })
}

/**
 * Parse raw XML safely. Throws ParseError (-> 400) on malformed input.
 */
export function parseXmlSafely(raw: string): Record<string, unknown> {
  const text = raw.trim()
  if (!text) {
    throw new ParseError('Empty file: no XML content')
  }
  // Reject a DOCTYPE outright. fast-xml-parser ignores it, but rejecting it
  // makes the no-DTD posture explicit and gives the uploader a clear message.
  if (/<!DOCTYPE/i.test(text)) {
    throw new ParseError('XML DOCTYPE declarations are not permitted (XXE protection)')
  }
  const parser = createSafeXmlParser()
  let parsed: unknown
  try {
    parsed = parser.parse(text)
  } catch (e) {
    throw new ParseError(`Malformed XML: ${(e as Error).message}`)
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new ParseError('Malformed XML: no document element')
  }
  return parsed as Record<string, unknown>
}

/**
 * fast-xml-parser collapses a single child element into an object and a
 * repeated element into an array. This normalises either shape to an array.
 */
export function toArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** Coerce an attribute value to a trimmed string, or undefined. */
export function attrStr(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined
  const s = String(value).trim()
  return s.length > 0 ? s : undefined
}

/** Coerce a value to a finite number, or undefined. */
export function attrNum(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Embedded-key regex: a token like TC-UAV-001 / REQ-12 / VER-A-3.
 * One leading uppercase letter, then uppercase/digits, then one or more
 * hyphen-separated uppercase/digit segments.
 */
const EMBEDDED_KEY = /\b([A-Z][A-Z0-9]*-[A-Z0-9]+(?:-[A-Z0-9]+)*)\b/

/**
 * Resolve a VerTestCase key from a raw test result, in priority order:
 *   1. An explicit `xref` / `testCaseKey` property (the canonical, documented way).
 *   2. A key embedded in the test `name`, then the `classname` (regex extraction).
 *   3. The whole `name` as the key (last resort, when the name is itself a key).
 * Returns undefined when nothing usable is found; the caller skips + counts it.
 */
export function resolveTestCaseKey(opts: {
  explicit?: string
  name?: string
  classname?: string
}): string | undefined {
  const explicit = opts.explicit?.trim()
  if (explicit) return explicit

  const name = opts.name?.trim()
  if (name) {
    const m = name.match(EMBEDDED_KEY)
    if (m) return m[1]
  }
  const classname = opts.classname?.trim()
  if (classname) {
    const m = classname.match(EMBEDDED_KEY)
    if (m) return m[1]
  }
  // Last resort: the whole name. Only useful when the name IS a clean key,
  // but we return it regardless and let the DB key-match decide.
  if (name) return name
  return undefined
}

/**
 * Extract an `xref` (or `testCaseKey`) value from a JUnit/xUnit/NUnit
 * `<properties><property name=.. value=..>` bag. Accepts either the
 * fast-xml-parser single-object or array shape.
 */
export function xrefFromProperties(propertiesNode: unknown): string | undefined {
  if (!propertiesNode || typeof propertiesNode !== 'object') return undefined
  const bag = propertiesNode as Record<string, unknown>
  const props = toArray<Record<string, unknown>>(
    bag['property'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
  )
  for (const p of props) {
    const pname = attrStr(p['@_name'])?.toLowerCase()
    if (pname === 'xref' || pname === 'testcasekey' || pname === 'test_case_key') {
      const v = attrStr(p['@_value'])
      if (v) return v
    }
  }
  return undefined
}
