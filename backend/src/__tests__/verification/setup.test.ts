/**
 * Verification — test setup integration tests (#241, sub-task of #133).
 *
 * Routes under /api/v1/verification/setups/:projectId:
 *   GET    /:projectId
 *   POST   /:projectId                                                  — create DRAFT
 *   GET    /:projectId/:id                                              — single + 404 IDOR
 *   PATCH  /:projectId/:id                                              — update + status transition
 *   DELETE /:projectId/:id                                              — also clears VerTestResultLink rows
 *   POST   /:projectId/:id/approve                                      — DRAFT->APPROVED
 *   POST   /:projectId/:id/deprecate                                    — APPROVED->DEPRECATED
 *   POST   /:projectId/:id/diagram/export                               — JSON payload
 *   POST   /:projectId/:setupId/components/:componentId/manual          — MIME allowlist (#119/#131)
 *   401 on every route without a token
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../../server'
import { prisma } from '../../lib/prisma'

// 4 bytes of "PDF" magic, base64 — passes the MIME allowlist; small, well under MAX_FILE_BYTES.
const PDF_BASE64 = 'JVBERi0xLjQK'
const HTML_BASE64 = 'PGgxPmhpPC9oMT4='

describe('Verification setup endpoints (#241)', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectA: string
  let projectB: string
  let setupInB: string
  const createdSetupIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'

    const user = await prisma.user.create({
      data: {
        email: `ver-st-${stamp}@example.com`,
        password: 'hashed',
        name: 'Ver ST User',
      },
    })
    userId = user.id
    token = jwt.sign({ userId }, secret)

    const slugA = `ver-st-a-${stamp}`
    const slugB = `ver-st-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Ver ST A ${stamp}`, domain: slugA, slug: slugA, userId },
    })
    projectA = pA.id
    const pB = await prisma.project.create({
      data: { name: `Ver ST B ${stamp}`, domain: slugB, slug: slugB, userId },
    })
    projectB = pB.id

    await prisma.projectMember.createMany({
      data: [
        { projectId: projectA, userId, role: 'owner', status: 'accepted' },
        { projectId: projectB, userId, role: 'owner', status: 'accepted' },
      ],
    })

    const sB = await prisma.verTestSetup.create({
      data: {
        projectId: projectB,
        name: `IDOR Target Setup ${stamp}`,
        environmentType: 'BENCH',
        version: '1.0',
        status: 'DRAFT',
      },
    })
    setupInB = sB.id
    createdSetupIds.push(setupInB)
  })

  afterAll(async () => {
    const projectIds = [projectA, projectB]
    await prisma.verTestResultLink
      .deleteMany({ where: { linkedEntityType: 'TEST_SETUP', linkedEntityId: { in: createdSetupIds } } })
      .catch(() => {})
    await prisma.verTestSetup
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.projectMember
      .deleteMany({ where: { projectId: { in: projectIds } } })
      .catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } }).catch(() => {})
    await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    await prisma.$disconnect()
  })

  describe('CRUD + transitions', () => {
    it('POST creates a DRAFT setup', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Setup A ${stamp}`, environmentType: 'BENCH' })
      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('DRAFT')
      expect(res.body.data.environmentType).toBe('BENCH')
      createdSetupIds.push(res.body.data.id)
    })

    it('POST returns 400 when name or environmentType missing', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'no env' })
      expect(res.status).toBe(400)
    })

    it('GET list returns only project A setups', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/setups/${projectA}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const ids = res.body.data.map((s: { id: string }) => s.id)
      expect(ids).not.toContain(setupInB)
    })

    it('GET single returns 404 cross-project (IDOR)', async () => {
      const res = await request(app)
        .get(`/api/v1/verification/setups/${projectA}/${setupInB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('PATCH rejects invalid transition (DRAFT -> DEPRECATED)', async () => {
      const s = await prisma.verTestSetup.create({
        data: { projectId: projectA, name: `Bad trans ${stamp}`, environmentType: 'HIL', version: '1.0', status: 'DRAFT' },
      })
      createdSetupIds.push(s.id)
      const res = await request(app)
        .patch(`/api/v1/verification/setups/${projectA}/${s.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'DEPRECATED' })
      expect(res.status).toBe(500)
      expect(res.body.error).toMatch(/transition/i)
    })

    it('approve/deprecate move through the FSM', async () => {
      const s = await prisma.verTestSetup.create({
        data: { projectId: projectA, name: `FSM ${stamp}`, environmentType: 'SIL', version: '1.0', status: 'DRAFT' },
      })
      createdSetupIds.push(s.id)

      const approve = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${s.id}/approve`)
        .set('Authorization', `Bearer ${token}`)
      expect(approve.status).toBe(200)
      expect(approve.body.data.status).toBe('APPROVED')

      const deprecate = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${s.id}/deprecate`)
        .set('Authorization', `Bearer ${token}`)
      expect(deprecate.status).toBe(200)
      expect(deprecate.body.data.status).toBe('DEPRECATED')
    })

    it('returns 401 without a token', async () => {
      const res = await request(app).get(`/api/v1/verification/setups/${projectA}`)
      expect(res.status).toBe(401)
    })
  })

  describe('DELETE /:projectId/:id', () => {
    it('removes the setup and its TEST_SETUP links', async () => {
      const s = await prisma.verTestSetup.create({
        data: { projectId: projectA, name: `Del me ${stamp}`, environmentType: 'BENCH', version: '1.0', status: 'DRAFT' },
      })
      createdSetupIds.push(s.id)
      const tr = await prisma.verTestResult.create({
        data: {
          projectId: projectA,
          title: `TR for setup ${stamp}`,
          storageRef: '/uploads/x.json',
          fileName: 'x.json',
        },
      })
      await prisma.verTestResultLink.create({
        data: { testResultId: tr.id, linkedEntityType: 'TEST_SETUP', linkedEntityId: s.id },
      })

      const res = await request(app)
        .delete(`/api/v1/verification/setups/${projectA}/${s.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)

      const gone = await prisma.verTestSetup.findUnique({ where: { id: s.id } })
      expect(gone).toBeNull()
      const linksLeft = await prisma.verTestResultLink.count({
        where: { linkedEntityType: 'TEST_SETUP', linkedEntityId: s.id },
      })
      expect(linksLeft).toBe(0)

      // tidy-up the orphan VerTestResult so afterAll cascade works
      await prisma.verTestResult.delete({ where: { id: tr.id } }).catch(() => {})
    })

    it('returns 404 for cross-project DELETE (IDOR)', async () => {
      const res = await request(app)
        .delete(`/api/v1/verification/setups/${projectA}/${setupInB}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
      const intact = await prisma.verTestSetup.findUnique({ where: { id: setupInB } })
      expect(intact).not.toBeNull()
    })
  })

  describe('POST /:id/diagram/export', () => {
    it('returns 200 with diagramData passed through', async () => {
      const s = await prisma.verTestSetup.create({
        data: {
          projectId: projectA,
          name: `Diagram ${stamp}`,
          environmentType: 'BENCH',
          version: '1.0',
          status: 'DRAFT',
          diagramData: { nodes: [{ id: 'n1' }], edges: [] },
        },
      })
      createdSetupIds.push(s.id)
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${s.id}/diagram/export`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.format).toBe('JSON')
      expect(res.body.data.diagramData).toEqual({ nodes: [{ id: 'n1' }], edges: [] })
    })

    it('returns 404 for cross-project diagram export (IDOR)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${setupInB}/diagram/export`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('POST /:setupId/components/:componentId/manual upload (MIME allowlist)', () => {
    it('accepts a PDF and writes manual metadata onto the component', async () => {
      const s = await prisma.verTestSetup.create({
        data: {
          projectId: projectA,
          name: `Manual ${stamp}`,
          environmentType: 'BENCH',
          version: '1.0',
          status: 'DRAFT',
          components: [{ id: 'c1', name: 'Sensor' }],
        },
      })
      createdSetupIds.push(s.id)

      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${s.id}/components/c1/manual`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'manual.pdf', mimeType: 'application/pdf', fileData: PDF_BASE64 })
      expect(res.status).toBe(200)
      expect(res.body.data.manual.mimeType).toBe('application/pdf')
      expect(res.body.data.manual.fileSize).toBeGreaterThan(0)

      const reread = await prisma.verTestSetup.findUnique({ where: { id: s.id } })
      const comps = (reread?.components as Array<{ id: string; manual?: unknown }>) ?? []
      expect(comps.find((c) => c.id === 'c1')?.manual).toBeDefined()
    })

    it('rejects HTML payload with 415 (allowlist)', async () => {
      const s = await prisma.verTestSetup.create({
        data: {
          projectId: projectA,
          name: `Bad MIME ${stamp}`,
          environmentType: 'BENCH',
          version: '1.0',
          status: 'DRAFT',
          components: [{ id: 'c1', name: 'Sensor' }],
        },
      })
      createdSetupIds.push(s.id)
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${s.id}/components/c1/manual`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'evil.html', mimeType: 'text/html', fileData: HTML_BASE64 })
      expect(res.status).toBe(415)
      expect(res.body.error).toMatch(/Unsupported file type/i)
    })

    it('returns 400 when required body field missing', async () => {
      const s = await prisma.verTestSetup.create({
        data: {
          projectId: projectA,
          name: `Missing ${stamp}`,
          environmentType: 'BENCH',
          version: '1.0',
          status: 'DRAFT',
          components: [{ id: 'c1', name: 'Sensor' }],
        },
      })
      createdSetupIds.push(s.id)
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${s.id}/components/c1/manual`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'manual.pdf' })
      expect(res.status).toBe(400)
    })

    it('returns 404 when componentId is unknown', async () => {
      const s = await prisma.verTestSetup.create({
        data: {
          projectId: projectA,
          name: `No comp ${stamp}`,
          environmentType: 'BENCH',
          version: '1.0',
          status: 'DRAFT',
          components: [{ id: 'c1', name: 'Sensor' }],
        },
      })
      createdSetupIds.push(s.id)
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${s.id}/components/c-ghost/manual`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'm.pdf', mimeType: 'application/pdf', fileData: PDF_BASE64 })
      expect(res.status).toBe(404)
      expect(res.body.error).toMatch(/Component not found/i)
    })

    it('returns 404 when setupId is in another project (IDOR)', async () => {
      const res = await request(app)
        .post(`/api/v1/verification/setups/${projectA}/${setupInB}/components/c1/manual`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'm.pdf', mimeType: 'application/pdf', fileData: PDF_BASE64 })
      expect(res.status).toBe(404)
    })
  })
})
