/**
 * TAP (Test Anything Protocol) 13/14 parser (N-2.4).
 *
 * TAP is line-based plain text:
 *   TAP version 13
 *   1..3
 *   ok 1 - TC-UAV-001 brake decelerates
 *   not ok 2 - TC-UAV-002 actuator response
 *   ok 3 - TC-UAV-003 # SKIP hardware unavailable
 *
 * Status mapping:
 *   `ok`                       -> PASS
 *   `not ok`                   -> FAIL
 *   any line with a `# SKIP` /  -> SKIPPED
 *     `# TODO` directive
 *
 * A TAP description has no native VerTestCase key, so the key is regex-
 * extracted from the description text, then the whole description is used.
 */
import { NormalisedResult, ParseError, ParseSummary } from './types'
import { resolveTestCaseKey, MAX_RESULT_ELEMENTS } from './xmlShared'

interface TapParsed {
  results: NormalisedResult[]
  summary: ParseSummary
}

/**
 * Match a TAP test-point line:
 *   group 1: "ok" | "not ok"
 *   group 2: the test number (optional)
 *   group 3: the description + any trailing directive (optional)
 */
const TEST_POINT = /^(ok|not ok)\b\s*(\d+)?\s*(?:-\s*)?(.*)$/i

export function parseTap(raw: string): TapParsed {
  const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (!text.trim()) {
    throw new ParseError('Empty file: no TAP content')
  }

  const lines = text.split('\n')
  const results: NormalisedResult[] = []
  const summary: ParseSummary = { total: 0, pass: 0, fail: 0, error: 0, skipped: 0 }
  let sawTestPoint = false
  let sawTapMarker = false

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (/^TAP version\s+\d+/i.test(line)) {
      sawTapMarker = true
      continue
    }
    // The plan line, e.g. "1..5" — informational, not a result.
    if (/^\d+\.\.\d+$/.test(line)) {
      sawTapMarker = true
      continue
    }
    // A bail-out aborts the whole run.
    if (/^Bail out!/i.test(line)) {
      throw new ParseError(`TAP stream bailed out: ${line.replace(/^Bail out!\s*/i, '')}`)
    }
    // A standalone comment / YAML diagnostic block — skip.
    if (line.startsWith('#') || line.startsWith('---') || line.startsWith('...')) {
      continue
    }

    const m = line.match(TEST_POINT)
    if (!m) continue // not a test point — ignore stray output

    sawTestPoint = true
    summary.total += 1
    if (summary.total > MAX_RESULT_ELEMENTS) {
      throw new ParseError(
        `Test-result file exceeds the ${MAX_RESULT_ELEMENTS}-element limit`,
      )
    }

    const ok = m[1].toLowerCase() === 'ok'
    let description = (m[3] || '').trim()

    // A directive lives after a `#` in the description: "# SKIP reason" / "# TODO".
    let directive: string | undefined
    let directiveText: string | undefined
    const hashIdx = description.indexOf('#')
    if (hashIdx >= 0) {
      const after = description.slice(hashIdx + 1).trim()
      description = description.slice(0, hashIdx).trim()
      const dm = after.match(/^(SKIP|TODO)\b\s*(.*)$/i)
      if (dm) {
        directive = dm[1].toUpperCase()
        directiveText = dm[2].trim() || undefined
      }
    }

    let status: NormalisedResult['status']
    if (directive === 'SKIP' || directive === 'TODO') {
      // SKIP / TODO directives mark the point as skipped regardless of ok/not ok.
      status = 'SKIPPED'
      summary.skipped += 1
    } else if (ok) {
      status = 'PASS'
      summary.pass += 1
    } else {
      status = 'FAIL'
      summary.fail += 1
    }

    const testCaseKey = resolveTestCaseKey({ name: description })
    const message = directiveText

    results.push({
      testCaseKey: testCaseKey ?? '',
      status,
      message,
      actualResults: {
        description,
        directive,
        directiveText,
        rawStatus: ok ? 'ok' : 'not ok',
      },
    })
  }

  if (!sawTestPoint && !sawTapMarker) {
    throw new ParseError('Not a TAP stream: no "TAP version" / plan line / test points found')
  }

  return { results, summary }
}
