/**
 * NUnit 3 XML parser (N-2.4).
 *
 * Structure: `<test-run>` -> nested `<test-suite>` elements -> `<test-case>`
 * leaves. Suites nest arbitrarily; this parser walks the tree and collects
 * every `<test-case>` regardless of depth.
 *
 * A `<test-case>` carries `result` ("Passed" / "Failed" / "Skipped" /
 * "Inconclusive") and, when failed, an optional `label` ("Error" for an
 * unexpected exception).
 *
 * Status mapping (PM gate ruling, issue #431):
 *   result="Passed"                    -> PASS
 *   result="Failed"                    -> FAIL   (incl. label="Error" — an
 *                                                  errored test still FAIL)
 *   result="Skipped" / "Inconclusive"  -> SKIPPED
 */
import { NormalisedResult, ParseError, ParseSummary } from './types'
import {
  parseXmlSafely,
  toArray,
  attrStr,
  attrNum,
  resolveTestCaseKey,
  xrefFromProperties,
  MAX_RESULT_ELEMENTS,
} from './xmlShared'

interface NUnitParsed {
  results: NormalisedResult[]
  summary: ParseSummary
}

/** Recursively collect every <test-case> node under a suite subtree. */
function collectTestCases(
  node: Record<string, unknown>,
  acc: Record<string, unknown>[],
): void {
  const cases = toArray<Record<string, unknown>>(
    node['test-case'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
  )
  for (const c of cases) acc.push(c)

  const suites = toArray<Record<string, unknown>>(
    node['test-suite'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
  )
  for (const s of suites) collectTestCases(s, acc)
}

/** Read the failure/error message from a <test-case><failure><message>. */
function failureMessage(testCase: Record<string, unknown>): string | undefined {
  const failure = testCase['failure']
  if (failure && typeof failure === 'object') {
    const f = failure as Record<string, unknown>
    return attrStr(f['message']) || attrStr(f['#text'])
  }
  const reason = testCase['reason']
  if (reason && typeof reason === 'object') {
    const r = reason as Record<string, unknown>
    return attrStr(r['message']) || attrStr(r['#text'])
  }
  return undefined
}

export function parseNUnit(raw: string): NUnitParsed {
  const doc = parseXmlSafely(raw)

  const runNode = doc['test-run']
  if (!runNode || typeof runNode !== 'object') {
    throw new ParseError('Not an NUnit 3 report: missing <test-run> root')
  }
  const root = runNode as Record<string, unknown>
  const startTime = attrStr(root['@_start-time'])

  const testCases: Record<string, unknown>[] = []
  // <test-case> can sit directly under <test-run> or under nested suites.
  collectTestCases(root, testCases)

  const results: NormalisedResult[] = []
  const summary: ParseSummary = { total: 0, pass: 0, fail: 0, error: 0, skipped: 0 }

  for (const tc of testCases) {
    summary.total += 1
    if (summary.total > MAX_RESULT_ELEMENTS) {
      throw new ParseError(
        `Test-result file exceeds the ${MAX_RESULT_ELEMENTS}-element limit`,
      )
    }

    const name = attrStr(tc['@_name'])
    const fullname = attrStr(tc['@_fullname'])
    const classname = attrStr(tc['@_classname'])
    const explicit = xrefFromProperties(tc['properties'])
    const testCaseKey = resolveTestCaseKey({
      explicit,
      name,
      classname: classname ?? fullname,
    })

    const rawResult = attrStr(tc['@_result'])?.toLowerCase()
    const label = attrStr(tc['@_label'])?.toLowerCase()

    let status: NormalisedResult['status']
    let message: string | undefined
    if (rawResult === 'passed') {
      status = 'PASS'
      summary.pass += 1
    } else if (rawResult === 'failed') {
      // PM ruling: a failed test with label="Error" still maps to FAIL.
      status = 'FAIL'
      message = failureMessage(tc)
      if (label === 'error') summary.error += 1
      summary.fail += 1
    } else if (rawResult === 'skipped' || rawResult === 'inconclusive') {
      status = 'SKIPPED'
      message = failureMessage(tc)
      summary.skipped += 1
    } else {
      throw new ParseError(
        `Unrecognised NUnit test-case result "${attrStr(tc['@_result']) ?? ''}"`,
      )
    }

    const durationSeconds = attrNum(tc['@_duration'])
    const tcStartTime = attrStr(tc['@_start-time'])

    results.push({
      testCaseKey: testCaseKey ?? '',
      status,
      message,
      durationSeconds,
      executedAt: tcStartTime ?? startTime,
      actualResults: {
        name,
        fullname,
        classname,
        label,
        message,
        durationSeconds,
        rawStatus: rawResult,
      },
    })
  }

  return { results, summary }
}
