// N-2.2 (#425) — tests for the audit-package composer.
//
// Hits the real DB (no mocks, per .claude/kb/backend-patterns.md). Seeds a
// project with the full artefact graph — objectives, requirement links, trace
// links, test results, evidence, and SignatureEvent rows — and asserts
// composePsac() assembles the structure correctly: objective -> evidence,
// the per-requirement signature chain (signed, unsigned, superseded), and the
// graph counts.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../../lib/prisma'
import { composePsac } from '../../services/auditPackage/composer.service'

describe('Audit package composer (#425) — composePsac', () => {
  const ts = Date.now()
  let userId = ''
  let projectId = ''
  // objective A: 1 signed requirement (chain incl. a superseded entry) + evidence
  // objective B: 1 unsigned requirement, no evidence
  // objective C: no requirements
  let reqSignedId = ''
  let reqUnsignedId = ''

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `audit-composer-${ts}@example.com`,
        password: 'x',
        name: `Audit Composer ${ts}`,
      },
    })
    userId = user.id

    const project = await prisma.project.create({
      data: {
        name: `Audit Composer Project ${ts}`,
        domain: 'test',
        slug: `audit-composer-${ts}`,
        userId,
        description: 'Composer test project',
      },
    })
    projectId = project.id

    await prisma.certContext.create({
      data: { projectId, authority: 'FAA', certBasis: 'CS-25', standards: ['DO-178C'] },
    })

    // --- requirements ---
    const reqSigned = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `REQ-${ts}-1`,
        title: 'Signed requirement',
        description: 'A requirement with a signature chain',
        priority: 'High',
        status: 'approved',
        stage: 'definition',
        verificationMethod: 'Test',
      },
    })
    reqSignedId = reqSigned.id

    const reqUnsigned = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `REQ-${ts}-2`,
        title: 'Unsigned requirement',
        description: 'A requirement with no signature chain',
        priority: 'Medium',
        status: 'draft',
        stage: 'definition',
      },
    })
    reqUnsignedId = reqUnsigned.id

    // --- objectives + requirement links ---
    const objA = await prisma.certObjective.create({
      data: {
        projectId,
        objId: `OBJ-${ts}-A`,
        regRef: 'CS-25.1309',
        title: 'Objective A',
        moc: 'Test',
        status: 'Complete',
        criticality: 'High',
      },
    })
    const objB = await prisma.certObjective.create({
      data: {
        projectId,
        objId: `OBJ-${ts}-B`,
        regRef: 'CS-25.1322',
        title: 'Objective B',
        moc: 'Analysis',
        status: 'Partial',
        criticality: 'Medium',
      },
    })
    // objective C — deliberately no requirement links
    await prisma.certObjective.create({
      data: {
        projectId,
        objId: `OBJ-${ts}-C`,
        regRef: 'CS-25.1431',
        title: 'Objective C',
        moc: 'Inspection',
        status: 'Open',
        criticality: 'Low',
      },
    })

    await prisma.certObjectiveRequirementLink.create({
      data: { certObjectiveId: objA.id, requirementId: reqSignedId },
    })
    await prisma.certObjectiveRequirementLink.create({
      data: { certObjectiveId: objB.id, requirementId: reqUnsignedId },
    })

    // --- test result + trace link (requirement -> verifies -> test result) ---
    const testResult = await prisma.verTestResult.create({
      data: {
        projectId,
        title: 'Test result for signed requirement',
        storageRef: 'mem://tr-1',
        fileName: 'tr1.json',
        resultStatus: 'PASS',
      },
    })
    await prisma.traceLink.create({
      data: {
        projectId,
        sourceType: 'requirement',
        sourceId: reqSignedId,
        targetType: 'testResult',
        targetId: testResult.id,
        linkType: 'verifies',
      },
    })

    // --- evidence linked to the signed requirement ---
    const evidence = await prisma.verEvidence.create({
      data: {
        projectId,
        evidenceType: 'TEST_REPORT',
        title: 'Brake actuator test report',
        storageRef: 'mem://ev-1',
      },
    })
    await prisma.verEvidenceLink.create({
      data: {
        userId,
        evidenceId: evidence.id,
        linkedEntityType: 'TEST_CASE',
        linkedEntityId: reqSignedId,
      },
    })

    // --- signature chain on the signed requirement: original + supersession ---
    const sigOriginal = await prisma.signatureEvent.create({
      data: {
        linkedEntityType: 'Requirement',
        linkedEntityId: reqSignedId,
        signerUserId: userId,
        meaningCode: 'review',
        reauthAt: new Date(),
        contentHash: 'a'.repeat(64),
      },
    })
    // a later signature supersedes the original (append-only revocation chain)
    await prisma.signatureEvent.create({
      data: {
        linkedEntityType: 'Requirement',
        linkedEntityId: reqSignedId,
        signerUserId: userId,
        meaningCode: 'approval',
        reauthAt: new Date(),
        contentHash: 'b'.repeat(64),
        supersededById: sigOriginal.id,
      },
    })
  })

  afterAll(async () => {
    // SignatureEvent is append-only — its rows must be removed with raw SQL.
    await prisma.$executeRaw`DELETE FROM "SignatureEvent" WHERE "linkedEntityId" IN (${reqSignedId}, ${reqUnsignedId})`
    await prisma.verEvidenceLink.deleteMany({ where: { linkedEntityId: { in: [reqSignedId] } } })
    await prisma.verEvidence.deleteMany({ where: { projectId } })
    await prisma.traceLink.deleteMany({ where: { projectId } })
    await prisma.verTestResult.deleteMany({ where: { projectId } })
    await prisma.certObjectiveRequirementLink.deleteMany({
      where: { requirementId: { in: [reqSignedId, reqUnsignedId] } },
    })
    await prisma.certObjective.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.certContext.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('returns null for a non-existent project', async () => {
    const result = await composePsac('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('composes the cert context and project metadata', async () => {
    const result = await composePsac(projectId)
    expect(result).not.toBeNull()
    expect(result!.artefactType).toBe('PSAC')
    expect(result!.project.name).toContain('Audit Composer Project')
    expect(result!.project.description).toBe('Composer test project')
    expect(result!.certContext.authority).toBe('FAA')
    expect(result!.certContext.standards).toContain('DO-178C')
  })

  it('walks the objective graph — every objective composed, in objId order', async () => {
    const result = await composePsac(projectId)
    expect(result!.objectives).toHaveLength(3)
    const objIds = result!.objectives.map((o) => o.objId)
    expect(objIds).toEqual([...objIds].sort())
  })

  it('assembles requirements + evidence onto the right objective', async () => {
    const result = await composePsac(projectId)
    const objA = result!.objectives.find((o) => o.objId.endsWith('-A'))!
    expect(objA.requirements).toHaveLength(1)
    expect(objA.requirements[0].requirementKey).toBe(`REQ-${ts}-1`)
    // evidence linked to the requirement surfaces on the objective's index
    expect(objA.evidence).toHaveLength(1)
    expect(objA.evidence[0].title).toBe('Brake actuator test report')
    // the trace-linked test result status is reachable
    expect(objA.requirements[0].testResultStatuses).toContain('PASS')
  })

  it('composes the per-requirement signature chain oldest-first, marking superseded rows', async () => {
    const result = await composePsac(projectId)
    const objA = result!.objectives.find((o) => o.objId.endsWith('-A'))!
    const chain = objA.requirements[0].signatureChain
    expect(chain).toHaveLength(2)
    // oldest-first ordering: the review signature precedes the approval
    expect(chain[0].meaningCode).toBe('review')
    expect(chain[1].meaningCode).toBe('approval')
    // the original (review) signature is marked superseded; the latest is not
    expect(chain[0].superseded).toBe(true)
    expect(chain[1].superseded).toBe(false)
    // the signer name resolved
    expect(chain[0].signerName).toContain('Audit Composer')
  })

  it('tolerates an unsigned requirement — empty signature chain, no error', async () => {
    const result = await composePsac(projectId)
    const objB = result!.objectives.find((o) => o.objId.endsWith('-B'))!
    expect(objB.requirements).toHaveLength(1)
    expect(objB.requirements[0].signatureChain).toEqual([])
    // objective B has no evidence linked
    expect(objB.evidence).toEqual([])
  })

  it('tolerates an objective with no requirements', async () => {
    const result = await composePsac(projectId)
    const objC = result!.objectives.find((o) => o.objId.endsWith('-C'))!
    expect(objC.requirements).toEqual([])
    expect(objC.evidence).toEqual([])
  })

  it('computes the graph counts', async () => {
    const result = await composePsac(projectId)
    const counts = result!.counts
    expect(counts.objectives).toBe(3)
    expect(counts.objectivesComplete).toBe(1)
    expect(counts.objectivesPartial).toBe(1)
    expect(counts.objectivesOpen).toBe(1)
    expect(counts.requirements).toBe(2)
    expect(counts.evidence).toBe(1)
    expect(counts.signatures).toBe(2)
  })
})
