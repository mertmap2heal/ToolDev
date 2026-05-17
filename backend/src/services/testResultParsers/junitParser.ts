/**
 * JUnit XML parser (N-2.4). Also the parser behind `format=pytest` — pytest's
 * `--junitxml` flag emits standard JUnit XML, so `pytest` is an alias here.
 *
 * Structure: a root `<testsuites>` wrapping `<testsuite>` elements, OR a bare
 * top-level `<testsuite>`. Each `<testsuite>` holds `<testcase>` elements.
 *
 * Status mapping (PM gate ruling, issue #431):
 *   - no child element        -> PASS
 *   - `<failure>`             -> FAIL
 *   - `<error>`               -> FAIL   (NOT PASSED_WITH_ERRORS)
 *   - `<skipped>`             -> SKIPPED
 */
import { ParseError } from './types'
import type { NormalisedResult, ParseSummary } from './types'
import {
  parseXmlSafely,
  toArray,
  attrStr,
  attrNum,
  resolveTestCaseKey,
  xrefFromProperties,
  MAX_RESULT_ELEMENTS,
} from './xmlShared'

interface JUnitParsed {
  results: NormalisedResult[]
  summary: ParseSummary
}

/** Read the text body of a `<failure>` / `<error>` / `<skipped>` node. */
function nodeText(node: unknown): string | undefined {
  if (node === undefined || node === null) return undefined
  if (typeof node === 'string') return node.trim() || undefined
  if (typeof node === 'object') {
    const o = node as Record<string, unknown>
    const msg = attrStr(o['@_message'])
    const body = attrStr(o['#text'])
    return [msg, body].filter(Boolean).join(' - ') || undefined
  }
  return undefined
}

export function parseJUnit(raw: string): JUnitParsed {
  const doc = parseXmlSafely(raw)

  // Accept either <testsuites> root or a bare <testsuite> root.
  let suites: Record<string, unknown>[]
  if (doc['testsuites'] && typeof doc['testsuites'] === 'object') {
    const root = doc['testsuites'] as Record<string, unknown>
    suites = toArray<Record<string, unknown>>(
      root['testsuite'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
    )
  } else if (doc['testsuite'] && typeof doc['testsuite'] === 'object') {
    suites = toArray<Record<string, unknown>>(
      doc['testsuite'] as Record<string, unknown> | Record<string, unknown>[],
    )
  } else {
    throw new ParseError('Not a JUnit report: missing <testsuites> / <testsuite> root')
  }

  const results: NormalisedResult[] = []
  const summary: ParseSummary = { total: 0, pass: 0, fail: 0, error: 0, skipped: 0 }

  for (const suite of suites) {
    const suiteTimestamp = attrStr(suite['@_timestamp'])
    const testcases = toArray<Record<string, unknown>>(
      suite['testcase'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
    )
    for (const tc of testcases) {
      summary.total += 1
      if (summary.total > MAX_RESULT_ELEMENTS) {
        throw new ParseError(
          `Test-result file exceeds the ${MAX_RESULT_ELEMENTS}-element limit`,
        )
      }

      const name = attrStr(tc['@_name'])
      const classname = attrStr(tc['@_classname'])
      const explicit = xrefFromProperties(tc['properties'])
      const testCaseKey = resolveTestCaseKey({ explicit, name, classname })

      // A <testcase> may carry one of: failure / error / skipped. A failure or
      // error element can also be repeated; presence of any is what matters.
      const failureNode = tc['failure']
      const errorNode = tc['error']
      const skippedNode = tc['skipped']

      let status: NormalisedResult['status']
      let message: string | undefined
      if (failureNode !== undefined) {
        status = 'FAIL'
        message = nodeText(toArray(failureNode)[0])
        summary.fail += 1
      } else if (errorNode !== undefined) {
        // PM ruling: a framework <error> maps to FAIL, not PASSED_WITH_ERRORS.
        status = 'FAIL'
        message = nodeText(toArray(errorNode)[0])
        summary.error += 1
        summary.fail += 1
      } else if (skippedNode !== undefined) {
        status = 'SKIPPED'
        message = nodeText(toArray(skippedNode)[0])
        summary.skipped += 1
      } else {
        status = 'PASS'
        summary.pass += 1
      }

      const durationSeconds = attrNum(tc['@_time'])
      const systemOut = nodeText(tc['system-out'])
      const systemErr = nodeText(tc['system-err'])

      results.push({
        testCaseKey: testCaseKey ?? '',
        status,
        message,
        durationSeconds,
        executedAt: suiteTimestamp,
        actualResults: {
          name,
          classname,
          message,
          stdout: systemOut,
          stderr: systemErr,
          durationSeconds,
          rawStatus:
            failureNode !== undefined
              ? 'failure'
              : errorNode !== undefined
                ? 'error'
                : skippedNode !== undefined
                  ? 'skipped'
                  : 'pass',
        },
      })
    }
  }

  return { results, summary }
}
