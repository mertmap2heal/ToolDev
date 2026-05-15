import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { verifyActingForSelf } from '../middleware/verifyActingForSelf.middleware'
import { prisma } from '../lib/prisma'
import {
  createReview,
  startReview,
  updateReviewer,
  getReview,
  getRequirementReviews,
  getProjectReviews,
  cancelReview,
  getMyReviews,
} from '../controllers/requirementReview.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

// Review management routes
router.post('/:projectId/requirements/:requirementId/reviews', createReview)
router.get('/:projectId/requirements/:requirementId/reviews', getRequirementReviews)
router.get('/:projectId/reviews', getProjectReviews)
router.get('/:projectId/reviews/my-reviews', getMyReviews)
router.get('/:projectId/reviews/:reviewId', getReview)
router.post('/:projectId/reviews/:reviewId/start', startReview)
router.post('/:projectId/reviews/:reviewId/cancel', cancelReview)

// SEC-3 (#376) - reviewer-response submission requires per-row self-auth.
// `requireProjectMember` is not enough: any project member could otherwise
// submit any other reviewer's response. The `verifyActingForSelf` middleware
// loads the `RequirementReviewer` row, walks to the requirement's projectId
// (defence in depth - already checked at the URL but used here for the audit
// anchor and review-id consistency), and either:
//   (a) confirms the authenticated user IS the reviewer (internal path), or
//   (b) when the reviewer has only an email, verifies a signed token
//       presented in `X-Reviewer-Token` (external path).
// On mismatch a `requirements:reviewer-auth-mismatch-denied` audit row is
// written before the 403/401 response.
router.put(
  '/:projectId/reviews/:reviewId/reviewers/:reviewerId',
  verifyActingForSelf(async (req) => {
    const { reviewId, reviewerId, projectId } = req.params
    const reviewer = await prisma.requirementReviewer.findUnique({
      where: { id: reviewerId },
      select: {
        id: true,
        reviewId: true,
        reviewerId: true,
        reviewerEmail: true,
        requirementId: true,
        projectId: true,
      },
    })
    if (!reviewer) return null
    // Defence-in-depth: reject when the row does not belong to the review
    // identified in the URL. Prevents an actor with one valid review id
    // from impersonating a reviewer attached to a different review.
    if (reviewer.reviewId !== reviewId) {
      return null
    }
    // Walk to the requirement's projectId for the audit anchor. Use the
    // RequirementReviewer's own projectId column when available (it is
    // populated at creation time); fall back to the parent requirement.
    let rowProjectId: string | null = reviewer.projectId ?? null
    if (!rowProjectId && reviewer.requirementId) {
      const requirement = await prisma.requirement.findUnique({
        where: { id: reviewer.requirementId },
        select: { projectId: true },
      })
      rowProjectId = requirement?.projectId ?? null
    }
    // Final tenant check: the row's projectId must match the URL projectId.
    // `requireProjectMember` already validated the caller has access to URL
    // projectId; this binds the row to that same scope.
    if (rowProjectId && rowProjectId !== projectId) {
      return null
    }

    // External-reviewer path (no internal user id, email-only).
    if (!reviewer.reviewerId && reviewer.reviewerEmail) {
      return {
        expectedUserId: null,
        externalToken: {
          expectedReviewId: reviewer.reviewId,
          expectedReviewerEmail: reviewer.reviewerEmail,
          expectedRequirementReviewerId: reviewer.id,
        },
        resourceProjectId: rowProjectId,
        resourceLabel: 'requirement-reviewer-external',
      }
    }

    // Internal-reviewer path.
    return {
      expectedUserId: reviewer.reviewerId,
      resourceProjectId: rowProjectId,
      resourceLabel: 'requirement-reviewer-internal',
    }
  }),
  updateReviewer
)

export default router
