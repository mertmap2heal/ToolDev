// N-2.2 (#425) — the opinionated audit-package content composer.
//
// `composePsac(projectId)` is a pure function: a project id in, a structured
// `ComposedAuditPackage` out. No rendering, no Prisma writes.
//
// The artefact-graph walk (CertObjective -> CertObjectiveRequirementLink ->
// Requirement -> TraceLink -> VerTestResult -> VerEvidence -> SignatureEvent)
// was extracted to the shared `certGraph.service.ts` (NX-7, #460) so this PSAC
// composer AND the objective-completion matrix consume ONE traversal. The walk
// runs a constant number of batched `findMany({ where: { id: { in } } })`
// queries — independent of the requirement count — which is what makes the
// <=30s SLA for ~1k requirements hold. This composer adds only its own
// PSAC-specific in-memory assembly on top of the resolved graph (plus one
// extra CertMilestone query the matrix does not need).
//
// It tolerates empty SignatureEvent chains: requirement sign-off is not wired
// to SignatureEvent yet (R-3 is a primitive; consumers wire it per ticket), so
// a requirement's signatureChain is simply an empty array where unsigned.
import { prisma } from '../../lib/prisma'
import { walkObjectiveGraph } from '../certGraph.service'
import type {
  ComposedAuditPackage,
  ComposedEvidence,
  ComposedObjective,
  ComposedRequirement,
  ComposedSignature,
  ComposedMilestone,
} from './types'

/** Distinct, order-preserving. */
function distinct(values: string[]): string[] {
  return [...new Set(values)]
}

/**
 * Compose a PSAC audit package from the CURRENT state of a project.
 *
 * Returns `null` when the project does not exist (the controller maps that to
 * 404). For an existing project with no certification data, every collection
 * is empty and the renderer emits the engineer-voice "no data" lines — a PSAC
 * always renders its full fixed structure.
 */
export async function composePsac(projectId: string): Promise<ComposedAuditPackage | null> {
  // --- Step 1: project + cert context (2 queries, both keyed on projectId) ---
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, description: true },
  })
  if (!project) return null

  const ctx = await prisma.certContext.findUnique({ where: { projectId } })
  const certContext = {
    authority: ctx?.authority ?? 'EASA',
    certBasis: ctx?.certBasis ?? 'CS-25',
    standards: (ctx?.standards as string[] | undefined) ?? ['ARP4754A', 'DO-178C'],
  }

  // --- Step 2: the certification artefact graph (shared traversal) ---
  // One constant-query-count walk; the composer reuses every resolved index.
  const graph = await walkObjectiveGraph(projectId)
  const {
    objectives,
    requirementById,
    traceLinksBySource,
    testResultById,
    evidenceById,
    evidenceLinksByRequirement,
    signaturesByRequirement,
    supersededSignatureIds: supersededIds,
    signerNameById,
  } = graph

  // --- Step 3: milestones for the Schedule section (1 query) ---
  const milestoneRows = await prisma.certMilestone.findMany({
    where: { projectId },
    orderBy: { date: 'asc' },
  })
  const milestones: ComposedMilestone[] = milestoneRows.map((m) => ({
    name: m.name,
    date: m.date.toISOString(),
    type: m.type,
    status: m.status,
  }))

  // --- Step 4: assemble in-memory — no I/O past this point ---
  let signatureCount = 0
  const composedObjectives: ComposedObjective[] = objectives.map((obj) => {
    const composedRequirements: ComposedRequirement[] = obj.requirementLinks
      .map((link) => requirementById.get(link.requirementId))
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .map((req) => {
        // Test-result statuses reachable from this requirement via trace links.
        const links = traceLinksBySource.get(req.id) ?? []
        const statuses = distinct(
          links
            .map((l) => testResultById.get(l.targetId))
            .filter((tr): tr is NonNullable<typeof tr> => Boolean(tr))
            .map((tr) => tr.resultStatus),
        )

        // Signature chain, oldest-first (the query already ordered by signedAt).
        const chainRows = signaturesByRequirement.get(req.id) ?? []
        const signatureChain: ComposedSignature[] = chainRows.map((s) => ({
          id: s.id,
          signerUserId: s.signerUserId,
          signerName: signerNameById.get(s.signerUserId) ?? null,
          meaningCode: s.meaningCode,
          signedAt: s.signedAt.toISOString(),
          reauthAt: s.reauthAt.toISOString(),
          contentHash: s.contentHash,
          superseded: supersededIds.has(s.id),
        }))
        signatureCount += signatureChain.length

        return {
          id: req.id,
          requirementKey: req.requirementId ?? req.id,
          title: req.title,
          description: req.description,
          verificationMethod: req.verificationMethod ?? null,
          status: req.status,
          testResultStatuses: statuses,
          signatureChain,
        }
      })

    // Evidence index for this objective — the union of evidence linked to its
    // satisfying requirements, de-duplicated.
    const objEvidenceIds = distinct(
      obj.requirementLinks.flatMap((link) =>
        (evidenceLinksByRequirement.get(link.requirementId) ?? []).map((l) => l.evidenceId),
      ),
    )
    const evidence: ComposedEvidence[] = objEvidenceIds
      .map((id) => evidenceById.get(id))
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .map((e) => ({
        id: e.id,
        evidenceType: e.evidenceType,
        title: e.title,
        description: e.description ?? null,
        storageRef: e.storageRef,
        checksum: e.checksum ?? null,
        createdAt: e.createdAt.toISOString(),
      }))

    return {
      id: obj.id,
      objId: obj.objId,
      regRef: obj.regRef,
      title: obj.title,
      moc: obj.moc,
      status: obj.status,
      criticality: obj.criticality,
      notes: obj.notes,
      requirements: composedRequirements,
      evidence,
    }
  })

  const evidenceTotal = distinct(
    composedObjectives.flatMap((o) => o.evidence.map((e) => e.id)),
  ).length
  const requirementTotal = distinct(
    composedObjectives.flatMap((o) => o.requirements.map((r) => r.id)),
  ).length

  return {
    artefactType: 'PSAC',
    project: { id: project.id, name: project.name, description: project.description ?? null },
    certContext,
    objectives: composedObjectives,
    milestones,
    counts: {
      objectives: composedObjectives.length,
      objectivesComplete: composedObjectives.filter((o) => o.status === 'Complete').length,
      objectivesPartial: composedObjectives.filter((o) => o.status === 'Partial').length,
      objectivesOpen: composedObjectives.filter(
        (o) => o.status !== 'Complete' && o.status !== 'Partial',
      ).length,
      requirements: requirementTotal,
      evidence: evidenceTotal,
      signatures: signatureCount,
    },
    composedAt: new Date().toISOString(),
  }
}
