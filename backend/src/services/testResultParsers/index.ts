/**
 * Test-result ingestion parsers (N-2.4) — public entry point.
 *
 * `parseTestResults(raw, format)` dispatches a raw CI-tool output file to the
 * right per-format parser and returns a normalised, ingestion-ready result
 * set. Five distinct parsers back six accepted `format` values:
 *
 *   junit  -> JUnit XML parser
 *   pytest -> JUnit XML parser  (pytest `--junitxml` emits standard JUnit XML)
 *   xunit  -> xUnit.net v2 XML parser
 *   nunit  -> NUnit 3 XML parser
 *   robot  -> Robot Framework output.xml parser
 *   tap    -> TAP 13/14 parser
 *
 * A malformed file makes the chosen parser throw a `ParseError`; the
 * file-ingest route maps that to a 400 response (never a 500).
 */
import {
  NormalisedResult,
  ParseError,
  ParseResult,
  TEST_RESULT_FORMATS,
  TestResultFormat,
} from './types'
import { parseJUnit } from './junitParser'
import { parseXUnit } from './xunitParser'
import { parseNUnit } from './nunitParser'
import { parseRobot } from './robotParser'
import { parseTap } from './tapParser'

export {
  NormalisedResult,
  ParseError,
  ParseResult,
  ParseSummary,
  ResultStatus,
  TestResultFormat,
  TEST_RESULT_FORMATS,
} from './types'

/** True when `value` is one of the six accepted format values. */
export function isTestResultFormat(value: unknown): value is TestResultFormat {
  return typeof value === 'string' && (TEST_RESULT_FORMATS as readonly string[]).includes(value)
}

/**
 * Parse a raw test-result file into a normalised result set.
 *
 * @param raw    The file contents (string or Buffer; Buffer is decoded UTF-8).
 * @param format One of the six accepted format values.
 * @throws ParseError when `format` is unknown or the file is malformed.
 */
export function parseTestResults(
  raw: string | Buffer,
  format: TestResultFormat,
): ParseResult {
  if (!isTestResultFormat(format)) {
    throw new ParseError(
      `Unknown test-result format "${String(format)}" — expected one of: ${TEST_RESULT_FORMATS.join(', ')}`,
    )
  }
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : raw

  let parsed: { results: NormalisedResult[]; summary: ParseResult['summary'] }
  switch (format) {
    case 'junit':
    case 'pytest': // pytest --junitxml emits standard JUnit XML
      parsed = parseJUnit(text)
      break
    case 'xunit':
      parsed = parseXUnit(text)
      break
    case 'nunit':
      parsed = parseNUnit(text)
      break
    case 'robot':
      parsed = parseRobot(text)
      break
    case 'tap':
      parsed = parseTap(text)
      break
    default: {
      // Exhaustiveness guard — unreachable.
      const never: never = format
      throw new ParseError(`Unhandled format "${String(never)}"`)
    }
  }

  return { results: parsed.results, format, summary: parsed.summary }
}
