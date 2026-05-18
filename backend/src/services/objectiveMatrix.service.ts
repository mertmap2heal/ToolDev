// NX-7 (#460) — the objective-completion matrix service.
//
// `getObjectiveMatrix(projectId)` consumes the shared `walkObjectiveGraph`
// traversal once, then rolls up — per CertObjective — a graph-derived
// `completionState`, the linked-requirement / verification / evidence /
// signature counts, and a `regRef`-classified standard bucket. It is a pure
// read: no Prisma writes, no audit row (a read-only GET writes none).
//
// The completion state is derived ONLY from the artefact graph — the
// hand-typed `CertObjective.status` column is deliberately ignored
// (design-system.md §8.5: the matrix computes, it does not read a hand-typed
// status). The derivation is a single pure pass over the resolved in-memory
// indices — no DB call inside any loop — so it inherits the constant
// query-count SLA of the shared walk.
import { walkObjectiveGraph } from './certGraph.service'
// The shared frontend<->backend contract. The backend imports the committed
// `_compiled/` build artefact (`_compiled/` holds no `.ts`, so the backend
// tsconfig — rootDir `./src` — never tries to compile a `.ts` outside src/).
// The frontend imports `shared/objectiveMatrix/index.ts` directly. The `.ts`
// is the single source of truth; regenerate the artefact after editing it:
// `cd shared/objectiveMatrix && npx tsc` (kb/infrastructure.md, the shared
// `_compiled/` pattern — N-2.3 established it for shared/incoseEars).
import type {
  ObjectiveCompletionState,
  ObjectiveMatrixRow,
  ObjectiveMatrixResponse,
} from '../../../shared/objectiveMatrix/_compiled/index.js'

/**
 * Classify a free-text `CertObjective.regRef` into a standard bucket.
 *
 * `regRef` is genuinely free-text (it carries two unrelated shapes in seed
 * data — airworthiness certification-basis paragraphs like `CS 25.1309` AND
 * software/system standard names like `DO-178C A-3.1`). This is the single
 * brittle point: a `regRef` shape the regex map does not anticipate lands in
 * the `Other` bucket — a real, selectable bucket, so the failure mode is
 * "ungrouped", never "dropped". It is an isolated, unit-tested pure helper a
 * follow-on can extend without touching the graph walk or the endpoint.
 */
export function classifyRegRefStandard(regRef: string | null | undefined): string {
  const ref = (regRef ?? '').trim()
  if (!ref) return 'Other'
  if (/^DO-?178C/i.test(ref)) return 'DO-178C'
  if (/^DO-?254/i.test(ref)) return 'DO-254'
  if (/^DO-?326A/i.test(ref)) return 'DO-326A'
  if (/^ARP\s?-?4754A/i.test(ref)) return 'ARP4754A'
  if (/^ARP\s?-?4761A?/i.test(ref)) return 'ARP4761'
  if (/^ISO\s?-?26262/i.test(ref)) return 'ISO 26262'
  if (/^IEC\s?-?62304/i.test(ref)) return 'IEC 62304'
  // Airworthiness certification-basis paragraphs: CS 25.x / CS 23.x / CS-25 / etc.
  if (/^CS[\s-]?2[0-9]/i.test(ref)) return 'CS-25/23'
  return 'Other'
}

/**
 * Compose the objective-completion matrix from the CURRENT state of a project.
 *
 * Returns `null` only when the project does not exist (the controller maps
 * that to 404 — though `projectIdParam` already 404s a missing project before
 * the controller runs). For an existing project with no certification data,
 * `objectives` and `availableStandards` are both empty arrays.
 */
export async function getObjectiveMatrix(
  projectId: string,
): Promise<ObjectiveMatrixResponse> {
  const graph = await walkObjectiveGraph(projectId)
  const {
    objectives,
    requirementById,
    traceLinksBySource,
    testResultById,
    evidenceLinksByRequirement,
    signaturesByRequirement,
    signaturesByObjective,
    supersededSignatureIds,
  } = graph

  /** Non-superseded SignatureEvent rows for a given (already-resolved) chain. */
  const liveSignatures = (chain: { id: string }[]) =>
    chain.filter((s) => !supersededSignatureIds.has(s.id))

  const rows: ObjectiveMatrixRow[] = objectives.map((obj) => {
    // The linked requirements that actually resolve to a Requirement row.
    const linkedRequirementIds = obj.requirementLinks
      .map((l) => l.requirementId)
      .filter((id) => requirementById.has(id))

    // --- per-requirement coverage facts ---
    let requirementsApproved = 0
    const verificationTargetIds = new Set<string>()
    const passedTargetIds = new Set<string>()
    const evidenceIds = new Set<string>()
    // Coverage per requirement: covered = has >=1 reachable PASS test result
    // AND has >=1 linked VerEvidence. Used for the completionState quantifier.
    let everyRequirementCovered = linkedRequirementIds.length > 0
    let someCoverage = false

    for (const reqId of linkedRequirementIds) {
      const req = requirementById.get(reqId)!
      if ((req.reviewStatus ?? '').toLowerCase() === 'approved') requirementsApproved += 1

      // Reachable test results via trace links whose source is this requirement.
      const links = traceLinksBySource.get(reqId) ?? []
      let reqHasPass = false
      for (const link of links) {
        const tr = testResultById.get(link.targetId)
        if (!tr) continue
        verificationTargetIds.add(tr.id)
        if (tr.resultStatus === 'PASS') {
          passedTargetIds.add(tr.id)
          reqHasPass = true
        }
      }

      // Evidence linked directly to this requirement.
      const evLinks = evidenceLinksByRequirement.get(reqId) ?? []
      for (const el of evLinks) evidenceIds.add(el.evidenceId)
      const reqHasEvidence = evLinks.length > 0

      const reqCovered = reqHasPass && reqHasEvidence
      if (!reqCovered) everyRequirementCovered = false
      if (reqHasPass || reqHasEvidence) someCoverage = true
      if (verificationTargetIds.size > passedTargetIds.size) someCoverage = true
    }

    // --- signature facts ---
    const objLiveSignatures = liveSignatures(signaturesByObjective.get(obj.id) ?? [])
    let everyRequirementSigned = linkedRequirementIds.length > 0
    let liveRequirementSignatureCount = 0
    for (const reqId of linkedRequirementIds) {
      const live = liveSignatures(signaturesByRequirement.get(reqId) ?? [])
      liveRequirementSignatureCount += live.length
      if (live.length === 0) everyRequirementSigned = false
    }
    const signatureCount = liveRequirementSignatureCount + objLiveSignatures.length

    // --- completionState derivation (precise, graph-only) ---
    let completionState: ObjectiveCompletionState
    if (
      linkedRequirementIds.length > 0 &&
      everyRequirementCovered &&
      everyRequirementSigned &&
      objLiveSignatures.length > 0
    ) {
      completionState = 'signed'
    } else if (linkedRequirementIds.length > 0 && everyRequirementCovered) {
      completionState = 'closed'
    } else if (linkedRequirementIds.length > 0 && someCoverage) {
      completionState = 'partial'
    } else {
      completionState = 'open'
    }

    return {
      id: obj.id,
      objId: obj.objId,
      regRef: obj.regRef,
      standard: classifyRegRefStandard(obj.regRef),
      title: obj.title,
      criticality: obj.criticality,
      moc: obj.moc,
      requirementsLinked: linkedRequirementIds.length,
      requirementsApproved,
      verificationsPlanned: verificationTargetIds.size,
      verificationsPassed: passedTargetIds.size,
      evidenceCount: evidenceIds.size,
      signatureCount,
      completionState,
    }
  })

  // The distinct standard buckets present — data-driven, objId-stable order.
  const availableStandards = [...new Set(rows.map((r) => r.standard))]

  return { objectives: rows, availableStandards }
}
