import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { requirementReviewService } from '../services/requirementReview.service'

/**
 * Create a new review for a requirement
 * POST /api/projects/:projectId/requirements/:requirementId/reviews
 */
export const createReview = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const { reviewType, reviewers, reviewNotes } = req.body
    const userId = req.user?.id
    const userName = req.user?.name

    if (!reviewers || !Array.isArray(reviewers) || reviewers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one reviewer is required',
      })
    }

    const result = await requirementReviewService.createReview({
      requirementId,
      projectId,
      reviewType,
      reviewers,
      reviewNotes,
      initiatedBy: userId,
      initiatedByName: userName,
    })

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.status(201).json(result)
  } catch (error: any) {
    console.error('Error creating review:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create review',
    })
  }
}

/**
 * Start a review (change status from draft to in_review)
 * POST /api/projects/:projectId/reviews/:reviewId/start
 */
export const startReview = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params
    const actorUserId = req.userId

    const result = await requirementReviewService.startReview(reviewId, actorUserId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error starting review:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start review',
    })
  }
}

/**
 * Update reviewer response
 * PUT /api/projects/:projectId/reviews/:reviewId/reviewers/:reviewerId
 */
export const updateReviewer = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewerId } = req.params
    const { status, reviewComments } = req.body
    const actorUserId = req.userId

    if (!status) {
      return res.status(400).json({
        success: false,
        error: 'Status is required',
      })
    }

    const validStatuses = ['pending', 'in_progress', 'approved', 'rejected', 'deferred']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      })
    }

    const result = await requirementReviewService.updateReviewer(
      reviewerId,
      { status, reviewComments },
      actorUserId
    )

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error updating reviewer:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update reviewer',
    })
  }
}

/**
 * Get review by ID
 * GET /api/projects/:projectId/reviews/:reviewId
 */
export const getReview = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params

    const result = await requirementReviewService.getReview(reviewId)

    if (!result.success) {
      return res.status(404).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error getting review:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get review',
    })
  }
}

/**
 * Get reviews for a requirement
 * GET /api/projects/:projectId/requirements/:requirementId/reviews
 */
export const getRequirementReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { requirementId } = req.params

    const result = await requirementReviewService.getRequirementReviews(requirementId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error getting requirement reviews:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get reviews',
    })
  }
}

/**
 * Get reviews for a project
 * GET /api/projects/:projectId/reviews
 */
export const getProjectReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { status } = req.query

    const result = await requirementReviewService.getProjectReviews(
      projectId,
      status as any
    )

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error getting project reviews:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get reviews',
    })
  }
}

/**
 * Cancel a review
 * POST /api/projects/:projectId/reviews/:reviewId/cancel
 */
export const cancelReview = async (req: AuthRequest, res: Response) => {
  try {
    const { reviewId } = req.params
    const actorUserId = req.userId

    const result = await requirementReviewService.cancelReview(reviewId, actorUserId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error cancelling review:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel review',
    })
  }
}

/**
 * Get reviews assigned to current user
 * GET /api/projects/:projectId/reviews/my-reviews
 */
export const getMyReviews = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.user?.id

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated',
      })
    }

    const result = await requirementReviewService.getUserReviews(userId, projectId)

    if (!result.success) {
      return res.status(400).json(result)
    }

    res.json(result)
  } catch (error: any) {
    console.error('Error getting user reviews:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get user reviews',
    })
  }
}
