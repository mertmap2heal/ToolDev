// NX-7 (#460) — the objective-completion matrix contract.
//
// The shared shape returned by GET /certification/:projectId/objective-matrix
// and consumed by the frontend <ObjectiveCompletionMatrix> component. The
// frontend imports this `.ts` directly via the Vite `shared` alias; the
// backend imports the committed `_compiled/index.js` build artefact (its
// tsconfig `rootDir` is `./src` and cannot compile a `.ts` outside src/ —
// kb/infrastructure.md, the shared `_compiled/` pattern, as N-2.3 established
// for shared/incoseEars). This `.ts` is the single source of truth — after
// editing it, regenerate the artefacts: `cd shared/objectiveMatrix && npx tsc`.
//
// One contract, no duplicate definition — backend and frontend share this.

/**
 * The graph-derived completion state of a certification objective.
 *
 * Derived purely from the cert artefact graph — it ignores the hand-set
 * `CertObjective.status` column (design-system.md §8.5: the matrix computes,
 * it does not read a hand-typed status):
 *  - `open`    — no verification coverage and no evidence on any linked
 *                requirement (includes the zero-requirement objective).
 *  - `partial` — some coverage exists, but not on every linked requirement.
 *  - `closed`  — every linked requirement is verification-covered (a PASS
 *                VerTestResult) AND has at least one VerEvidence.
 *  - `signed`  — `closed`-or-stronger AND every linked requirement plus the
 *                objective itself carry a non-superseded SignatureEvent.
 */
export type ObjectiveCompletionState = 'open' | 'partial' | 'closed' | 'signed'

/** One row of the objective-completion matrix — one CertObjective. */
export interface ObjectiveMatrixRow {
  /** The CertObjective UUID. */
  id: string
  /** The display key, e.g. `OBJ-CS25-1309-01`. */
  objId: string
  /** The free-text regulatory reference, e.g. `CS 25.1309` or `DO-178C A-3.1`. */
  regRef: string
  /** The classified standard bucket derived from `regRef` (e.g. `DO-178C`, `CS-25/23`, `Other`). */
  standard: string
  /** The objective title. */
  title: string
  /** The objective criticality — `Low | Medium | High` (CertObjective.criticality). */
  criticality: string
  /** The method of compliance — `Test | Analysis | Inspection | ...`. */
  moc: string
  /** Count of requirements linked to this objective. */
  requirementsLinked: number
  /** Count of linked requirements whose `reviewStatus` is `approved`. */
  requirementsApproved: number
  /** Distinct VerTestResult rows reachable from the linked requirements. */
  verificationsPlanned: number
  /** Of `verificationsPlanned`, those with `resultStatus` = `PASS`. */
  verificationsPassed: number
  /** Distinct VerEvidence rows linked to the objective's requirements. */
  evidenceCount: number
  /** Non-superseded SignatureEvent rows across the linked requirements + the objective. */
  signatureCount: number
  /** The graph-derived completion state. */
  completionState: ObjectiveCompletionState
}

/** The full objective-matrix endpoint payload (the `data` of the success envelope). */
export interface ObjectiveMatrixResponse {
  /** One row per CertObjective, ordered by `objId` ascending. */
  objectives: ObjectiveMatrixRow[]
  /**
   * The distinct standard buckets present in this project's objectives —
   * data-driven so the frontend filter never shows an empty hard-coded option.
   */
  availableStandards: string[]
}
