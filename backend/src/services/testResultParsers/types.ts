/**
 * Shared types for the test-result ingestion parsers (N-2.4).
 *
 * A parser converts a raw CI-tool output file into a NormalisedResult[] that
 * the verification ingestion core (ingestionCore.service.ts) can consume.
 *
 * The `status` vocabulary is exactly the VerTestRunResult.resultStatus
 * vocabulary documented in schema.prisma:2991 (NOT_RUN, PASS, FAIL, BLOCKED,
 * SKIPPED, PASSED_WITH_ERRORS). Parsers never emit NOT_RUN (the unrun default)
 * and never emit BLOCKED (a manual-execution status no automated format
 * produces). Per the PM gate ruling on issue #431: a test framework's
 * `<error>` element maps to FAIL, NOT PASSED_WITH_ERRORS — an errored test
 * did not pass, and inflating coverage with a false verification claim is
 * forbidden in a certification tool.
 */

/** The VerTestRunResult.resultStatus vocabulary (schema.prisma:2991). */
export type ResultStatus =
  | 'NOT_RUN'
  | 'PASS'
  | 'FAIL'
  | 'BLOCKED'
  | 'SKIPPED'
  | 'PASSED_WITH_ERRORS'

/** Accepted `format` field values for the file-ingest endpoint. */
export type TestResultFormat = 'junit' | 'xunit' | 'nunit' | 'robot' | 'tap' | 'pytest'

/** Every accepted format value (for validation in the route). */
export const TEST_RESULT_FORMATS: readonly TestResultFormat[] = [
  'junit',
  'xunit',
  'nunit',
  'robot',
  'tap',
  'pytest',
] as const

/** One normalised test result, ready for the ingestion core. */
export interface NormalisedResult {
  /** The VerTestCase.key this result claims to verify (see the 3-tier convention). */
  testCaseKey: string
  /** The mapped resultStatus — one of PASS / FAIL / SKIPPED (parsers never emit the others). */
  status: ResultStatus
  /** Free-form per-result detail stored in VerTestRunResult.actualResults JSON. */
  actualResults?: Record<string, unknown>
  /** ISO-8601 timestamp; omitted -> the core defaults to now(). */
  executedAt?: string
  /** Wall-clock duration of the test in seconds, when the format reports it. */
  durationSeconds?: number
  /** A short human message (failure/error text), when the format reports it. */
  message?: string
}

/** The summary counters returned alongside a parse. */
export interface ParseSummary {
  /** Total result elements seen in the file. */
  total: number
  pass: number
  fail: number
  /** Count of source elements that were a framework "error" (mapped to FAIL). */
  error: number
  skipped: number
}

/** The result of parsing a raw test-result file. */
export interface ParseResult {
  results: NormalisedResult[]
  format: TestResultFormat
  summary: ParseSummary
}

/**
 * Thrown by any parser when the input is malformed or structurally invalid.
 * The file-ingest route maps a ParseError to a 400 response (never a 500).
 */
export class ParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParseError'
  }
}
