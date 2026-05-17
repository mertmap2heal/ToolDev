/**
 * xUnit.net v2 XML parser (N-2.4).
 *
 * Structure: `<assemblies>` -> `<assembly>` -> `<collection>` -> `<test>`.
 * Each `<test>` carries a `result` attribute: Pass / Fail / Skip.
 * xUnit.net has no separate "error" result — a test that throws is `Fail`.
 *
 * Status mapping:
 *   result="Pass"  -> PASS
 *   result="Fail"  -> FAIL
 *   result="Skip"  -> SKIPPED
 *
 * The VerTestCase key is resolved from a `<traits><trait name="xref">` trait,
 * then the test `name` / `type` (the xUnit equivalents of name / classname).
 */
import { ParseError } from './types'
import type { NormalisedResult, ParseSummary } from './types'
import {
  parseXmlSafely,
  toArray,
  attrStr,
  attrNum,
  resolveTestCaseKey,
  MAX_RESULT_ELEMENTS,
} from './xmlShared'

interface XUnitParsed {
  results: NormalisedResult[]
  summary: ParseSummary
}

/** Resolve an `xref` from an xUnit `<traits><trait name=.. value=..>` bag. */
function xrefFromTraits(traitsNode: unknown): string | undefined {
  if (!traitsNode || typeof traitsNode !== 'object') return undefined
  const traits = toArray<Record<string, unknown>>(
    (traitsNode as Record<string, unknown>)['trait'] as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  )
  for (const t of traits) {
    const tname = attrStr(t['@_name'])?.toLowerCase()
    if (tname === 'xref' || tname === 'testcasekey' || tname === 'test_case_key') {
      const v = attrStr(t['@_value'])
      if (v) return v
    }
  }
  return undefined
}

export function parseXUnit(raw: string): XUnitParsed {
  const doc = parseXmlSafely(raw)

  const assembliesNode = doc['assemblies']
  if (!assembliesNode || typeof assembliesNode !== 'object') {
    throw new ParseError('Not an xUnit.net report: missing <assemblies> root')
  }
  const assemblies = toArray<Record<string, unknown>>(
    (assembliesNode as Record<string, unknown>)['assembly'] as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | undefined,
  )

  const results: NormalisedResult[] = []
  const summary: ParseSummary = { total: 0, pass: 0, fail: 0, error: 0, skipped: 0 }

  for (const assembly of assemblies) {
    const runDate = attrStr(assembly['@_run-date'])
    const runTime = attrStr(assembly['@_run-time'])
    const executedAt =
      runDate && runTime ? `${runDate}T${runTime}` : runDate || undefined

    const collections = toArray<Record<string, unknown>>(
      assembly['collection'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
    )
    for (const collection of collections) {
      const tests = toArray<Record<string, unknown>>(
        collection['test'] as Record<string, unknown> | Record<string, unknown>[] | undefined,
      )
      for (const test of tests) {
        summary.total += 1
        if (summary.total > MAX_RESULT_ELEMENTS) {
          throw new ParseError(
            `Test-result file exceeds the ${MAX_RESULT_ELEMENTS}-element limit`,
          )
        }

        const name = attrStr(test['@_name'])
        const type = attrStr(test['@_type'])
        const explicit = xrefFromTraits(test['traits'])
        const testCaseKey = resolveTestCaseKey({ explicit, name, classname: type })

        const rawResult = attrStr(test['@_result'])?.toLowerCase()
        let status: NormalisedResult['status']
        if (rawResult === 'pass') {
          status = 'PASS'
          summary.pass += 1
        } else if (rawResult === 'fail') {
          status = 'FAIL'
          summary.fail += 1
        } else if (rawResult === 'skip') {
          status = 'SKIPPED'
          summary.skipped += 1
        } else {
          throw new ParseError(
            `Unrecognised xUnit test result "${attrStr(test['@_result']) ?? ''}"`,
          )
        }

        // Failure text lives in <failure><message>..</message>.
        let message: string | undefined
        const failureNode = test['failure']
        if (failureNode && typeof failureNode === 'object') {
          const f = failureNode as Record<string, unknown>
          message = attrStr(f['message']) || attrStr(f['#text'])
        }
        // A skipped test has a <reason> child.
        const reason = attrStr(test['reason'])
        if (!message && reason) message = reason

        const durationSeconds = attrNum(test['@_time'])

        results.push({
          testCaseKey: testCaseKey ?? '',
          status,
          message,
          durationSeconds,
          executedAt,
          actualResults: {
            name,
            type,
            message,
            durationSeconds,
            rawStatus: rawResult,
          },
        })
      }
    }
  }

  return { results, summary }
}
