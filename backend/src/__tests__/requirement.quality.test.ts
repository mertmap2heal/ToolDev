/**
 * N-2.3 (#428) — INCOSE/EARS write-time quality gate on the requirement
 * create/update endpoints.
 *
 * Real DB, supertest against the Express app — no mocks.
 *
 * Coverage:
 *  - POST malformed, no override          -> 422, qualityReport in body, no row created
 *  - POST malformed + override reason     -> 201, AuditLog `requirements:quality-override` written
 *  - POST clean EARS requirement          -> 201, qualityReport.hasErrors false, NO override audit
 *  - PUT description -> malformed, no ovr -> 422
 *  - PUT a non-description field on a requirement whose stored description
 *    is malformed                         -> 200 (gate runs only when description changes)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement quality gate — /api/v1/requirements (#428)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  /** A requirement whose STORED description is malformed (seeded directly). */
  let legacyMalformedId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const user = await prisma.user.create({
      data: { email: `req-quality-${stamp}@example.test`, password: 'x', name: 'Quality Tester' },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slug = `req-quality-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Quality ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    // Seed a requirement whose description is malformed, directly via Prisma
    // (bypasses the controller gate) — the legacy-data regression fixture.
    const legacy = await prisma.requirement.create({
      data: {
        projectId,
        title: `Legacy malformed ${stamp}`,
        description: 'The system shall be fast.',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      },
    })
    legacyMalformedId = legacy.id
  })

  afterAll(async () => {
    await prisma.requirementVersion.deleteMany({ where: { projectId } })
    await prisma.auditLog.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.$disconnect()
  })

  it('POST a malformed requirement without an override is rejected 422 and creates no row', async () => {
    const before = await prisma.requirement.count({ where: { projectId } })

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Malformed POST ${stamp}`,
        description: 'The system shall be fast.',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      })

    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(res.body.qualityReport).toBeDefined()
    expect(res.body.qualityReport.hasErrors).toBe(true)
    const vague = res.body.qualityReport.findings.find(
      (f: any) => f.ruleId === 'incose.vague-term',
    )
    expect(vague).toBeDefined()
    expect(vague.term).toBe('fast')

    const after = await prisma.requirement.count({ where: { projectId } })
    expect(after).toBe(before) // no row created
  })

  it('POST a malformed requirement WITH a non-blank override reason succeeds 201 and writes an audit row', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Overridden POST ${stamp}`,
        description: 'The system shall be fast.',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
        qualityOverrideReason: 'Legacy import from DOORS — will refine in the next review cycle.',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.qualityReport).toBeDefined()
    expect(res.body.qualityReport.hasErrors).toBe(true)

    const audit = await prisma.auditLog.findFirst({
      where: { projectId, action: 'requirements:quality-override' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).not.toBeNull()
    expect(audit?.userId).toBe(userId)
    const details = audit?.detailsJson as Record<string, unknown> | null
    expect(details).toBeTruthy()
    expect(details?.mode).toBe('create')
    expect(details?.requirementId).toBe(res.body.data.id)
    expect(details?.overrideReason).toContain('Legacy import from DOORS')
    expect(details?.earsPattern).toBe('ubiquitous')
    expect(Array.isArray(details?.findingRuleIds)).toBe(true)
    expect(details?.findingRuleIds).toContain('incose.vague-term')
  })

  it('POST a blank override reason does NOT bypass the gate — still 422', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Blank-override POST ${stamp}`,
        description: 'The system shall be robust.',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
        qualityOverrideReason: '   ',
      })

    expect(res.status).toBe(422)
    expect(res.body.qualityReport.hasErrors).toBe(true)
  })

  it('POST a well-formed EARS requirement succeeds 201 with no errors and no override audit', async () => {
    const auditBefore = await prisma.auditLog.count({
      where: { projectId, action: 'requirements:quality-override' },
    })

    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `Clean POST ${stamp}`,
        description:
          'When the door opens, the system shall illuminate the cabin lights within 200ms.',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.qualityReport).toBeDefined()
    expect(res.body.qualityReport.hasErrors).toBe(false)
    expect(res.body.qualityReport.earsPattern).toBe('event-driven')

    const auditAfter = await prisma.auditLog.count({
      where: { projectId, action: 'requirements:quality-override' },
    })
    expect(auditAfter).toBe(auditBefore) // a clean save writes no override audit
  })

  it('PUT changing description to malformed text without an override is rejected 422', async () => {
    // Seed a clean requirement to edit.
    const clean = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `PUT target ${stamp}`,
        description: 'The system shall record telemetry at 10Hz.',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      })
    expect(clean.status).toBe(201)
    const id = clean.body.data.id

    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'The system shall be fast.' })

    expect(res.status).toBe(422)
    expect(res.body.qualityReport).toBeDefined()
    expect(res.body.qualityReport.hasErrors).toBe(true)

    // The stored description must be unchanged by the rejected update.
    const stored = await prisma.requirement.findUnique({ where: { id } })
    expect(stored?.description).toBe('The system shall record telemetry at 10Hz.')
  })

  it('PUT a non-description field on a requirement with a malformed stored description succeeds (gate runs only on description change)', async () => {
    // legacyMalformedId has stored description "The system shall be fast." —
    // editing `priority` only must NOT be blocked.
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${legacyMalformedId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ priority: 'high' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.priority).toBe('high')
    // No qualityReport in the body — the description was not validated.
    expect(res.body.qualityReport).toBeUndefined()
  })

  it('PUT resending the SAME malformed description unchanged is not blocked (no description change)', async () => {
    // Re-sending the identical stored description is not a change -> no gate.
    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${legacyMalformedId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'The system shall be fast.', priority: 'medium' })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('PUT changing description to malformed WITH an override reason succeeds 200 and audits', async () => {
    const clean = await request(app)
      .post(`/api/v1/requirements/${projectId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: `PUT override target ${stamp}`,
        description: 'The system shall record telemetry at 5Hz.',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      })
    expect(clean.status).toBe(201)
    const id = clean.body.data.id

    const res = await request(app)
      .put(`/api/v1/requirements/${projectId}/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'The system shall be robust.',
        qualityOverrideReason: 'Customer-supplied wording, locked by contract.',
      })

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.qualityReport?.hasErrors).toBe(true)

    const audit = await prisma.auditLog.findFirst({
      where: { projectId, action: 'requirements:quality-override' },
      orderBy: { createdAt: 'desc' },
    })
    const details = audit?.detailsJson as Record<string, unknown> | null
    expect(details?.mode).toBe('update')
    expect(details?.requirementId).toBe(id)
    expect(details?.overrideReason).toContain('Customer-supplied wording')
  })
})
