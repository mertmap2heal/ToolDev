// N-2.2 (#425) — the opinionated audit-package content composer.
//
// `composePsac(projectId)` is a pure function: a project id in, a structured
// `ComposedAuditPackage` out. No rendering, no Prisma writes. It walks the
// artefact graph CertObjective -> CertObjectiveRequirementLink -> Requirement
// -> TraceLink -> VerTestResult -> VerEvidence -> SignatureEvent.
//
// Every cross-table join uses ONE batched `findMany({ where: { id: { in } } })`
// and is then joined in-memory with a Map. There is no per-row query — the
// query count is constant (~9), independent of the requirement count. This is
// what makes the <=30s SLA for ~1k requirements hold.
//
// It tolerates empty SignatureEvent chains: requirement sign-off is not wired
// to SignatureEvent yet (R-3 is a primitive; consumers wire it per ticket), so
// a requirement's signatureChain is simply an empty array where unsigned.
import { prisma } from '../../lib/prisma'
import type {
  ComposedAuditPackage,
  ComposedEvidence,
  ComposedObjective,
  ComposedRequirement,
  ComposedSignature,
  ComposedMilestone,
} from './types'

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

  // --- Step 2: objectives + their requirement links (1 query, include) ---
  const objectives = await prisma.certObjective.findMany({
    where: { projectId },
    orderBy: { objId: 'asc' },
    include: { requirementLinks: true },
  })

  // Collect every linked requirement id across all objectives.
  const requirementIds = distinct(
    objectives.flatMap((o) => o.requirementLinks.map((l) => l.requirementId)),
  )

  // --- Step 3: the linked requirements in one batched query ---
  const requirements = requirementIds.length
    ? await prisma.requirement.findMany({
        where: { id: { in: requirementIds } },
      })
    : []
  const requirementById = new Map(requirements.map((r) => [r.id, r]))

  // --- Step 4: trace links + their test results ---
  // Requirement -> verification trace links (one query, scoped to the project).
  const traceLinks = requirementIds.length
    ? await prisma.traceLink.findMany({
        where: { projectId, sourceId: { in: requirementIds } },
      })
    : []
  const traceLinksBySource = groupBy(traceLinks, (t) => t.sourceId)

  // The trace-link targets that are test results. linkType 'verifies' or a
  // target type naming a test result; we keep every distinct target id and
  // resolve which are real VerTestResult rows with one batched query.
  const traceTargetIds = distinct(traceLinks.map((t) => t.targetId))
  const testResults = traceTargetIds.length
    ? await prisma.verTestResult.findMany({
        where: { projectId, id: { in: traceTargetIds } },
      })
    : []
  const testResultById = new Map(testResults.map((tr) => [tr.id, tr]))

  // --- Step 5: evidence index — VerEvidenceLink -> VerEvidence ---
  // Evidence linked directly to a requirement (linkedEntityId is the requirement id).
  const evidenceLinks = requirementIds.length
    ? await prisma.verEvidenceLink.findMany({
        where: { linkedEntityId: { in: requirementIds } },
      })
    : []
  const evidenceIds = distinct(evidenceLinks.map((l) => l.evidenceId))
  const evidenceRows = evidenceIds.length
    ? await prisma.verEvidence.findMany({
        where: { projectId, id: { in: evidenceIds } },
      })
    : []
  const evidenceById = new Map(evidenceRows.map((e) => [e.id, e]))
  // requirementId -> evidence id[]
  const evidenceIdsByRequirement = groupBy(evidenceLinks, (l) => l.linkedEntityId)

  // --- Step 6: signature chains — one batched SignatureEvent query ---
  const signatureRows = requirementIds.length
    ? await prisma.signatureEvent.findMany({
        where: { linkedEntityType: 'Requirement', linkedEntityId: { in: requirementIds } },
        orderBy: { signedAt: 'asc' },
      })
    : []
  // The set of signature rows that have been superseded (their id appears as
  // someone else's supersededById).
  const supersededIds = new Set(
    signatureRows.map((s) => s.supersededById).filter((v): v is string => Boolean(v)),
  )
  const signaturesByRequirement = groupBy(signatureRows, (s) => s.linkedEntityId)

  // Resolve signer display names in one batched query.
  const signerIds = distinct(signatureRows.map((s) => s.signerUserId))
  const signers = signerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: signerIds } },
        select: { id: true, name: true },
      })
    : []
  const signerNameById = new Map(signers.map((u) => [u.id, u.name]))

  // --- Step 7: milestones for the Schedule section (1 query) ---
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

  // --- Step 8: assemble in-memory — no I/O past this point ---
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
        (evidenceIdsByRequirement.get(link.requirementId) ?? []).map((l) => l.evidenceId),
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
