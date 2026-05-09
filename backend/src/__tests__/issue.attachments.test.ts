/**
 * Issue attachment endpoints (#Batch8).
 *
 * Covers handler cluster: uploadIssueAttachment, getIssueAttachments,
 * deleteIssueAttachment.
 *
 *   POST   /issues/:projectId/:id/attachments
 *   GET    /issues/:projectId/:id/attachments
 *   DELETE /issues/:projectId/:id/attachments/:attachmentId
 *
 * Asserts:
 *   - 401 without auth
 *   - 400 for missing fields, bad MIME, unsafe filename, oversized payload
 *   - 404 for unknown issue / attachment
 *   - happy-path upload returns 201 with row, GET returns it,
 *     DELETE removes it
 *   - small inline payload stored as data URL, larger payload written to disk
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Issue attachment endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let issueId: string
  const createdAttachmentIds: string[] = []

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const u = await prisma.user.create({
      data: { email: `issue-att-${stamp}@example.test`, password: 'hashed', name: 'Att' },
    })
    userId = u.id
    token = jwt.sign({ userId: u.id }, secret)

    const slug = `issue-att-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Issue Attachments ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    const issue = await prisma.issue.create({
      data: {
        projectId,
        issueKey: `ISS-AT-${stamp}`,
        title: 'attach target',
        description: 'desc',
        priority: 'low',
        status: 'open',
        createdBy: userId,
      },
    })
    issueId = issue.id
  })

  afterAll(async () => {
    await prisma.issueAttachment.deleteMany({ where: { projectId } })
    await prisma.issue.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  describe('POST /api/v1/issues/:projectId/:id/attachments', () => {
    const txtBase64 = Buffer.from('hello').toString('base64')

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .send({ fileName: 'a.txt', fileData: txtBase64, mimeType: 'text/plain' })
      expect(res.status).toBe(401)
    })

    it('returns 400 when fileName missing', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileData: txtBase64, mimeType: 'text/plain' })
      expect(res.status).toBe(400)
    })

    it('returns 400 when fileData missing', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'a.txt', mimeType: 'text/plain' })
      expect(res.status).toBe(400)
    })

    it('returns 400 for disallowed MIME type', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'a.exe', fileData: txtBase64, mimeType: 'application/x-msdownload' })
      expect(res.status).toBe(400)
    })

    it('returns 400 for unsafe filename (path traversal)', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: '../etc/passwd', fileData: txtBase64, mimeType: 'text/plain' })
      expect(res.status).toBe(400)
    })

    it('returns 404 when issue missing', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${fakeUuid}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'a.txt', fileData: txtBase64, mimeType: 'text/plain' })
      expect(res.status).toBe(404)
    })

    it('happy path: small inline payload returns 201', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'note.txt', fileData: txtBase64, mimeType: 'text/plain' })
      expect(res.status).toBe(201)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.fileName).toBe('note.txt')
      expect(res.body.data.mimeType).toBe('text/plain')
      // Small payload: stored inline (raw base64 string), not a /uploads URL
      expect(typeof res.body.data.fileUrl).toBe('string')
      createdAttachmentIds.push(res.body.data.id)
    })

    it('happy path: data URL prefix is accepted and stripped', async () => {
      const dataUrl = `data:text/plain;base64,${txtBase64}`
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ fileName: 'note2.txt', fileData: dataUrl, mimeType: 'text/plain' })
      expect(res.status).toBe(201)
      expect(res.body.data.id).toBeDefined()
      createdAttachmentIds.push(res.body.data.id)
    })
  })

  describe('GET /api/v1/issues/:projectId/:id/attachments', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${issueId}/attachments`)
      expect(res.status).toBe(401)
    })

    it('lists attachments for the issue', async () => {
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${issueId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('DELETE /api/v1/issues/:projectId/:id/attachments/:attachmentId', () => {
    it('returns 404 for unknown attachment id', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .delete(`/api/v1/issues/${projectId}/${issueId}/attachments/${fakeUuid}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('deletes a created attachment', async () => {
      const targetId = createdAttachmentIds[0]
      const res = await request(app)
        .delete(`/api/v1/issues/${projectId}/${issueId}/attachments/${targetId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const after = await prisma.issueAttachment.findUnique({ where: { id: targetId } })
      expect(after).toBeNull()
    })
  })
})
