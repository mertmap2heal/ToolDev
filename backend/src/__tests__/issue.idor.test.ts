/**
 * Regression tests for #285 — IDOR on issue / comment / link controllers.
 *
 * Before the fix, issue.controller.ts looked issues, comments, and links up
 * by id alone. The URL's projectId was validated by projectIdParam for
 * caller access to that project but was never matched against the actual
 * row, so a user with access to project A could read, update, delete, or
 * subscribe to any issue/comment/link in project B given its UUID.
 *
 * Two users with two separate projects; every cross-project path must
 * return 404 and leave the foreign row untouched.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Issue controllers — cross-project IDOR (#285)', () => {
  const stamp = Date.now()

  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  let projectAId: string
  let projectBId: string
  let issueAId: string
  let issueBId: string
  let commentBId: string
  let linkBId: string

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const userA = await prisma.user.create({
      data: { email: `issue-idor-a-${stamp}@example.test`, password: 'hashed', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `issue-idor-b-${stamp}@example.test`, password: 'hashed', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const slugA = `issue-idor-a-${stamp}`
    const slugB = `issue-idor-b-${stamp}`
    const pA = await prisma.project.create({
      data: { name: `Issue IDOR A ${stamp}`, domain: slugA, slug: slugA, userId: userAId },
    })
    projectAId = pA.id
    const pB = await prisma.project.create({
      data: { name: `Issue IDOR B ${stamp}`, domain: slugB, slug: slugB, userId: userBId },
    })
    projectBId = pB.id

    // User A is ALSO a member of project A (via legacy userId owner). User B
    // same for their project. Neither can access the other's project via
    // projectIdParam — that middleware is tested in #144.
    const issueA = await prisma.issue.create({
      data: {
        projectId: projectAId,
        issueKey: `ISS-A-${stamp}`,
        title: 'Issue in A',
        description: 'Project A issue',
        priority: 'medium',
        status: 'open',
        createdBy: userAId,
      },
    })
    issueAId = issueA.id

    const issueB = await prisma.issue.create({
      data: {
        projectId: projectBId,
        issueKey: `ISS-B-${stamp}`,
        title: 'Issue in B',
        description: 'Project B issue',
        priority: 'medium',
        status: 'open',
        createdBy: userBId,
      },
    })
    issueBId = issueB.id

    // Seed a comment authored by user A but in project B (simulating the
    // "former member still has authored comments" attack vector from #285).
    const cmt = await prisma.issueComment.create({
      data: {
        issueId: issueBId,
        projectId: projectBId,
        content: 'secret comment',
        authorId: userAId,
        authorName: 'A',
      },
    })
    commentBId = cmt.id

    // Seed a link on issue B.
    const lnk = await prisma.issueLink.create({
      data: {
        issueId: issueBId,
        linkedType: 'requirement',
        linkedId: 'abc123',
        linkType: 'relates_to',
      },
    })
    linkBId = lnk.id
  })

  afterAll(async () => {
    await prisma.issueLink.deleteMany({ where: { issueId: { in: [issueAId, issueBId] } } }).catch(() => {})
    await prisma.issueComment.deleteMany({ where: { issueId: { in: [issueAId, issueBId] } } }).catch(() => {})
    await prisma.issueSubscription.deleteMany({ where: { issueId: { in: [issueAId, issueBId] } } }).catch(() => {})
    await prisma.issue.deleteMany({ where: { id: { in: [issueAId, issueBId] } } }).catch(() => {})
    await prisma.project.deleteMany({ where: { id: { in: [projectAId, projectBId] } } }).catch(() => {})
    await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } }).catch(() => {})
    await prisma.$disconnect()
  })

  it('owner can GET their own issue (sanity)', async () => {
    const res = await request(app)
      .get(`/api/v1/issues/${projectAId}/${issueAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(issueAId)
  })

  it('GET foreign issue via own projectId returns 404 (#285)', async () => {
    const res = await request(app)
      .get(`/api/v1/issues/${projectAId}/${issueBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })

  it('PATCH foreign issue via own projectId returns 404 and does not mutate (#285)', async () => {
    const before = await prisma.issue.findUnique({ where: { id: issueBId } })
    const res = await request(app)
      .patch(`/api/v1/issues/${projectAId}/${issueBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'pwned' })
    expect(res.status).toBe(404)
    const after = await prisma.issue.findUnique({ where: { id: issueBId } })
    expect(after!.title).toBe(before!.title)
  })

  it('DELETE foreign issue via own projectId returns 404 and preserves the row (#285)', async () => {
    const res = await request(app)
      .delete(`/api/v1/issues/${projectAId}/${issueBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.issue.findUnique({ where: { id: issueBId } })
    expect(stillThere).not.toBeNull()
  })

  it('GET foreign issue activity via own projectId returns 404 (#285)', async () => {
    const res = await request(app)
      .get(`/api/v1/issues/${projectAId}/${issueBId}/activity`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
  })

  it('POST comment on foreign issue returns 404 (#285)', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${projectAId}/${issueBId}/comments`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'leaked' })
    expect(res.status).toBe(404)
    const count = await prisma.issueComment.count({ where: { issueId: issueBId, content: 'leaked' } })
    expect(count).toBe(0)
  })

  it('PATCH foreign comment via own projectId returns 404 even though caller is the author (#285)', async () => {
    // The caller authored commentB under project B. Using project A's prefix
    // must still return 404; the author-only gate alone is not enough.
    const res = await request(app)
      .patch(`/api/v1/issues/${projectAId}/comments/${commentBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ content: 'rewritten' })
    expect(res.status).toBe(404)
    const after = await prisma.issueComment.findUnique({ where: { id: commentBId } })
    expect(after!.content).toBe('secret comment')
  })

  it('DELETE foreign comment via own projectId returns 404 (#285)', async () => {
    const res = await request(app)
      .delete(`/api/v1/issues/${projectAId}/comments/${commentBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.issueComment.findUnique({ where: { id: commentBId } })
    expect(stillThere).not.toBeNull()
  })

  it('POST subscribe on foreign issue returns 404 (#285)', async () => {
    const res = await request(app)
      .post(`/api/v1/issues/${projectAId}/${issueBId}/subscribe`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const subs = await prisma.issueSubscription.count({ where: { issueId: issueBId, userId: userAId } })
    expect(subs).toBe(0)
  })

  it('DELETE foreign link via own projectId returns 404 and preserves the row (#285)', async () => {
    const res = await request(app)
      .delete(`/api/v1/issues/${projectAId}/links/${linkBId}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(res.status).toBe(404)
    const stillThere = await prisma.issueLink.findUnique({ where: { id: linkBId } })
    expect(stillThere).not.toBeNull()
  })
})
