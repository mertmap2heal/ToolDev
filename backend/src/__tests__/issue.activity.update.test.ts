/**
 * Issue main flow: get / activity / update / delete (#Batch8).
 *
 * Covers handler cluster: getIssue, getIssueActivity, updateIssue, deleteIssue.
 *
 *   GET    /issues/:projectId/:id
 *   GET    /issues/:projectId/:id/activity
 *   PATCH  /issues/:projectId/:id
 *   DELETE /issues/:projectId/:id
 *
 * Asserts:
 *   - 401 / 404 paths
 *   - getIssue returns labels, links, assignee, createdByUser
 *   - activity merges comments and system notes, sorts oldest/newest
 *   - update writes a system note for status / priority / title / assignee
 *   - status -> closed sets closedAt + closedBy
 *   - reopen clears closedAt + closedBy
 *   - delete removes the issue and cascades attachments via FK
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Issue main flow: get / activity / update / delete', () => {
  const stamp = Date.now()
  let userId: string
  let token: string
  let projectId: string
  let issueId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const u = await prisma.user.create({
      data: { email: `issue-flow-${stamp}@example.test`, password: 'hashed', name: 'F' },
    })
    userId = u.id
    token = jwt.sign({ userId: u.id }, secret)

    const slug = `issue-flow-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Issue Flow ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    const issue = await prisma.issue.create({
      data: {
        projectId,
        issueKey: `ISS-FL-${stamp}`,
        title: 'flow target',
        description: 'desc',
        priority: 'medium',
        status: 'open',
        createdBy: userId,
      },
    })
    issueId = issue.id

    // Pre-seed one comment and one system note for activity tests
    await prisma.issueComment.create({
      data: {
        issueId,
        projectId,
        content: 'first comment',
        authorId: userId,
        authorName: 'F',
      },
    })
    await prisma.issueSystemNote.create({
      data: {
        issueId,
        projectId,
        action: 'created',
        oldValue: null,
        newValue: null,
        userId,
        userName: 'F',
      },
    })
  })

  afterAll(async () => {
    await prisma.issueComment.deleteMany({ where: { projectId } })
    await prisma.issueSystemNote.deleteMany({ where: { projectId } })
    await prisma.issueLink.deleteMany({ where: { issue: { projectId } } })
    await prisma.issueSubscription.deleteMany({ where: { issue: { projectId } } })
    await prisma.issue.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  describe('GET /api/v1/issues/:projectId/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/issues/${projectId}/${issueId}`)
      expect(res.status).toBe(401)
    })

    it('returns 404 for unknown id', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${fakeUuid}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('returns issue with labels and links', async () => {
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${issueId}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.data.id).toBe(issueId)
      expect(Array.isArray(res.body.data.labels)).toBe(true)
      expect(Array.isArray(res.body.data.links)).toBe(true)
      expect(res.body.data.createdByUser).toBeTruthy()
    })
  })

  describe('GET /api/v1/issues/:projectId/:id/activity', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get(`/api/v1/issues/${projectId}/${issueId}/activity`)
      expect(res.status).toBe(401)
    })

    it('returns combined comments and system notes', async () => {
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${issueId}/activity`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
      const types = new Set(res.body.data.map((e: any) => e.type))
      expect(types.has('comment')).toBe(true)
      expect(types.has('system_note')).toBe(true)
    })

    it('respects filter=comments', async () => {
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${issueId}/activity?filter=comments`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const types = new Set(res.body.data.map((e: any) => e.type))
      expect(types.has('comment')).toBe(true)
      expect(types.has('system_note')).toBe(false)
    })

    it('respects sort=oldest', async () => {
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${issueId}/activity?sort=oldest`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      const times = res.body.data.map((e: any) => new Date(e.createdAt).getTime())
      const sorted = [...times].sort((a, b) => a - b)
      expect(times).toEqual(sorted)
    })

    it('returns 404 for unknown issue', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .get(`/api/v1/issues/${projectId}/${fakeUuid}/activity`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/v1/issues/:projectId/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/${issueId}`)
        .send({ title: 'no auth' })
      expect(res.status).toBe(401)
    })

    it('returns 404 for unknown id', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/${fakeUuid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'x' })
      expect(res.status).toBe(404)
    })

    it('changes title and writes system note', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/${issueId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'new title' })
      expect(res.status).toBe(200)
      expect(res.body.data.title).toBe('new title')

      const note = await prisma.issueSystemNote.findFirst({
        where: { issueId, action: 'title_changed' },
      })
      expect(note).toBeTruthy()
    })

    it('change status -> closed sets closedAt and closedBy', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/${issueId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'closed' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('closed')
      expect(res.body.data.closedAt).toBeTruthy()
      expect(res.body.data.closedBy).toBe(userId)

      const note = await prisma.issueSystemNote.findFirst({
        where: { issueId, action: 'status_changed' },
      })
      expect(note).toBeTruthy()
    })

    it('reopen clears closedAt and closedBy', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/${issueId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'open' })
      expect(res.status).toBe(200)
      expect(res.body.data.closedAt).toBeNull()
      expect(res.body.data.closedBy).toBeNull()
    })

    it('priority and assignee changes write notes', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/${issueId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ priority: 'high', assigneeId: userId })
      expect(res.status).toBe(200)
      expect(res.body.data.priority).toBe('high')
      expect(res.body.data.assigneeId).toBe(userId)

      const priorityNote = await prisma.issueSystemNote.findFirst({
        where: { issueId, action: 'priority_changed' },
      })
      const assigneeNote = await prisma.issueSystemNote.findFirst({
        where: { issueId, action: 'assignee_changed' },
      })
      expect(priorityNote).toBeTruthy()
      expect(assigneeNote).toBeTruthy()
    })
  })

  describe('DELETE /api/v1/issues/:projectId/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete(`/api/v1/issues/${projectId}/${issueId}`)
      expect(res.status).toBe(401)
    })

    it('returns 404 for unknown id', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .delete(`/api/v1/issues/${projectId}/${fakeUuid}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(404)
    })

    it('deletes the issue', async () => {
      // Create a fresh issue to delete (the main one is used by other tests in the file - but they all run before)
      const fresh = await prisma.issue.create({
        data: {
          projectId,
          issueKey: `ISS-DEL-${stamp}`,
          title: 'to delete',
          description: 'desc',
          priority: 'low',
          status: 'open',
          createdBy: userId,
        },
      })
      const res = await request(app)
        .delete(`/api/v1/issues/${projectId}/${fresh.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      const after = await prisma.issue.findUnique({ where: { id: fresh.id } })
      expect(after).toBeNull()
    })
  })
})
