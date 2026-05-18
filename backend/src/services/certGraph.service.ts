// NX-7 (#460) — the shared certification-graph traversal.
//
// `walkObjectiveGraph(projectId)` walks the cert artefact graph once:
//   CertObjective -> CertObjectiveRequirementLink -> Requirement
//     -> TraceLink(sourceId=req) -> VerTestResult(target)
//     -> VerEvidenceLink(linkedEntityId=req) -> VerEvidence
//     -> SignatureEvent(Requirement | CertObjective)
//
// Every cross-table join is ONE batched `findMany({ where: { id: { in } } })`
// joined in-memory with a Map — there is no per-row query, so the query count
// is constant (~10) and independent of the objective / requirement count.
//
// This walk was first written inline in `auditPackage/composer.service.ts`
// (N-2.2, #425). It is extracted here so the N-2.2 PSAC composer AND the NX-7
// objective-completion matrix consume ONE traversal — a second copy would
// drift. Each consumer adds its own in-memory rollup over the resolved rows;
// the graph walk itself is never duplicated.
//
// It tolerates empty SignatureEvent chains: requirement / objective sign-off is
// not yet wired to SignatureEvent on every surface (R-3 is a primitive wired
// per ticket), so a missing chain is simply an empty array, never an error.
import { prisma } from '../lib/prisma'
import type {
  CertObjective,
  CertObjectiveRequirementLink,
  Requirement,
  TraceLink,
  VerTestResult,
  VerEvidence,
  VerEvidenceLink,
  SignatureEvent,
} from '@prisma/client'

/** A CertObjective row with its requirement links eagerly loaded. */
export type ObjectiveWithLinks = CertObjective & {
  requirementLinks: CertObjectiveRequirementLink[]
}

/**
 * The fully resolved certification graph for one project.
 *
 * All collections are the raw Prisma rows; all `*By*` fields are in-memory
 * indices a consumer joins against without further I/O. Build a per-objective
 * or per-requirement rollup over these — never query inside a loop.
 */
export interface ObjectiveGraph {
  /** Objectives, ordered by `objId` ascending, each with its requirement links. */
  objectives: ObjectiveWithLinks[]
  /** Every distinct requirement id linked to any objective. */
  requirementIds: string[]
  /** requirement id -> Requirement row. */
  requirementById: Map<string, Requirement>
  /** requirement id -> the trace links whose `sourceId` is that requirement. */
  traceLinksBySource: Map<string, TraceLink[]>
  /** trace-link target id -> VerTestResult row (only ids that ARE test results). */
  testResultById: Map<string, VerTestResult>
  /** evidence id -> VerEvidence row. */
  evidenceById: Map<string, VerEvidence>
  /** requirement id -> the VerEvidenceLink rows whose `linkedEntityId` is that requirement. */
  evidenceLinksByRequirement: Map<string, VerEvidenceLink[]>
  /** requirement id -> its SignatureEvent rows, oldest-first. */
  signaturesByRequirement: Map<string, SignatureEvent[]>
  /** cert-objective id -> its SignatureEvent rows, oldest-first. */
  signaturesByObjective: Map<string, SignatureEvent[]>
  /** The set of SignatureEvent ids that have been superseded. */
  supersededSignatureIds: Set<string>
  /** signer user id -> display name. */
  signerNameById: Map<string, string>
}

/** Group an array into a Map keyed by a derived value. */
function groupBy<T, K>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const bucket = map.get(key)
    if (bucket) bucket.push(item)
    else map.set(key, [item])
  }
  return map
}

/** Distinct, order-preserving. */
function distinct(values: string[]): string[] {
  return [...new Set(values)]
}

/**
 * Walk the certification artefact graph for a project in a constant number of
 * batched queries. Returns the resolved rows plus the in-memory join indices.
 *
 * The caller is responsible for having verified the project exists / the
 * caller's access — this is a pure read with no membership check of its own.
 * For a project with no certification data every collection is simply empty.
 */
export async function walkObjectiveGraph(projectId: string): Promise<ObjectiveGraph> {
  // --- objectives + their requirement links (1 query, include) ---
  const objectives = await prisma.certObjective.findMany({
    where: { projectId },
    orderBy: { objId: 'asc' },
    include: { requirementLinks: true },
  })

  // Every linked requirement id, across all objectives.
  const requirementIds = distinct(
    objectives.flatMap((o) => o.requirementLinks.map((l) => l.requirementId)),
  )

  // --- the linked requirements (1 batched query) ---
  const requirements = requirementIds.length
    ? await prisma.requirement.findMany({ where: { id: { in: requirementIds } } })
    : []
  const requirementById = new Map(requirements.map((r) => [r.id, r]))

  // --- trace links + their test results ---
  // requirement -> verification trace links (1 query, scoped to the project).
  const traceLinks = requirementIds.length
    ? await prisma.traceLink.findMany({
        where: { projectId, sourceId: { in: requirementIds } },
      })
    : []
  const traceLinksBySource = groupBy(traceLinks, (t) => t.sourceId)

  // Resolve which trace-link targets are real VerTestResult rows (1 batched query).
  const traceTargetIds = distinct(traceLinks.map((t) => t.targetId))
  const testResults = traceTargetIds.length
    ? await prisma.verTestResult.findMany({
        where: { projectId, id: { in: traceTargetIds } },
      })
    : []
  const testResultById = new Map(testResults.map((tr) => [tr.id, tr]))

  // --- evidence index — VerEvidenceLink -> VerEvidence ---
  // Evidence linked directly to a requirement (linkedEntityId is the requirement id).
  const evidenceLinks = requirementIds.length
    ? await prisma.verEvidenceLink.findMany({
        where: { linkedEntityId: { in: requirementIds } },
      })
    : []
  const evidenceLinksByRequirement = groupBy(evidenceLinks, (l) => l.linkedEntityId)
  const evidenceIds = distinct(evidenceLinks.map((l) => l.evidenceId))
  const evidenceRows = evidenceIds.length
    ? await prisma.verEvidence.findMany({
        where: { projectId, id: { in: evidenceIds } },
      })
    : []
  const evidenceById = new Map(evidenceRows.map((e) => [e.id, e]))

  // --- signature chains — one batched SignatureEvent query covering BOTH
  // the linked requirements AND the objectives themselves ---
  const objectiveIds = objectives.map((o) => o.id)
  const signatureRows =
    requirementIds.length || objectiveIds.length
      ? await prisma.signatureEvent.findMany({
          where: {
            OR: [
              { linkedEntityType: 'Requirement', linkedEntityId: { in: requirementIds } },
              { linkedEntityType: 'CertObjective', linkedEntityId: { in: objectiveIds } },
            ],
          },
          orderBy: { signedAt: 'asc' },
        })
      : []
  // The set of signature rows that have been superseded (their id appears as
  // someone else's supersededById).
  const supersededSignatureIds = new Set(
    signatureRows.map((s) => s.supersededById).filter((v): v is string => Boolean(v)),
  )
  const signaturesByRequirement = groupBy(
    signatureRows.filter((s) => s.linkedEntityType === 'Requirement'),
    (s) => s.linkedEntityId,
  )
  const signaturesByObjective = groupBy(
    signatureRows.filter((s) => s.linkedEntityType === 'CertObjective'),
    (s) => s.linkedEntityId,
  )

  // Resolve signer display names (1 batched query).
  const signerIds = distinct(signatureRows.map((s) => s.signerUserId))
  const signers = signerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: signerIds } },
        select: { id: true, name: true },
      })
    : []
  const signerNameById = new Map(signers.map((u) => [u.id, u.name]))

  return {
    objectives,
    requirementIds,
    requirementById,
    traceLinksBySource,
    testResultById,
    evidenceById,
    evidenceLinksByRequirement,
    signaturesByRequirement,
    signaturesByObjective,
    supersededSignatureIds,
    signerNameById,
  }
}
