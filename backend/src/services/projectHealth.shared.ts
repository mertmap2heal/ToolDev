// RF-3 (#487) — shared project-health primitives.
//
// These pure functions and constants were extracted verbatim from
// `dashboardSummary.service.ts` (RF-2) so both the portfolio aggregate and the
// RF-3 single-project `composeProjectLandingSummary` aggregate derive module
// health from one source of truth. No behaviour change — `dashboardSummary.ts`
// re-exports `deriveGate` / `GateSignal` for its existing test imports.
//
// Pure: no HTTP, no Prisma, no I/O.
import type {
  HealthLevel,
  GateState,
} from '../../../shared/types/dashboard/_compiled/index.js'

/** DAL letters ordered most-critical-first; `A` is the highest assurance. */
export const DAL_ORDER = ['A', 'B', 'C', 'D', 'E'] as const

/** Verification result statuses that count as "passed" for coverage. */
export const VER_PASS_STATUSES = new Set(['PASS', 'PASSED_WITH_ERRORS'])
/** Verification result statuses that count toward the coverage denominator. */
export const VER_RUN_STATUSES = new Set(['PASS', 'PASSED_WITH_ERRORS', 'FAIL', 'BLOCKED', 'SKIPPED'])

// --- health-derive thresholds (the service owns these — keeps the UI dumb) ---

/** Verification coverage %: >=85 ok, >=50 warn, else danger. */
export function verCoverageHealth(pct: number | null): HealthLevel {
  if (pct === null) return 'ok' // no runs yet — not a problem, just absent
  if (pct >= 85) return 'ok'
  if (pct >= 50) return 'warn'
  return 'danger'
}

/** Suspect trace links: 0 ok, <=10 warn, else danger. */
export function suspectHealth(count: number): HealthLevel {
  if (count === 0) return 'ok'
  if (count <= 10) return 'warn'
  return 'danger'
}

/** Open issues: 0 ok, <=5 warn, else danger. */
export function issueHealth(count: number): HealthLevel {
  if (count === 0) return 'ok'
  if (count <= 5) return 'warn'
  return 'danger'
}

/** Open hazards: 0 ok, <=20 warn, else danger. */
export function hazardHealth(count: number): HealthLevel {
  if (count === 0) return 'ok'
  if (count <= 20) return 'warn'
  return 'danger'
}

/**
 * Per-project health inputs for the gate-state derivation. Sourced from the
 * same roll-up signals the dashboard table already shows, so the gate chip
 * never contradicts the module-health chips next to it.
 */
export interface GateSignal {
  /** Any module-health verdict is `danger` (failing coverage, too many issues/hazards/suspect links). */
  hasDangerHealth: boolean
  /** Any module-health verdict is `warn`. */
  hasWarnHealth: boolean
  /** Count of the project's sign-offs pending longer than the overdue threshold. */
  overdueSignOffs: number
  /** Project completion percentage (`Project.progress`, 0-100). */
  progress: number
}

/**
 * Derive a lifecycle-gate chip from a phase row plus the project's health.
 *
 * The five `GateState.state` values:
 *  - `none`     — no lifecycle phase set (pre-SRR / pre-lifecycle).
 *  - `released` — the terminal phase (name matches release/closed/complete).
 *  - `at-risk`  — an active phase the project is NOT on track to clear: any
 *                 module-health verdict is `danger`, OR sign-offs are overdue.
 *                 Renders the red gate chip.
 *  - `cleared`  — an active phase whose exit criteria look met but the project
 *                 has not yet advanced to the terminal phase: the project is
 *                 healthy (no `danger`/`warn` health, no overdue sign-offs)
 *                 AND fully progressed (`progress` >= 100). Renders green.
 *  - `current`  — an active phase, in progress, neither at-risk nor cleared.
 *
 * `released` / `at-risk` take precedence: a terminal phase is always released,
 * and a project with a real problem is at-risk regardless of progress.
 *
 * Exported for unit testing — it is a pure function of its two arguments.
 */
export function deriveGate(
  phase: { name: string; orderIndex: number; isInitial: boolean } | null,
  signal: GateSignal,
): GateState {
  if (!phase) return { code: 'pre-SRR', state: 'none' }
  const code = phase.name.length <= 12 ? phase.name : phase.name.slice(0, 12)
  // The terminal "released" phase reads as released first — a delivered
  // project is not "at-risk" even if late issues remain open.
  if (/release|closed|complete/i.test(phase.name)) {
    return { code, state: 'released' }
  }
  // A blocked / failing project in an active phase: red gate chip.
  if (signal.hasDangerHealth || signal.overdueSignOffs > 0) {
    return { code, state: 'at-risk' }
  }
  // Exit criteria look met (healthy + fully progressed) but the project has
  // not yet been advanced to the terminal phase: green "cleared" chip.
  if (!signal.hasWarnHealth && signal.progress >= 100) {
    return { code, state: 'cleared' }
  }
  // The normal in-progress case.
  return { code, state: 'current' }
}
