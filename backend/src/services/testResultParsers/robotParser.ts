/**
 * Robot Framework `output.xml` parser (N-2.4).
 *
 * Structure: `<robot>` -> nested `<suite>` elements -> `<test>` leaves. Each
 * `<test>` carries a `<status status="PASS|FAIL|SKIP|NOT RUN" .../>` child
 * with optional `starttime` / `endtime` attributes and a status message body.
 *
 * Status mapping:
 *   status="PASS"             -> PASS
 *   status="FAIL"             -> FAIL
 *   status="SKIP" / "NOT RUN" -> SKIPPED
 *
 * The VerTestCase key is resolved from a `<test>`-level `xref` tag or metadata,
 * then the test `name`.
 */
import { NormalisedResult, ParseError, ParseSummary } from './types'
import {
  parseXmlSafely,
  toArray,
  attrStr,
  resolveTestCaseKey,
  MAX_RESULT_ELEMENTS,
} from './xmlShared'

interface RobotParsed {
  results: NormalisedResult[]
  summary: ParseSummary
}

/** Recursively collect every <test> node under a suite subtree. */
function collectTests(
  node: Record<string, unknown>,
  acc: Record<string, unknown>[],
): void {
  const tests = toArray<Record<string, unknown>>(
    node['test'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
  )
  for (const t of tests) acc.push(t)

  const suites = toArray<Record<string, unknown>>(
    node['suite'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
  )
  for (const s of suites) collectTests(s, acc)
}

/**
 * Read an `xref` from a Robot `<test>` — either a `<tag>` whose text starts
 * with `xref:` or `xref=`, or whose text is itself a usable key. Robot stores
 * tags as `<tags><tag>..</tag></tags>`.
 */
function xrefFromTags(testNode: Record<string, unknown>): string | undefined {
  const tagsNode = testNode['tags']
  if (!tagsNode || typeof tagsNode !== 'object') return undefined
  const tags = toArray<unknown>(
    (tagsNode as Record<string, unknown>)['tag'] as unknown,
  )
  for (const t of tags) {
    const text =
      typeof t === 'string'
        ? t.trim()
        : attrStr((t as Record<string, unknown>)?.['#text'])
    if (!text) continue
    const m = text.match(/^xref[:=]\s*(.+)$/i)
    if (m) return m[1].trim()
  }
  return undefined
}

/** Robot timestamps look like "20260517 09:12:03.123" — make them ISO-ish. */
function robotTimeToIso(value: string | undefined): string | undefined {
  if (!value) return undefined
  const m = value.match(/^(\d{4})(\d{2})(\d{2})\s+([\d:.]+)$/)
  if (!m) return value
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}`
}

export function parseRobot(raw: string): RobotParsed {
  const doc = parseXmlSafely(raw)

  const robotNode = doc['robot']
  if (!robotNode || typeof robotNode !== 'object') {
    throw new ParseError('Not a Robot Framework report: missing <robot> root')
  }

  const tests: Record<string, unknown>[] = []
  collectTests(robotNode as Record<string, unknown>, tests)

  const results: NormalisedResult[] = []
  const summary: ParseSummary = { total: 0, pass: 0, fail: 0, error: 0, skipped: 0 }

  for (const test of tests) {
    summary.total += 1
    if (summary.total > MAX_RESULT_ELEMENTS) {
      throw new ParseError(
        `Test-result file exceeds the ${MAX_RESULT_ELEMENTS}-element limit`,
      )
    }

    const name = attrStr(test['@_name'])
    const explicit = xrefFromTags(test)
    const testCaseKey = resolveTestCaseKey({ explicit, name })

    const statusNode = test['status']
    if (!statusNode || typeof statusNode !== 'object') {
      throw new ParseError(
        `Robot <test> "${name ?? ''}" is missing a <status> element`,
      )
    }
    const statusObj = statusNode as Record<string, unknown>
    const rawStatus = attrStr(statusObj['@_status'])?.toUpperCase()

    let status: NormalisedResult['status']
    if (rawStatus === 'PASS') {
      status = 'PASS'
      summary.pass += 1
    } else if (rawStatus === 'FAIL') {
      status = 'FAIL'
      summary.fail += 1
    } else if (rawStatus === 'SKIP' || rawStatus === 'NOT RUN' || rawStatus === 'NOT_RUN') {
      status = 'SKIPPED'
      summary.skipped += 1
    } else {
      throw new ParseError(
        `Unrecognised Robot test status "${attrStr(statusObj['@_status']) ?? ''}"`,
      )
    }

    const message = attrStr(statusObj['#text'])
    const startIso = robotTimeToIso(attrStr(statusObj['@_starttime']))
    const endIso = robotTimeToIso(attrStr(statusObj['@_endtime']))

    let durationSeconds: number | undefined
    if (startIso && endIso) {
      const start = Date.parse(startIso)
      const end = Date.parse(endIso)
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
        durationSeconds = (end - start) / 1000
      }
    }

    results.push({
      testCaseKey: testCaseKey ?? '',
      status,
      message,
      durationSeconds,
      executedAt: startIso,
      actualResults: {
        name,
        message,
        durationSeconds,
        rawStatus,
      },
    })
  }

  return { results, summary }
}
