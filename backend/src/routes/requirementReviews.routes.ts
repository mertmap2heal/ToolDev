import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
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

// Review management routes
router.post('/:projectId/requirements/:requirementId/reviews', createReview)
router.get('/:projectId/requirements/:requirementId/reviews', getRequirementReviews)
router.get('/:projectId/reviews', getProjectReviews)
router.get('/:projectId/reviews/my-reviews', getMyReviews)
router.get('/:projectId/reviews/:reviewId', getReview)
router.post('/:projectId/reviews/:reviewId/start', startReview)
router.post('/:projectId/reviews/:reviewId/cancel', cancelReview)
router.put('/:projectId/reviews/:reviewId/reviewers/:reviewerId', updateReviewer)

export default router
