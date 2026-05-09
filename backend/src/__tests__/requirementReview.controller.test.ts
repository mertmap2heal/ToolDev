/**
 * Tests for /api/v1/projects/:projectId/...requirement-review routes
 * (mounted by `requirementReviews.routes.ts`). The router runs
 * `authenticateToken` + `requireProjectMember`. Coverage:
 *   - 401 without a token
 *   - 403 when an outsider hits a project that isn't theirs
 *   - happy path: create review on a real requirement, getOne, list,
 *     start, update reviewer, my-reviews, cancel
 *   - validation: missing reviewers (400), invalid reviewer status (400)
 *
 * The controller delegates almost everything to
 * requirementReviewService, so we exercise enough surface to cover both
 * the happy path and at least one failure response per route.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'

describe('Requirement reviews — /api/v1/projects/:projectId/...', () => {
  const stamp = Date.now()
  let ownerId: string
  let outsiderId: string
  let tokenOwner: string
  let tokenOutsider: string
  let projectId: string
  let requirementId: string
  let reviewId: string | null = null
  let reviewerRowId: string | null = null

  beforeAll(async () => {
    const secret = process.env.JWT_SECRET || 'secret'
    const owner = await prisma.user.create({
      data: { email: `rrev-o-${stamp}@example.test`, password: 'x', name: 'RrevOwner' },
    })
    ownerId = owner.id
    tokenOwner = jwt.sign({ userId: owner.id }, secret)

    const outsider = await prisma.user.create({
      data: { email: `rrev-x-${stamp}@example.test`, password: 'x', name: 'RrevOutsider' },
    })
    outsiderId = outsider.id
    tokenOutsider = jwt.sign({ userId: outsider.id }, secret)

    const slug = `rrev-${stamp}`
    const project = await prisma.project.create({
      data: { name: `Rrev ${stamp}`, domain: slug, slug, userId: ownerId },
    })
    projectId = project.id

    const requirement = await prisma.requirement.create({
      data: {
        projectId,
        title: `Review target ${stamp}`,
        description: 'For review',
        priority: 'medium',
        status: 'draft',
        stage: 'definition',
      },
    })
    requirementId = requirement.id
  })

  afterAll(async () => {
    await prisma.requirementReviewer
      .deleteMany({ where: { projectId } })
      .catch(() => {})
    await prisma.requirementReview
      .deleteMany({ where: { projectId } })
      .catch(() => {})
    await prisma.requirement
      .deleteMany({ where: { projectId } })
      .catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [ownerId, outsiderId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  it('GET /:projectId/reviews without a token returns 401', async () => {
    const res = await request(app).get(`/api/v1/projects/${projectId}/reviews`)
    expect(res.status).toBe(401)
  })

  it('POST /:projectId/requirements/:reqId/reviews by an outsider returns 403', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/requirements/${requirementId}/reviews`)
      .set('Authorization', `Bearer ${tokenOutsider}`)
      .send({ reviewers: [{ reviewerName: 'Jane' }] })
    expect(res.status).toBe(403)
  })

  it('POST /:projectId/requirements/:reqId/reviews rejects empty reviewers with 400', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/requirements/${requirementId}/reviews`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ reviewers: [] })
    expect(res.status).toBe(400)
  })

  it('POST /:projectId/requirements/:reqId/reviews creates a draft review', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/requirements/${requirementId}/reviews`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({
        reviewType: 'initial',
        reviewers: [
          { reviewerName: 'Jane Reviewer', reviewerEmail: 'jane@example.test', role: 'reviewer' },
        ],
        reviewNotes: 'Please review.',
      })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.id).toBeDefined()
    expect(res.body.data.reviewStatus).toBe('draft')
    expect(Array.isArray(res.body.data.reviewers)).toBe(true)
    expect(res.body.data.reviewers.length).toBe(1)
    reviewId = res.body.data.id
    reviewerRowId = res.body.data.reviewers[0].id
  })

  it('GET /:projectId/reviews/:reviewId returns the created review', async () => {
    expect(reviewId).toBeDefined()
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe(reviewId)
  })

  it('GET /:projectId/requirements/:reqId/reviews lists reviews for the requirement', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/requirements/${requirementId}/reviews`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /:projectId/reviews lists project reviews', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/reviews`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /:projectId/reviews/my-reviews returns the caller assignments', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${projectId}/reviews/my-reviews`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('POST /:projectId/reviews/:reviewId/start moves to in_review', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/reviews/${reviewId}/start`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const row = await prisma.requirementReview.findUnique({ where: { id: reviewId! } })
    expect(row?.reviewStatus).toBe('in_review')
  })

  it('PUT /:projectId/reviews/:reviewId/reviewers/:reviewerId rejects missing status with 400', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerRowId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ reviewComments: 'no status' })
    expect(res.status).toBe(400)
  })

  it('PUT /:projectId/reviews/:reviewId/reviewers/:reviewerId rejects invalid status with 400', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerRowId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ status: 'totally-invalid' })
    expect(res.status).toBe(400)
  })

  it('PUT /:projectId/reviews/:reviewId/reviewers/:reviewerId updates with valid status', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerRowId}`)
      .set('Authorization', `Bearer ${tokenOwner}`)
      .send({ status: 'approved', reviewComments: 'LGTM' })
    expect(res.status).toBe(200)
    const row = await prisma.requirementReviewer.findUnique({ where: { id: reviewerRowId! } })
    expect(row?.status).toBe('approved')
  })

  it('POST /:projectId/reviews/:reviewId/cancel cancels the review', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${projectId}/reviews/${reviewId}/cancel`)
      .set('Authorization', `Bearer ${tokenOwner}`)
    expect(res.status).toBe(200)
  })
})
