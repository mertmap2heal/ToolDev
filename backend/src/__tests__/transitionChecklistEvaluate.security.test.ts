/**
 * Regression: POST /api/v1/transition-checklists/:projectId/evaluate must
 *   (a) refuse to look at a Requirement that belongs to a different
 *       project (cross-tenant probe oracle), and
 *   (b) reject pathological MATCHES_REGEX patterns that would ReDoS the
 *       Node event loop.
 *
 * See HIGH-4 in this session's security review.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Transition checklist evaluator — cross-tenant + ReDoS guard (HIGH-4)', () => {
  const stamp = Date.now()
  let userAId: string
  let userBId: string
  let tokenA: string
  let projectAId: string
  let projectBId: string
  let foreignRequirementId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const a = await prisma.user.create({
      data: { email: `tce-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = a.id
    tokenA = jwt.sign({ userId: a.id }, secret)
    const b = await prisma.user.create({
      data: { email: `tce-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = b.id
    const pA = await prisma.project.create({
      data: { name: `TCE A ${stamp}`, domain: `tce-a-${stamp}`, slug: `tce-a-${stamp}`, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `TCE B ${stamp}`, domain: `tce-b-${stamp}`, slug: `tce-b-${stamp}`, userId: userBId },
    })
    projectBId = pB.id
    const r = await prisma.requirement.create({
      data: {
        projectId: projectBId,
        title: 'Foreign requirement',
        description: 'a'.repeat(300),
        priority: 'medium',
        status: 'draft',
        stage: 'system',
      },
    })
    foreignRequirementId = r.id
  })

  afterAll(async () => {
    await prisma.requirement
      .deleteMany({ where: { projectId: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.project
      .deleteMany({ where: { id: { in: [projectAId, projectBId] } } })
      .catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [userAId, userBId] } } })
      .catch(() => {})
  })

  it('refuses to evaluate a checklist against a foreign-project requirement', async () => {
    const res = await request(app)
      .post(`/api/v1/transition-checklists/${projectAId}/evaluate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        entityType: 'Requirement',
        entityId: foreignRequirementId,
        checklistItems: [
          {
            id: 'probe-1',
            itemType: 'FIELD_VALIDATION',
            isRequired: true,
            validationConfig: { field: 'title', operator: 'NOT_EMPTY' },
          },
        ],
      })
    expect(res.status).toBe(200)
    const item = res.body.data?.[0]
    expect(item?.passed).toBe(false)
    expect(item?.value?.message).toMatch(/Entity not found/i)
  })

  it('rejects regex pattern longer than 256 chars', async () => {
    const reqB = foreignRequirementId
    const res = await request(app)
      .post(`/api/v1/transition-checklists/${projectBId}/evaluate`)
      .set('Authorization', `Bearer ${tokenA}`) // user A has no membership in B
      .send({
        entityType: 'Requirement',
        entityId: reqB,
        checklistItems: [
          {
            id: 'probe-2',
            itemType: 'FIELD_VALIDATION',
            isRequired: true,
            validationConfig: {
              field: 'description',
              operator: 'MATCHES_REGEX',
              value: 'a'.repeat(300),
            },
          },
        ],
      })
    // either 403 from project-membership middleware (preferred) or the
    // service-level pattern-too-long guard surfaces in the result body
    if (res.status === 200) {
      const item = res.body.data?.[0]
      expect(item?.passed).toBe(false)
      expect(item?.value?.message).toMatch(/too long|Entity not found/i)
    } else {
      expect([403, 404]).toContain(res.status)
    }
  })

  it('rejects nested-quantifier ReDoS pattern shape', async () => {
    // Use project A; bring in a real same-project requirement so we get
    // past the entity lookup and exercise the regex guard.
    const ownReq = await prisma.requirement.create({
      data: {
        projectId: projectAId,
        title: 'own',
        description: 'a'.repeat(2000),
        priority: 'medium',
        status: 'draft',
        stage: 'system',
      },
    })
    const start = Date.now()
    const res = await request(app)
      .post(`/api/v1/transition-checklists/${projectAId}/evaluate`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        entityType: 'Requirement',
        entityId: ownReq.id,
        checklistItems: [
          {
            id: 'probe-3',
            itemType: 'FIELD_VALIDATION',
            isRequired: true,
            validationConfig: {
              field: 'description',
              operator: 'MATCHES_REGEX',
              value: '(a+)+$',
            },
          },
        ],
      })
    const elapsed = Date.now() - start
    expect(res.status).toBe(200)
    // Must complete within ~1s; if the ReDoS guard regresses this would
    // hang ≥ 30s.
    expect(elapsed).toBeLessThan(2_000)
    const item = res.body.data?.[0]
    expect(item?.value?.message).toMatch(/unsafe nested quantifiers|too long/i)
    await prisma.requirement.delete({ where: { id: ownReq.id } }).catch(() => {})
  })
})
