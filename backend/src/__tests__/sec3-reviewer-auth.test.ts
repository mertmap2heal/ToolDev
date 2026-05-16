/**
 * SEC-3 (#376) - reviewer-response self-auth regression tests.
 *
 * Pre-fix: PUT /:projectId/reviews/:reviewId/reviewers/:reviewerId accepted
 * the status body without verifying req.user.id === reviewer.reviewerId.
 * Any project member could submit any other reviewer's response, with the
 * actor mis-attributed in the audit log. CFR 21 Part 11 failure plus a
 * straight authorization bug.
 *
 * Post-fix:
 *   - Internal reviewers: caller's userId must match reviewer.reviewerId,
 *     otherwise 403 + audit row `requirements:reviewer-auth-mismatch-denied`.
 *   - External reviewers (reviewerEmail only, no reviewerId): require a
 *     signed JWT in `X-Reviewer-Token`. Missing => 401 + audit.
 *     Tampered / expired / wrong-purpose / wrong-reviewer-id => 403 + audit.
 *   - Audit row is anchored on the requirement's projectId.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { app } from '../server'
import { prisma } from '../lib/prisma'
import { mintReviewerToken } from '../lib/reviewerToken'

describe('SEC-3 (#376) - Reviewer-response self-auth', () => {
  const stamp = Date.now()
  const secret = process.env.JWT_SECRET || 'secret'

  let userAId: string
  let userBId: string
  let tokenA: string
  let tokenB: string
  let projectId: string
  let requirementId: string
  let reviewId: string
  let reviewerAId: string // internal reviewer, userA
  let reviewerExternalId: string // external reviewer (email-only)
  const externalEmail = `sec3-external-${stamp}@example.test`
  let externalToken: string
  // Helper: an external token bound to a DIFFERENT reviewer row, used to
  // assert that an attacker who legitimately holds one token cannot use it
  // against another reviewer entry.
  let mismatchedReviewerId: string
  let mismatchedExternalToken: string

  beforeAll(async () => {
    const userA = await prisma.user.create({
      data: { email: `sec3-a-${stamp}@example.test`, password: 'x', name: 'A' },
    })
    userAId = userA.id
    tokenA = jwt.sign({ userId: userA.id }, secret)

    const userB = await prisma.user.create({
      data: { email: `sec3-b-${stamp}@example.test`, password: 'x', name: 'B' },
    })
    userBId = userB.id
    tokenB = jwt.sign({ userId: userB.id }, secret)

    const slug = `sec3-${stamp}`
    const project = await prisma.project.create({
      data: { name: `SEC3 ${stamp}`, domain: slug, slug, userId: userAId },
    })
    projectId = project.id

    // Both users are members of the same project, so requireProjectMember
    // does not block either. The SEC-3 vulnerability was *inside* a
    // single project's membership.
    await prisma.projectMember.createMany({
      data: [
        { projectId, userId: userAId, role: 'owner', status: 'accepted' },
        { projectId, userId: userBId, role: 'editor', status: 'accepted' },
      ],
    })

    const requirement = await prisma.requirement.create({
      data: {
        projectId,
        title: `sec3-req-${stamp}`,
        description: 'sec3 test requirement',
        priority: 'medium',
        status: 'draft',
        stage: 'concept',
      },
    })
    requirementId = requirement.id

    // Create one review with two reviewers - one internal (userA), one
    // external (email-only).
    const review = await prisma.requirementReview.create({
      data: {
        requirementId,
        projectId,
        reviewType: 'initial',
        reviewStatus: 'in_review',
        initiatedBy: userAId,
        reviewers: {
          create: [
            {
              requirementId,
              projectId,
              reviewerId: userAId,
              reviewerName: 'A',
              role: 'reviewer',
              status: 'pending',
            },
            {
              requirementId,
              projectId,
              reviewerName: 'External',
              reviewerEmail: externalEmail,
              role: 'reviewer',
              status: 'pending',
            },
          ],
        },
      },
      include: { reviewers: true },
    })
    reviewId = review.id
    const reviewerInternal = review.reviewers.find((r) => r.reviewerId === userAId)!
    reviewerAId = reviewerInternal.id
    const reviewerExternal = review.reviewers.find((r) => r.reviewerEmail === externalEmail)!
    reviewerExternalId = reviewerExternal.id

    externalToken = mintReviewerToken({
      reviewId,
      reviewerEmail: externalEmail,
      requirementReviewerId: reviewerExternalId,
    })

    // Create a SECOND external reviewer row on the same review so we can
    // forge a token bound to it and prove tokens are not reusable across
    // reviewer rows.
    const otherExternal = await prisma.requirementReviewer.create({
      data: {
        reviewId,
        requirementId,
        projectId,
        reviewerName: 'External-2',
        reviewerEmail: `sec3-external2-${stamp}@example.test`,
        role: 'reviewer',
        status: 'pending',
      },
    })
    mismatchedReviewerId = otherExternal.id
    mismatchedExternalToken = mintReviewerToken({
      reviewId,
      reviewerEmail: otherExternal.reviewerEmail!,
      requirementReviewerId: otherExternal.id,
    })
  })

  afterAll(async () => {
    // Reverse-dependency cleanup. Include AuditLog so deny-audit rows
    // written during the spec do not block the project delete.
    await prisma.auditLog.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.requirementReviewer
      .deleteMany({ where: { reviewId } })
      .catch(() => {})
    await prisma.requirementReview
      .deleteMany({ where: { id: reviewId } })
      .catch(() => {})
    await prisma.requirement
      .deleteMany({ where: { id: requirementId } })
      .catch(() => {})
    await prisma.projectMember.deleteMany({ where: { projectId } }).catch(() => {})
    await prisma.project.delete({ where: { id: projectId } }).catch(() => {})
    await prisma.user
      .deleteMany({ where: { id: { in: [userAId, userBId] } } })
      .catch(() => {})
    await prisma.$disconnect()
  })

  // ---------- Sanity ----------

  it('PUT without auth returns 401', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerAId}`)
      .send({ status: 'approved' })
    expect(res.status).toBe(401)
  })

  // ---------- Internal reviewer ----------

  it('User A updating their OWN reviewer row succeeds', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'in_progress', reviewComments: 'noted' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const after = await prisma.requirementReviewer.findUnique({
      where: { id: reviewerAId },
    })
    expect(after!.status).toBe('in_progress')
    expect(after!.reviewComments).toBe('noted')
  })

  it('User B cannot update User A reviewer row and gets 403 (SEC-3 #376)', async () => {
    // Clear any prior deny rows so the assertion below is unambiguous.
    await prisma.auditLog
      .deleteMany({
        where: {
          projectId,
          userId: userBId,
          action: 'requirements:reviewer-auth-mismatch-denied',
        },
      })
      .catch(() => {})
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerAId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ status: 'approved', reviewComments: 'forged by B' })
    expect(res.status).toBe(403)
    // Reviewer A row must NOT have changed.
    const after = await prisma.requirementReviewer.findUnique({
      where: { id: reviewerAId },
    })
    expect(after!.reviewComments).not.toBe('forged by B')
    expect(after!.status).not.toBe('approved')
  })

  it('User B foreign-reviewer probe writes a deny-audit row anchored on the project', async () => {
    // The previous test produced one row. Re-probe and confirm the row's
    // shape (resource label, reason).
    const audit = await prisma.auditLog.findFirst({
      where: {
        projectId,
        userId: userBId,
        action: 'requirements:reviewer-auth-mismatch-denied',
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).not.toBeNull()
    const details = (audit!.detailsJson ?? {}) as Record<string, unknown>
    expect(details.resource).toBe('requirement-reviewer-internal')
    expect(details.resourceId).toBe(reviewerAId)
    expect(details.reason).toBe('user-id-mismatch')
  })

  // ---------- External reviewer ----------

  it('External-reviewer PUT without X-Reviewer-Token returns 401', async () => {
    // Use User A's session JWT so authenticateToken + requireProjectMember
    // both pass; the gate is the self-auth check on the row.
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerExternalId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'approved' })
    expect(res.status).toBe(401)
  })

  it('External-reviewer PUT with a valid token succeeds', async () => {
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerExternalId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Reviewer-Token', externalToken)
      .send({ status: 'in_progress', reviewComments: 'external noted' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    const after = await prisma.requirementReviewer.findUnique({
      where: { id: reviewerExternalId },
    })
    expect(after!.status).toBe('in_progress')
    expect(after!.reviewComments).toBe('external noted')
  })

  it('External-reviewer PUT with token bound to a DIFFERENT reviewer row returns 403', async () => {
    // Present `mismatchedExternalToken` (bound to a different reviewer
    // row) against `reviewerExternalId` - the verifier should reject.
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerExternalId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Reviewer-Token', mismatchedExternalToken)
      .send({ status: 'approved' })
    expect(res.status).toBe(403)
  })

  it('External-reviewer PUT with an expired token returns 403', async () => {
    // Mint a token in the past so it is already expired by the time the
    // verifier runs. `jsonwebtoken` accepts `expiresIn: '-1s'` which sets
    // exp to one second before iat.
    const expired = jwt.sign(
      {
        reviewId,
        reviewerEmail: externalEmail,
        requirementReviewerId: reviewerExternalId,
        purpose: 'reviewer-response',
      },
      secret,
      { expiresIn: '-1s' }
    )
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerExternalId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Reviewer-Token', expired)
      .send({ status: 'approved' })
    expect(res.status).toBe(403)
  })

  it('External-reviewer PUT with a wrong-purpose token returns 403', async () => {
    // A token signed with the same secret but a different `purpose` must
    // not be accepted - prevents replay of (e.g.) session tokens against
    // the reviewer-response endpoint.
    const wrongPurpose = jwt.sign(
      {
        reviewId,
        reviewerEmail: externalEmail,
        requirementReviewerId: reviewerExternalId,
        purpose: 'something-else',
      },
      secret,
      { expiresIn: '30d' }
    )
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerExternalId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Reviewer-Token', wrongPurpose)
      .send({ status: 'approved' })
    expect(res.status).toBe(403)
  })

  it('External-reviewer PUT with a token signed by a non-HS256 algorithm returns 403 (round-2 polish)', async () => {
    // Defence-in-depth: even when an attacker controls the `alg` header
    // and signs with a different symmetric algorithm (here HS512), the
    // verifier must reject because the algorithm is not on the whitelist.
    // Prevents algorithm-confusion attacks where the verifier blindly
    // accepts the algorithm advertised in the JWT header. The mint path
    // emits HS256 (jsonwebtoken default); the verify path now pins to
    // ['HS256'] via `jwt.verify(..., { algorithms: ['HS256'] })`.
    const wrongAlg = jwt.sign(
      {
        reviewId,
        reviewerEmail: externalEmail,
        requirementReviewerId: reviewerExternalId,
        purpose: 'reviewer-response',
      },
      secret,
      { algorithm: 'HS512', expiresIn: '30d' }
    )
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerExternalId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('X-Reviewer-Token', wrongAlg)
      .send({ status: 'approved' })
    expect(res.status).toBe(403)
  })

  // ---------- Defence in depth ----------

  it('Reviewer id from a different review path returns 404', async () => {
    // Use a known-non-existent reviewId in the URL but the real reviewerId
    // in the path. The resolver should return null because
    // reviewer.reviewId !== url reviewId.
    const fakeReviewId = '00000000-0000-0000-0000-000000000000'
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${fakeReviewId}/reviewers/${reviewerAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'approved' })
    expect(res.status).toBe(404)
  })

  it('Reviewer id from a different project returns 404 (resolver tenant-binds row)', async () => {
    // Create a second project; the URL projectId differs from the row's
    // projectId so the resolver returns null. The outer `requireProjectMember`
    // gate would also catch this if userA was not a member of the second
    // project, but here userA IS a member and the inner check still rejects.
    const otherProject = await prisma.project.create({
      data: {
        name: `SEC3-other-${stamp}`,
        domain: `sec3-other-${stamp}`,
        slug: `sec3-other-${stamp}`,
        userId: userAId,
      },
    })
    await prisma.projectMember.create({
      data: {
        projectId: otherProject.id,
        userId: userAId,
        role: 'owner',
        status: 'accepted',
      },
    })
    const res = await request(app)
      .put(`/api/v1/projects/${otherProject.id}/reviews/${reviewId}/reviewers/${reviewerAId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ status: 'approved' })
    expect(res.status).toBe(404)
    await prisma.projectMember.deleteMany({ where: { projectId: otherProject.id } })
    await prisma.project.delete({ where: { id: otherProject.id } })
  })

  it('Foreign-tenant probe (different project, non-member) returns 403 from requireProjectMember', async () => {
    // Defence-in-depth: a user who is not a member of the URL project
    // never reaches the self-auth middleware. This row asserts the outer
    // gate still works as before.
    const foreignUser = await prisma.user.create({
      data: {
        email: `sec3-foreign-${stamp}@example.test`,
        password: 'x',
        name: 'F',
      },
    })
    const foreignToken = jwt.sign({ userId: foreignUser.id }, secret)
    const res = await request(app)
      .put(`/api/v1/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerAId}`)
      .set('Authorization', `Bearer ${foreignToken}`)
      .send({ status: 'approved' })
    expect(res.status).toBe(403)
    await prisma.user.delete({ where: { id: foreignUser.id } }).catch(() => {})
  })
})
