import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import jwt from 'jsonwebtoken'

describe('Requirement Comment API', () => {
  let projectId: string
  let requirementDbId: string
  let authorId: string
  let authorToken: string
  let otherUserId: string
  let otherToken: string
  let adminId: string
  let adminToken: string

  beforeAll(async () => {
    const ts = Date.now()

    // Author user — will own comments
    const author = await prisma.user.create({
      data: {
        email: `req-comment-author-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Comment Author',
      },
    })
    authorId = author.id
    authorToken = jwt.sign({ userId: authorId }, process.env.JWT_SECRET || 'secret')

    // Other project member — should NOT be able to delete author's comments
    const other = await prisma.user.create({
      data: {
        email: `req-comment-other-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Other Member',
      },
    })
    otherUserId = other.id
    otherToken = jwt.sign({ userId: otherUserId }, process.env.JWT_SECRET || 'secret')

    // Admin user — COMPANY_ADMIN can delete any comment
    const admin = await prisma.user.create({
      data: {
        email: `req-comment-admin-${ts}@example.com`,
        password: 'hashedpassword',
        name: 'Admin User',
        role: 'COMPANY_ADMIN',
      },
    })
    adminId = admin.id
    adminToken = jwt.sign({ userId: adminId }, process.env.JWT_SECRET || 'secret')

    const slug = `req-comment-test-${ts}`
    const project = await prisma.project.create({
      data: { name: `Req Comment Test ${ts}`, domain: slug, slug, userId: authorId },
    })
    projectId = project.id

    // Add all three users as project members
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: authorId, role: 'member', status: 'accepted' },
        { projectId, userId: otherUserId, role: 'member', status: 'accepted' },
        { projectId, userId: adminId, role: 'admin', status: 'accepted' },
      ],
    })

    const req = await prisma.requirement.create({
      data: {
        projectId,
        title: 'Test Requirement',
        description: '',
        status: 'Draft',
        priority: 'Medium',
        stage: 'Analysis',
        requirementId: `REQ-COMMENT-TEST-${ts}`,
      },
    })
    requirementDbId = req.id
  })

  afterAll(async () => {
    await prisma.requirementComment.deleteMany({ where: { projectId } })
    await prisma.requirement.deleteMany({ where: { projectId } })
    await prisma.projectMember.deleteMany({ where: { projectId } })
    await prisma.project.delete({ where: { id: projectId } })
    await prisma.user.deleteMany({
      where: { id: { in: [authorId, otherUserId, adminId] } },
    })
    await prisma.$disconnect()
  })

  // ---------------------------------------------------------------------------
  // Auth guards
  // ---------------------------------------------------------------------------

  it('POST comment returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/comments`)
      .send({ content: '<p>hello</p>' })
    expect(res.status).toBe(401)
  })

  it('DELETE comment returns 401 without auth', async () => {
    const comment = await prisma.requirementComment.create({
      data: { projectId, requirementId: requirementDbId, content: '<p>x</p>', authorId },
    })
    const res = await request(app).delete(
      `/api/v1/requirements/${projectId}/comments/${comment.id}`
    )
    expect(res.status).toBe(401)
    await prisma.requirementComment.delete({ where: { id: comment.id } })
  })

  // ---------------------------------------------------------------------------
  // Create comment
  // ---------------------------------------------------------------------------

  it('POST comment returns 201 with created comment', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: '<p>A review note</p>' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
  })

  // ---------------------------------------------------------------------------
  // Delete comment — IDOR fix (#89)
  // ---------------------------------------------------------------------------

  it('DELETE comment by non-author returns 403', async () => {
    const comment = await prisma.requirementComment.create({
      data: {
        projectId,
        requirementId: requirementDbId,
        content: '<p>Author only</p>',
        authorId,
      },
    })

    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/comments/${comment.id}`)
      .set('Authorization', `Bearer ${otherToken}`)

    expect(res.status).toBe(403)
    expect(res.body.success).toBe(false)

    // Comment must still exist
    const still = await prisma.requirementComment.findUnique({ where: { id: comment.id } })
    expect(still).not.toBeNull()

    await prisma.requirementComment.delete({ where: { id: comment.id } })
  })

  it('DELETE comment by author returns 200', async () => {
    const comment = await prisma.requirementComment.create({
      data: {
        projectId,
        requirementId: requirementDbId,
        content: '<p>Delete me</p>',
        authorId,
      },
    })

    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/comments/${comment.id}`)
      .set('Authorization', `Bearer ${authorToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('DELETE comment by COMPANY_ADMIN returns 200', async () => {
    const comment = await prisma.requirementComment.create({
      data: {
        projectId,
        requirementId: requirementDbId,
        content: '<p>Admin can remove this</p>',
        authorId,
      },
    })

    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/comments/${comment.id}`)
      .set('Authorization', `Bearer ${adminToken}`)

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('DELETE non-existent comment returns 404', async () => {
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/comments/00000000-0000-0000-0000-000000000000`)
      .set('Authorization', `Bearer ${authorToken}`)
    expect(res.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // Create comment — validation + 404 (#96)
  // ---------------------------------------------------------------------------

  it('POST comment returns 400 for empty content', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: '   ' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/content/i)
  })

  it('POST comment returns 400 when content is missing entirely', async () => {
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${requirementDbId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({})
    expect(res.status).toBe(400)
  })

  it('POST comment returns 404 for a non-existent requirement', async () => {
    const ghostReqId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .post(`/api/v1/requirements/${projectId}/${ghostReqId}/comments`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ content: '<p>ghost</p>' })
    expect(res.status).toBe(404)
  })

  // ---------------------------------------------------------------------------
  // Cross-project DELETE isolation (#96)
  // ---------------------------------------------------------------------------

  it('DELETE comment with wrong projectId returns 404 (cross-project IDOR)', async () => {
    const ts = Date.now()
    const slug = `req-comment-b-${ts}`
    const projectB = await prisma.project.create({
      data: { name: `Req Comment B ${ts}`, domain: slug, slug, userId: authorId },
    })
    await prisma.projectMember.create({
      data: { projectId: projectB.id, userId: authorId, role: 'owner', status: 'accepted' },
    })
    const reqB = await prisma.requirement.create({
      data: {
        projectId: projectB.id,
        title: 'Req in Project B',
        description: '',
        status: 'Draft',
        priority: 'Medium',
        stage: 'Analysis',
        requirementId: `REQ-COMMENT-B-${ts}`,
      },
    })
    const commentB = await prisma.requirementComment.create({
      data: {
        projectId: projectB.id,
        requirementId: reqB.id,
        content: '<p>Comment in B</p>',
        authorId,
      },
    })

    // Attempt to delete projectB's comment via projectA's URL
    const res = await request(app)
      .delete(`/api/v1/requirements/${projectId}/comments/${commentB.id}`)
      .set('Authorization', `Bearer ${authorToken}`)
    expect(res.status).toBe(404)

    const stillThere = await prisma.requirementComment.findUnique({ where: { id: commentB.id } })
    expect(stillThere).not.toBeNull()

    await prisma.requirementComment.delete({ where: { id: commentB.id } }).catch(() => {})
    await prisma.requirement.delete({ where: { id: reqB.id } }).catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId: projectB.id } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectB.id } }).catch(() => {})
  })
})
