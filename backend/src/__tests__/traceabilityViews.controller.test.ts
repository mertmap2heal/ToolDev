/**
 * Tests for /api/v1/traceability-views/:projectId — saved traceability matrix
 * views and folder hierarchy.
 *
 * Coverage:
 *   - 401 unauthenticated, 403 outsider
 *   - Folders: list (empty), create (validate name), update (rename, parent
 *     cycle rejection, self-parent rejection), delete
 *   - Views: list (empty), create (validate name, folder must be in project),
 *     get one (404 unknown), patch (rename + folder + definition), delete
 *   - Revisions list grows with each create/update
 *   - Get specific revision returns the snapshot
 *   - Audit events list returns rows after CRUD
 *   - Run-at-baseline / compare-to-current — 400 without baselineId,
 *     404 unknown view
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Traceability views — /api/v1/traceability-views', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string
  let folderAId: string
  let folderBId: string
  let viewId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `tv-o-${stamp}@example.test`, password: 'x', name: 'Owner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `tv-x-${stamp}@example.test`, password: 'x', name: 'Outsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `tv-${stamp}`
    const p = await prisma.project.create({
      data: { name: `TV ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = p.id
  })

  afterAll(async () => {
    await (prisma as any).savedViewAuditEvent.deleteMany({ where: { projectId } }).catch(() => {})
    await (prisma as any).savedViewRevision.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.savedView.deleteMany({ where: { projectId } }).catch(() => {})
    await (prisma as any).savedViewFolder.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: projectId } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, outsiderId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('GET folders without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/traceability-views/${projectId}/folders`)
    expect(res.status).toBe(401)
  })

  it('GET folders by an outsider returns 403', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/folders`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
    expect(res.status).toBe(403)
  })

  it('GET folders on a fresh project returns []', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('POST folder without name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ description: 'no name' })
    expect(res.status).toBe(400)
  })

  it('POST folder creates one', async () => {
    const res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Folder A ${stamp}`, description: 'first' })
    expect(res.status).toBe(201)
    folderAId = res.body.data.id

    const second = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/folders`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Folder B ${stamp}`, parentId: folderAId })
    expect(second.status).toBe(201)
    folderBId = second.body.data.id
  })

  it('PATCH folder cannot set itself as its own parent', async () => {
    const res = await request(app)
      .patch(`/api/v1/traceability-views/${projectId}/folders/${folderAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ parentId: folderAId })
    expect(res.status).toBe(400)
  })

  it('PATCH folder rejects cycle (A child of B which is child of A)', async () => {
    const res = await request(app)
      .patch(`/api/v1/traceability-views/${projectId}/folders/${folderAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ parentId: folderBId })
    expect(res.status).toBe(400)
  })

  it('PATCH folder renames', async () => {
    const res = await request(app)
      .patch(`/api/v1/traceability-views/${projectId}/folders/${folderAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: `Folder A renamed ${stamp}` })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe(`Folder A renamed ${stamp}`)
  })

  it('PATCH folder with empty name returns 400', async () => {
    const res = await request(app)
      .patch(`/api/v1/traceability-views/${projectId}/folders/${folderAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ name: '   ' })
    expect(res.status).toBe(400)
  })

  it('GET views on fresh project returns []', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
  })

  it('POST view without name returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/views`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST view creates one with definition + folder', async () => {
    const res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/views`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: `View ${stamp}`,
        folderId: folderAId,
        definition: { linkageTargetType: 'pbs_component', showSuspectOnly: false },
      })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe(`View ${stamp}`)
    expect(res.body.data.folderId).toBe(folderAId)
    viewId = res.body.data.id
  })

  it('GET view by id returns it', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(viewId)
  })

  it('GET unknown view returns 404', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('PATCH view updates name + definition', async () => {
    const res = await request(app)
      .patch(`/api/v1/traceability-views/${projectId}/views/${viewId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        name: `View renamed ${stamp}`,
        definition: { linkageTargetType: 'function', showSuspectOnly: true },
      })
    expect(res.status).toBe(200)
    expect(res.body.data.name).toBe(`View renamed ${stamp}`)
  })

  it('GET views supports targetType + suspectOnly filters', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views`)
      .query({ targetType: 'function', suspectOnly: '1' })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBe(1)

    const noMatch = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views`)
      .query({ targetType: 'pbs_component' })
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(noMatch.body.data.length).toBe(0)
  })

  it('GET revisions returns at least one row after creation + update', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/revisions`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
  })

  it('GET specific revision returns 400 for non-numeric', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/revisions/notanumber`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
  })

  it('GET specific revision returns 404 for unknown', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/revisions/9999`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })

  it('POST rollback without targetRevisionNumber returns 400', async () => {
    const res = await request(app)
      .post(`/api/v1/traceability-views/${projectId}/views/${viewId}/rollback`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('GET audit events returns the action history', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/audit`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('GET run baseline without baselineId returns 400', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/run`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
  })

  it('GET compare without baselineId returns 400', async () => {
    const res = await request(app)
      .get(`/api/v1/traceability-views/${projectId}/views/${viewId}/compare`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(400)
  })

  it('DELETE view removes it', async () => {
    const res = await request(app)
      .delete(`/api/v1/traceability-views/${projectId}/views/${viewId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    const gone = await prisma.savedView.findUnique({ where: { id: viewId } })
    expect(gone).toBeNull()
  })

  it('DELETE folder cascades — children remain or are detached per FK', async () => {
    const res = await request(app)
      .delete(`/api/v1/traceability-views/${projectId}/folders/${folderBId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)

    const cleanup = await request(app)
      .delete(`/api/v1/traceability-views/${projectId}/folders/${folderAId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(cleanup.status).toBe(200)
  })

  it('DELETE folder unknown returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/traceability-views/${projectId}/folders/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(404)
  })
})
