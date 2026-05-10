/**
 * Issue comment endpoints (#Batch8).
 *
 * Covers handler cluster: createIssueComment, updateIssueComment, deleteIssueComment.
 *
 *   POST   /issues/:projectId/:id/comments
 *   PATCH  /issues/:projectId/comments/:commentId
 *   DELETE /issues/:projectId/comments/:commentId
 *
 * Asserts:
 *   - 401 without auth on each
 *   - 404 when issue or comment is missing
 *   - 403 when caller is not the comment author (update/delete)
 *   - happy-path create returns 201 with the row
 *   - happy-path update changes content
 *   - happy-path delete removes the row
 *   - parentCommentId threading works
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Issue comment endpoints', () => {
  const stamp = Date.now()
  let userId: string
  let otherUserId: string
  let token: string
  let otherToken: string
  let projectId: string
  let issueId: string
  let createdCommentId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const u1 = await prisma.user.create({
      data: { email: `issue-comment-${stamp}@example.test`, password: 'hashed', name: 'Author' },
    })
    userId = u1.id
    token = jwt.sign({ userId: u1.id }, secret)

    const u2 = await prisma.user.create({
      data: { email: `issue-comment-other-${stamp}@example.test`, password: 'hashed', name: 'Other' },
    })
    otherUserId = u2.id
    otherToken = jwt.sign({ userId: u2.id }, secret)

    const slug = `issue-comment-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Issue Comment ${stamp}`, domain: slug, slug, userId },
    })
    projectId = project.id

    // Add the second user as a project member so they pass projectIdParam
    await prisma.projectMember.create({
      data: { projectId, userId: otherUserId, status: 'accepted', role: 'member' },
    })

    const issue = await prisma.issue.create({
      data: {
        projectId,
        issueKey: `ISS-CMT-${stamp}`,
        title: 'Comment target',
        description: 'desc',
        priority: 'medium',
        status: 'open',
        createdBy: userId,
      },
    })
    issueId = issue.id
  })

  afterAll(async () => {
    await prisma.issueComment.deleteMany({ where: { projectId } })
    await prisma.issue.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.delete({ where: { id: userId } })
    await prisma.user.delete({ where: { id: otherUserId } })
  })

  describe('POST /api/v1/issues/:projectId/:id/comments', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/comments`)
        .send({ content: 'no auth' })
      expect(res.status).toBe(401)
    })

    it('returns 404 when issue does not exist', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${fakeUuid}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'orphan' })
      expect(res.status).toBe(404)
    })

    it('creates a comment with 201', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'first comment' })
      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.id).toBeDefined()
      expect(res.body.data.content).toBe('first comment')
      expect(res.body.data.authorId).toBe(userId)
      expect(res.body.data.parentCommentId).toBeNull()
      createdCommentId = res.body.data.id
    })

    it('supports threaded replies via parentCommentId', async () => {
      const res = await request(app)
        .post(`/api/v1/issues/${projectId}/${issueId}/comments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'reply', parentCommentId: createdCommentId })
      expect(res.status).toBe(201)
      expect(res.body.data.parentCommentId).toBe(createdCommentId)
    })
  })

  describe('PATCH /api/v1/issues/:projectId/comments/:commentId', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/comments/${createdCommentId}`)
        .send({ content: 'edited' })
      expect(res.status).toBe(401)
    })

    it('returns 404 for unknown comment', async () => {
      const fakeUuid = '00000000-0000-0000-0000-000000000000'
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/comments/${fakeUuid}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'edited' })
      expect(res.status).toBe(404)
    })

    it('returns 403 when caller is not the author', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/comments/${createdCommentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ content: 'sneaky edit' })
      expect(res.status).toBe(403)
    })

    it('updates content for the author', async () => {
      const res = await request(app)
        .patch(`/api/v1/issues/${projectId}/comments/${createdCommentId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'edited content' })
      expect(res.status).toBe(200)
      expect(res.body.data.content).toBe('edited content')
    })
  })

  describe('DELETE /api/v1/issues/:projectId/comments/:commentId', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .delete(`/api/v1/issues/${projectId}/comments/${createdCommentId}`)
      expect(res.status).toBe(401)
    })

    it('returns 403 when caller is not the author', async () => {
      const res = await request(app)
        .delete(`/api/v1/issues/${projectId}/comments/${createdCommentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
      expect(res.status).toBe(403)
    })

    it('deletes the comment for the author', async () => {
      // create a fresh comment to delete (the previous one has a child reply)
      const created = await prisma.issueComment.create({
        data: {
          issueId,
          projectId,
          content: 'to delete',
          authorId: userId,
          authorName: 'Author',
        },
      })
      const res = await request(app)
        .delete(`/api/v1/issues/${projectId}/comments/${created.id}`)
        .set('Authorization', `Bearer ${token}`)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      const after = await prisma.issueComment.findUnique({ where: { id: created.id } })
      expect(after).toBeNull()
    })
  })
})
