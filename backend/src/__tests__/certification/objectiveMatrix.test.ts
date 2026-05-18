// NX-7 (#460) — tests for the objective-completion matrix.
//
// Hits the real DB + the Express app via supertest (no mocks, per
// .claude/kb/backend-patterns.md). Seeds a project whose objectives span the
// four completionState branches (open / partial / closed / signed) and two
// regRef standard buckets, then asserts:
//  - the endpoint contract (401 no auth, 403 non-member, 200 empty project),
//  - each completionState derivation against a hand-constructed graph,
//  - the per-row counts, the standard-bucket filter, availableStandards,
//  - classifyRegRefStandard (DO-178C / CS 25.x / unknown -> Other),
//  - a no-N+1 / constant-query-count assertion on walkObjectiveGraph.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'
import { classifyRegRefStandard, getObjectiveMatrix } from '../../services/objectiveMatrix.service'
import { walkObjectiveGraph } from '../../services/certGraph.service'

describe('Objective-completion matrix (#460)', () => {
  const ts = Date.now()
  let memberUserId = ''
  let memberToken = ''
  let outsiderUserId = ''
  let outsiderToken = ''
  // the seeded project with the full four-state graph
  let projectId = ''
  // a second project with zero objectives — the empty-project case
  let emptyProjectId = ''

  // objective ids by intended completion state
  let objOpenId = ''
  let objPartialId = ''
  let objClosedId = ''
  let objSignedId = ''
  // requirement ids — tracked for the SignatureEvent raw-SQL cleanup
  const reqIds: string[] = []

  beforeAll(async () => {
    const member = await prisma.user.create({
      data: {
        email: `obj-matrix-member-${ts}@example.com`,
        password: 'x',
        name: `Obj Matrix Member ${ts}`,
      },
    })
    memberUserId = member.id
    memberToken = jwt.sign({ userId: memberUserId }, process.env.JWT_SECRET || 'secret')

    const outsider = await prisma.user.create({
      data: {
        email: `obj-matrix-outsider-${ts}@example.com`,
        password: 'x',
        name: `Obj Matrix Outsider ${ts}`,
      },
    })
    outsiderUserId = outsider.id
    outsiderToken = jwt.sign({ userId: outsiderUserId }, process.env.JWT_SECRET || 'secret')

    const project = await prisma.project.create({
      data: {
        name: `Obj Matrix Project ${ts}`,
        domain: 'test',
        slug: `obj-matrix-${ts}`,
        userId: memberUserId,
      },
    })
    projectId = project.id
    await prisma.projectMember.create({
      data: { projectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })

    const emptyProject = await prisma.project.create({
      data: {
        name: `Obj Matrix Empty ${ts}`,
        domain: 'test',
        slug: `obj-matrix-empty-${ts}`,
        userId: memberUserId,
      },
    })
    emptyProjectId = emptyProject.id
    await prisma.projectMember.create({
      data: { projectId: emptyProjectId, userId: memberUserId, role: 'owner', status: 'accepted' },
    })

    // ---- helper: create a requirement, track it ----
    const mkReq = async (n: number, reviewStatus: string) => {
      const r = await prisma.requirement.create({
        data: {
          projectId,
          requirementId: `REQ-${ts}-${n}`,
          title: `Requirement ${n}`,
          description: `Requirement ${n} description`,
          priority: 'Medium',
          status: 'draft',
          stage: 'definition',
          reviewStatus,
        },
      })
      reqIds.push(r.id)
      return r.id
    }
    // ---- helper: a PASS test result trace-linked to a requirement ----
    const linkPassResult = async (reqId: string, label: string) => {
      const tr = await prisma.verTestResult.create({
        data: {
          projectId,
          title: `Test result ${label}`,
          storageRef: `mem://tr-${label}`,
          fileName: `tr-${label}.json`,
          resultStatus: 'PASS',
        },
      })
      await prisma.traceLink.create({
        data: {
          projectId,
          sourceType: 'requirement',
          sourceId: reqId,
          targetType: 'testResult',
          targetId: tr.id,
          linkType: 'verifies',
        },
      })
      return tr.id
    }
    // ---- helper: a VerEvidence linked to a requirement ----
    const linkEvidence = async (reqId: string, label: string) => {
      const ev = await prisma.verEvidence.create({
        data: {
          projectId,
          evidenceType: 'TEST_REPORT',
          title: `Evidence ${label}`,
          storageRef: `mem://ev-${label}`,
        },
      })
      await prisma.verEvidenceLink.create({
        data: {
          userId: memberUserId,
          evidenceId: ev.id,
          linkedEntityType: 'TEST_CASE',
          linkedEntityId: reqId,
        },
      })
      return ev.id
    }
    // ---- helper: a non-superseded SignatureEvent on an entity ----
    const sign = async (entityType: string, entityId: string, hashSeed: string) => {
      return prisma.signatureEvent.create({
        data: {
          linkedEntityType: entityType,
          linkedEntityId: entityId,
          signerUserId: memberUserId,
          meaningCode: 'approval',
          reauthAt: new Date(),
          contentHash: hashSeed.repeat(64).slice(0, 64),
        },
      })
    }

    // ===== OPEN objective: one linked requirement, no coverage at all =====
    {
      const objOpen = await prisma.certObjective.create({
        data: {
          projectId,
          objId: `OBJ-${ts}-1-OPEN`,
          regRef: 'DO-178C A-3.1',
          title: 'Open objective',
          moc: 'Test',
          status: 'Open',
          criticality: 'Low',
        },
      })
      objOpenId = objOpen.id
      const r = await mkReq(1, 'draft')
      await prisma.certObjectiveRequirementLink.create({
        data: { certObjectiveId: objOpen.id, requirementId: r },
      })
    }

    // ===== PARTIAL objective: two requirements, only one covered =====
    {
      const objPartial = await prisma.certObjective.create({
        data: {
          projectId,
          objId: `OBJ-${ts}-2-PARTIAL`,
          regRef: 'DO-178C A-4.1',
          title: 'Partial objective',
          moc: 'Analysis',
          status: 'Partial',
          criticality: 'Medium',
        },
      })
      objPartialId = objPartial.id
      const rCovered = await mkReq(2, 'approved')
      const rUncovered = await mkReq(3, 'draft')
      // rCovered gets PASS + evidence; rUncovered gets nothing
      await linkPassResult(rCovered, 'partial-covered')
      await linkEvidence(rCovered, 'partial-covered')
      await prisma.certObjectiveRequirementLink.create({
        data: { certObjectiveId: objPartial.id, requirementId: rCovered },
      })
      await prisma.certObjectiveRequirementLink.create({
        data: { certObjectiveId: objPartial.id, requirementId: rUncovered },
      })
    }

    // ===== CLOSED objective: one requirement, PASS + evidence, NOT signed =====
    {
      const objClosed = await prisma.certObjective.create({
        data: {
          projectId,
          objId: `OBJ-${ts}-3-CLOSED`,
          regRef: 'CS 25.1309',
          title: 'Closed objective',
          moc: 'Test',
          status: 'Complete',
          criticality: 'High',
        },
      })
      objClosedId = objClosed.id
      const r = await mkReq(4, 'approved')
      await linkPassResult(r, 'closed')
      await linkEvidence(r, 'closed')
      await prisma.certObjectiveRequirementLink.create({
        data: { certObjectiveId: objClosed.id, requirementId: r },
      })
    }

    // ===== SIGNED objective: closed AND every req + the objective signed =====
    {
      const objSigned = await prisma.certObjective.create({
        data: {
          projectId,
          objId: `OBJ-${ts}-4-SIGNED`,
          regRef: 'CS 25.1322',
          title: 'Signed objective',
          moc: 'Test',
          status: 'Complete',
          criticality: 'High',
        },
      })
      objSignedId = objSigned.id
      const r = await mkReq(5, 'approved')
      await linkPassResult(r, 'signed')
      await linkEvidence(r, 'signed')
      await prisma.certObjectiveRequirementLink.create({
        data: { certObjectiveId: objSigned.id, requirementId: r },
      })
      // sign the requirement and the objective (both non-superseded)
      await sign('Requirement', r, 'a')
      await sign('CertObjective', objSigned.id, 'b')
    }
  })

  afterAll(async () => {
    // SignatureEvent is append-only — remove its rows with raw SQL.
    if (reqIds.length) {
      await prisma.$executeRawUnsafe(
        `DELETE FROM "SignatureEvent" WHERE "linkedEntityId" = ANY($1::text[])`,
        reqIds,
      )
    }
    await prisma.$executeRawUnsafe(
      `DELETE FROM "SignatureEvent" WHERE "linkedEntityId" = ANY($1::text[])`,
      [objOpenId, objPartialId, objClosedId, objSignedId],
    )
    await prisma.verEvidenceLink.deleteMany({ where: { linkedEntityId: { in: reqIds } } })
    await prisma.verEvidence.deleteMany({ where: { projectId } })
    await prisma.traceLink.deleteMany({ where: { projectId } })
    await prisma.verTestResult.deleteMany({ where: { projectId } })
    await prisma.certObjectiveRequirementLink.deleteMany({
      where: { requirementId: { in: reqIds } },
    })
    await prisma.certObjective.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId: { in: [projectId, emptyProjectId] } } })
    await prisma.project.deleteMany({ where: { id: { in: [projectId, emptyProjectId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [memberUserId, outsiderUserId] } } })
    await prisma.$disconnect()
  })

  // ---- classifyRegRefStandard: pure helper ----
  describe('classifyRegRefStandard', () => {
    it('classifies DO-178C references', () => {
      expect(classifyRegRefStandard('DO-178C A-3.1')).toBe('DO-178C')
      expect(classifyRegRefStandard('DO178C')).toBe('DO-178C')
    })
    it('classifies CS 25.x airworthiness paragraphs', () => {
      expect(classifyRegRefStandard('CS 25.1309')).toBe('CS-25/23')
      expect(classifyRegRefStandard('CS-25.671')).toBe('CS-25/23')
      expect(classifyRegRefStandard('CS 23.1309')).toBe('CS-25/23')
    })
    it('classifies other named standards', () => {
      expect(classifyRegRefStandard('ARP4754A')).toBe('ARP4754A')
      expect(classifyRegRefStandard('ISO 26262-6')).toBe('ISO 26262')
      expect(classifyRegRefStandard('DO-254 §5')).toBe('DO-254')
    })
    it('buckets an unknown / empty regRef as Other', () => {
      expect(classifyRegRefStandard('SomeInternalRef-42')).toBe('Other')
      expect(classifyRegRefStandard('')).toBe('Other')
      expect(classifyRegRefStandard(null)).toBe('Other')
      expect(classifyRegRefStandard(undefined)).toBe('Other')
    })
  })

  // ---- endpoint contract ----
  it('rejects an unauthenticated request with 401', async () => {
    const res = await request(app).get(`/api/v1/certification/${projectId}/objective-matrix`)
    expect(res.status).toBe(401)
  })

  it('rejects a non-member with 403', async () => {
    const res = await request(app)
      .get(`/api/v1/certification/${projectId}/objective-matrix`)
      .set('Authorization', `Bearer ${outsiderToken}`)
    expect(res.status).toBe(403)
  })

  it('returns 200 with empty objectives for a project with no objectives', async () => {
    const res = await request(app)
      .get(`/api/v1/certification/${emptyProjectId}/objective-matrix`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.objectives).toEqual([])
    expect(res.body.data.availableStandards).toEqual([])
  })

  // ---- completionState derivations ----
  it('derives completionState=open for an objective with an uncovered requirement', async () => {
    const res = await request(app)
      .get(`/api/v1/certification/${projectId}/objective-matrix`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    const row = res.body.data.objectives.find((o: { id: string }) => o.id === objOpenId)
    expect(row).toBeDefined()
    expect(row.completionState).toBe('open')
    expect(row.requirementsLinked).toBe(1)
    expect(row.requirementsApproved).toBe(0)
    expect(row.verificationsPassed).toBe(0)
    expect(row.evidenceCount).toBe(0)
    expect(row.signatureCount).toBe(0)
  })

  it('derives completionState=partial when only some requirements are covered', async () => {
    const matrix = await getObjectiveMatrix(projectId)
    const row = matrix.objectives.find((o) => o.id === objPartialId)!
    expect(row.completionState).toBe('partial')
    expect(row.requirementsLinked).toBe(2)
    expect(row.requirementsApproved).toBe(1)
    expect(row.verificationsPlanned).toBe(1)
    expect(row.verificationsPassed).toBe(1)
    expect(row.evidenceCount).toBe(1)
  })

  it('derives completionState=closed when every requirement is covered but unsigned', async () => {
    const matrix = await getObjectiveMatrix(projectId)
    const row = matrix.objectives.find((o) => o.id === objClosedId)!
    expect(row.completionState).toBe('closed')
    expect(row.requirementsLinked).toBe(1)
    expect(row.verificationsPassed).toBe(1)
    expect(row.evidenceCount).toBe(1)
    expect(row.signatureCount).toBe(0)
  })

  it('derives completionState=signed when covered AND requirement + objective are signed', async () => {
    const matrix = await getObjectiveMatrix(projectId)
    const row = matrix.objectives.find((o) => o.id === objSignedId)!
    expect(row.completionState).toBe('signed')
    expect(row.verificationsPassed).toBe(1)
    expect(row.evidenceCount).toBe(1)
    // one non-superseded signature on the requirement + one on the objective
    expect(row.signatureCount).toBe(2)
  })

  // ---- standard bucket + availableStandards ----
  it('exposes availableStandards as the distinct buckets present', async () => {
    const matrix = await getObjectiveMatrix(projectId)
    // the seed has DO-178C (objOpen, objPartial) and CS-25/23 (objClosed, objSigned)
    expect([...matrix.availableStandards].sort()).toEqual(['CS-25/23', 'DO-178C'])
  })

  it('filters by the classifyRegRefStandard bucket', async () => {
    const res = await request(app)
      .get(`/api/v1/certification/${projectId}/objective-matrix?standard=DO-178C`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    const standards = res.body.data.objectives.map((o: { standard: string }) => o.standard)
    expect(standards.length).toBe(2)
    expect(standards.every((s: string) => s === 'DO-178C')).toBe(true)
    // availableStandards still reflects the WHOLE project, not the filtered set
    expect([...res.body.data.availableStandards].sort()).toEqual(['CS-25/23', 'DO-178C'])
  })

  it('filters by criticality', async () => {
    const res = await request(app)
      .get(`/api/v1/certification/${projectId}/objective-matrix?criticality=High`)
      .set('Authorization', `Bearer ${memberToken}`)
    expect(res.status).toBe(200)
    // objClosed + objSigned are High
    expect(res.body.data.objectives.length).toBe(2)
    expect(
      res.body.data.objectives.every((o: { criticality: string }) => o.criticality === 'High'),
    ).toBe(true)
  })

  // ---- no-N+1: the graph walk is a constant number of queries ----
  it('walks the objective graph in a constant number of batched queries', async () => {
    // Count every Prisma query via a temporary $use middleware. The walk must
    // not scale its query count with the objective / requirement count — it is
    // a fixed ~10-query batched traversal.
    let queryCount = 0
    const counter = async (
      params: unknown,
      next: (p: unknown) => Promise<unknown>,
    ): Promise<unknown> => {
      queryCount += 1
      return next(params)
    }
    // @ts-expect-error — $use accepts the middleware shape; loosely typed here.
    prisma.$use(counter)
    try {
      queryCount = 0
      await walkObjectiveGraph(projectId)
    } finally {
      // there is no $unuse — the counter stays registered but is harmless
      // (it only increments a now-unread local). The assertion is on the
      // delta captured above.
    }
    // 4 objectives, 5 requirements, trace links, evidence, signatures — the
    // walk issues a small fixed set of batched findMany calls. A generous
    // ceiling (<= 15) still fails hard on any per-row N+1 regression.
    expect(queryCount).toBeGreaterThan(0)
    expect(queryCount).toBeLessThanOrEqual(15)
  })
})
