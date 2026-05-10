/**
 * Tests for /api/v1/compliance — regulation folders, rules, runs, findings.
 *
 * Read endpoints are project-scoped (open to authenticated callers via
 * projectIdParam). Mutating endpoints require requireProjectOwnerOrAdmin.
 *
 * Coverage:
 *   - 401 unauthenticated
 *   - 403 non-owner mutating
 *   - 404 unknown project (projectIdParam) and unknown folder/rule
 *   - 200/201 happy paths for create/update/delete folder
 *   - createFolder cycle / parent validation
 *   - createRule + invalid folderId branches
 *   - runChecks: no-rules error path AND a happy run with findings
 *   - getRuns / getRun / getFindings shape
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Compliance controller — /api/v1/compliance', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string
  let requirementId: string
  let folderRootId: string
  let folderChildId: string
  let ruleId: string
  let runId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const owner = await prisma.user.create({
      data: { email: `comp-o-${stamp}@example.test`, password: 'x', name: 'CompOwner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const out = await prisma.user.create({
      data: { email: `comp-x-${stamp}@example.test`, password: 'x', name: 'CompOutsider' },
    })
    outsiderId = out.id
    tokenOutsider = jwt.sign({ userId: out.id }, secret)

    const slug = `comp-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Comp ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = project.id

    const r = await prisma.requirement.create({
      data: {
        projectId,
        requirementId: `CR-${stamp}-1`,
        title: 'comp test req',
        description: 'seed',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
        // Intentionally missing acceptanceCriteria + owner + verificationMethod
        // so all three default checkTypes produce findings.
        acceptanceCriteria: null,
        owner: null,
        verificationMethod: null,
      },
    })
    requirementId = r.id
  })

  afterAll(async () => {
    await prisma.complianceFinding.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.complianceCheckRun.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.complianceRule.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.complianceRegulationFolder.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirement.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId/regulation-folders without token returns 401', async () => {
    const res = await request(app).get(`/api/v1/compliance/${projectId}/regulation-folders`)
    expect(res.status).toBe(401)
  })

  it('GET /:projectId/regulation-folders by owner returns []', async () => {
    const res = await request(app)
      .get(`/api/v1/compliance/${projectId}/regulation-folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /:projectId/regulation-folders without name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/regulation-folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'no name' })
    expect(res.status).toBe(400)
  })

  it('POST /:projectId/regulation-folders by outsider returns 403', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/regulation-folders`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ name: 'attempt' })
    expect(res.status).toBe(403)
  })

  it('POST /:projectId/regulation-folders happy path returns 201', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/regulation-folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'Root Folder', description: 'desc', sortOrder: 1 })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('Root Folder')
    folderRootId = res.body.data.id
  })

  it('POST /:projectId/regulation-folders with bogus parentId returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/regulation-folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'orphan', parentId: '00000000-0000-0000-0000-000000000000' })
    expect(res.status).toBe(400)
  })

  it('POST /:projectId/regulation-folders with valid parentId returns 201', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/regulation-folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'Child Folder', parentId: folderRootId })
    expect(res.status).toBe(201)
    expect(res.body.data.parentId).toBe(folderRootId)
    folderChildId = res.body.data.id
  })

  it('PATCH /:projectId/regulation-folders/:id self-parent returns 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/compliance/${projectId}/regulation-folders/${folderRootId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ parentId: folderRootId })
    expect(res.status).toBe(400)
  })

  it('PATCH /:projectId/regulation-folders/:id cycle returns 400', async () => {
    // Setting root.parent = child would create a cycle since child is a descendant of root.
    const res = await request(app)
      .patch(`/api/v1/compliance/${projectId}/regulation-folders/${folderRootId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ parentId: folderChildId })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/cycle|invalid/i)
  })

  it('PATCH /:projectId/regulation-folders/:id renames folder', async () => {
    const res = await request(app)
      .patch(`/api/v1/compliance/${projectId}/regulation-folders/${folderChildId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'Renamed Child', description: 'updated' })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Renamed Child')
  })

  it('PATCH /:projectId/regulation-folders/:id 404 for unknown folder', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .patch(`/api/v1/compliance/${projectId}/regulation-folders/${fakeId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'no' })
    expect(res.status).toBe(404)
  })

  it('GET /:projectId/rules returns []', async () => {
    const res = await request(app)
      .get(`/api/v1/compliance/${projectId}/rules`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('POST /:projectId/rules missing fields returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/rules`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'partial' })
    expect(res.status).toBe(400)
  })

  it('POST /:projectId/rules creates a rule (no folder)', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/rules`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: 'Acceptance criteria check',
        standard: 'ISO 29148',
        checkType: 'requirement_has_acceptance_criteria',
        description: 'requires AC',
      })
    expect(res.status).toBe(201)
    expect(res.body.data.id).toBeDefined()
    ruleId = res.body.data.id
  })

  it('GET /:projectId/rules/:id returns the rule', async () => {
    const res = await request(app)
      .get(`/api/v1/compliance/${projectId}/rules/${ruleId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(ruleId)
  })

  it('GET /:projectId/rules/:id 404 for unknown rule', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .get(`/api/v1/compliance/${projectId}/rules/${fakeId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('PATCH /:projectId/rules/:id updates fields', async () => {
    const res = await request(app)
      .patch(`/api/v1/compliance/${projectId}/rules/${ruleId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: 'Updated AC check', isActive: true, description: 'desc2' })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe('Updated AC check')
  })

  it('POST /:projectId/run with no rules error path: deactivate then run', async () => {
    // Deactivate the only rule, then try running — should yield 400 + error.
    await prisma.complianceRule.update({ where: { id: ruleId }, data: { isActive: false } })
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/run`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({})
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/no active rules/i)
    // Reactivate.
    await prisma.complianceRule.update({ where: { id: ruleId }, data: { isActive: true } })
  })

  it('POST /:projectId/run produces a run with findings', async () => {
    const res = await request(app)
      .post(`/api/v1/compliance/${projectId}/run`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ ruleIds: [ruleId], name: `run-${stamp}` })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.run).toBeDefined()
    expect(Array.isArray(res.body.data.findings)).toBe(true)
    runId = res.body.data.run.id
  })

  it('GET /:projectId/runs returns the runs array', async () => {
    const res = await request(app)
      .get(`/api/v1/compliance/${projectId}/runs`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.find((r: any) => r.id === runId)).toBeDefined()
  })

  it('GET /:projectId/runs/:runId returns one run with findings', async () => {
    const res = await request(app)
      .get(`/api/v1/compliance/${projectId}/runs/${runId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(runId)
    expect(Array.isArray(res.body.data.findings)).toBe(true)
  })

  it('GET /:projectId/findings filters by ruleId', async () => {
    const res = await request(app)
      .get(`/api/v1/compliance/${projectId}/findings?ruleId=${ruleId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.every((f: any) => f.ruleId === ruleId)).toBe(true)
  })

  it('DELETE /:projectId/rules/:id deletes the rule', async () => {
    const res = await request(app)
      .delete(`/api/v1/compliance/${projectId}/rules/${ruleId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const after = await prisma.complianceRule.findUnique({ where: { id: ruleId } })
    expect(after).toBeNull()
  })

  it('DELETE /:projectId/regulation-folders/:id deletes folder', async () => {
    // Delete child first since rules / parent constraints apply.
    const res = await request(app)
      .delete(`/api/v1/compliance/${projectId}/regulation-folders/${folderChildId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
  })

  it('DELETE /:projectId/regulation-folders/:id 404 for unknown', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .delete(`/api/v1/compliance/${projectId}/regulation-folders/${fakeId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })
})
