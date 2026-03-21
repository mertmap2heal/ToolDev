import { prisma } from '../lib/prisma'
import { notifyRequirementSubscribers } from './requirementNotification.service'


export type ReviewStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'cancelled'
export type ReviewerStatus = 'pending' | 'in_progress' | 'approved' | 'rejected' | 'deferred'
export type ReviewType = 'initial' | 'change' | 'periodic' | 'final'

export interface CreateReviewRequest {
  requirementId: string
  projectId: string
  reviewType?: ReviewType
  reviewers: Array<{
    reviewerId?: string
    reviewerName?: string
    reviewerEmail?: string
    role?: 'reviewer' | 'approver' | 'observer'
  }>
  reviewNotes?: string
  initiatedBy?: string
  initiatedByName?: string
}

export interface UpdateReviewerRequest {
  status: ReviewerStatus
  reviewComments?: string
}

export const requirementReviewService = {
  /**
   * Create a new review for a requirement
   */
  async createReview(request: CreateReviewRequest) {
    try {
      // Check if requirement exists
      const requirement = await prisma.requirement.findUnique({
        where: { id: request.requirementId },
      })

      if (!requirement) {
        return { success: false, error: 'Requirement not found' }
      }

      // Check if there's an active review
      const activeReview = await prisma.requirementReview.findFirst({
        where: {
          requirementId: request.requirementId,
          reviewStatus: { in: ['draft', 'in_review'] },
        },
      })

      if (activeReview) {
        return { success: false, error: 'An active review already exists for this requirement' }
      }

      // Create review
      const review = await prisma.requirementReview.create({
        data: {
          requirementId: request.requirementId,
          projectId: request.projectId,
          reviewType: request.reviewType || 'initial',
          reviewStatus: 'draft',
          initiatedBy: request.initiatedBy,
          initiatedByName: request.initiatedByName,
          reviewNotes: request.reviewNotes,
          reviewers: {
            create: request.reviewers.map((r) => ({
              requirementId: request.requirementId,
              projectId: request.projectId,
              reviewerId: r.reviewerId,
              reviewerName: r.reviewerName,
              reviewerEmail: r.reviewerEmail,
              role: r.role || 'reviewer',
              status: 'pending',
            })),
          },
        },
        include: {
          reviewers: true,
        },
      })

      return { success: true, data: review }
    } catch (error: any) {
      console.error('Error creating review:', error)
      return { success: false, error: error.message || 'Failed to create review' }
    }
  },

  /**
   * Start a review (change status from draft to in_review)
   */
  async startReview(reviewId: string, actorUserId?: string) {
    try {
      const review = await prisma.requirementReview.update({
        where: { id: reviewId },
        data: {
          reviewStatus: 'in_review',
          startedAt: new Date(),
        },
        include: {
          reviewers: true,
          requirement: true,
        },
      })

      // Update requirement review status
      const previousStatus = review.requirement.reviewStatus
      const nextStatus = 'under_review'
      await prisma.requirement.update({
        where: { id: review.requirementId },
        data: { reviewStatus: nextStatus },
      })

      await notifyRequirementSubscribers({
        projectId: review.requirement.projectId,
        requirementId: review.requirementId,
        actorUserId,
        changes: [`Review status: ${previousStatus || '—'} -> ${nextStatus}`],
        requirementSnapshot: {
          id: review.requirementId,
          requirementId: review.requirement.requirementId,
          title: review.requirement.title,
        },
      })

      return { success: true, data: review }
    } catch (error: any) {
      console.error('Error starting review:', error)
      return { success: false, error: error.message || 'Failed to start review' }
    }
  },

  /**
   * Update reviewer response
   */
  async updateReviewer(reviewerId: string, request: UpdateReviewerRequest, actorUserId?: string) {
    try {
      const reviewer = await prisma.requirementReviewer.update({
        where: { id: reviewerId },
        data: {
          status: request.status,
          reviewComments: request.reviewComments,
          reviewedAt: request.status !== 'pending' ? new Date() : undefined,
        },
        include: {
          review: {
            include: {
              reviewers: true,
            },
          },
        },
      })

      // Check if all reviewers have responded
      const review = reviewer.review
      const allResponded = review.reviewers.every(
        (r) => r.status !== 'pending' && r.status !== 'in_progress'
      )

      // Check if all approvers approved
      const approvers = review.reviewers.filter((r) => r.role === 'approver')
      const allApproversApproved =
        approvers.length > 0 &&
        approvers.every((r) => r.status === 'approved')

      // Check if any reviewer rejected
      const hasRejection = review.reviewers.some((r) => r.status === 'rejected')

      // Update review status based on responses
      let newReviewStatus: ReviewStatus = review.reviewStatus as ReviewStatus
      if (hasRejection) {
        newReviewStatus = 'rejected' as ReviewStatus
      } else if (allResponded && (approvers.length === 0 || allApproversApproved)) {
        newReviewStatus = 'approved' as ReviewStatus
      }

      if (newReviewStatus !== review.reviewStatus) {
        const requirementSnapshot = await prisma.requirement.findUnique({
          where: { id: review.requirementId },
          select: {
            id: true,
            requirementId: true,
            title: true,
            projectId: true,
            reviewStatus: true,
          },
        })

        await prisma.requirementReview.update({
          where: { id: review.id },
          data: {
            reviewStatus: newReviewStatus,
            completedAt: newReviewStatus === 'approved' || newReviewStatus === 'rejected' ? new Date() : undefined,
          },
        })

        // Update requirement review status
        const nextStatus = newReviewStatus === 'approved'
          ? 'approved'
          : newReviewStatus === 'rejected'
            ? 'rejected'
            : 'under_review'

        await prisma.requirement.update({
          where: { id: review.requirementId },
          data: {
            reviewStatus: nextStatus,
          },
        })

        if (requirementSnapshot) {
          await notifyRequirementSubscribers({
            projectId: requirementSnapshot.projectId,
            requirementId: review.requirementId,
            actorUserId,
            changes: [`Review status: ${requirementSnapshot.reviewStatus || '—'} -> ${nextStatus}`],
            requirementSnapshot: {
              id: requirementSnapshot.id,
              requirementId: requirementSnapshot.requirementId,
              title: requirementSnapshot.title,
            },
          })
        }
      }

      return { success: true, data: reviewer }
    } catch (error: any) {
      console.error('Error updating reviewer:', error)
      return { success: false, error: error.message || 'Failed to update reviewer' }
    }
  },

  /**
   * Get review by ID
   */
  async getReview(reviewId: string) {
    try {
      const review = await prisma.requirementReview.findUnique({
        where: { id: reviewId },
        include: {
          reviewers: {
            orderBy: { createdAt: 'asc' },
          },
          requirement: {
            select: {
              id: true,
              requirementId: true,
              title: true,
              description: true,
            },
          },
        },
      })

      if (!review) {
        return { success: false, error: 'Review not found' }
      }

      return { success: true, data: review }
    } catch (error: any) {
      console.error('Error getting review:', error)
      return { success: false, error: error.message || 'Failed to get review' }
    }
  },

  /**
   * Get reviews for a requirement
   */
  async getRequirementReviews(requirementId: string) {
    try {
      const reviews = await prisma.requirementReview.findMany({
        where: { requirementId },
        include: {
          reviewers: {
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { success: true, data: reviews }
    } catch (error: any) {
      console.error('Error getting requirement reviews:', error)
      return { success: false, error: error.message || 'Failed to get reviews' }
    }
  },

  /**
   * Get reviews for a project
   */
  async getProjectReviews(projectId: string, status?: ReviewStatus) {
    try {
      const reviews = await prisma.requirementReview.findMany({
        where: {
          projectId,
          ...(status && { reviewStatus: status }),
        },
        include: {
          reviewers: true,
          requirement: {
            select: {
              id: true,
              requirementId: true,
              title: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { success: true, data: reviews }
    } catch (error: any) {
      console.error('Error getting project reviews:', error)
      return { success: false, error: error.message || 'Failed to get reviews' }
    }
  },

  /**
   * Cancel a review
   */
  async cancelReview(reviewId: string, actorUserId?: string) {
    try {
      const review = await prisma.requirementReview.update({
        where: { id: reviewId },
        data: {
          reviewStatus: 'cancelled',
          completedAt: new Date(),
        },
        include: {
          requirement: true,
        },
      })

      // Reset requirement review status if it was under review
      if (review.requirement.reviewStatus === 'under_review') {
        const previousStatus = review.requirement.reviewStatus
        await prisma.requirement.update({
          where: { id: review.requirementId },
          data: { reviewStatus: 'draft' },
        })

        await notifyRequirementSubscribers({
          projectId: review.requirement.projectId,
          requirementId: review.requirementId,
          actorUserId,
          changes: [`Review status: ${previousStatus || '—'} -> draft`],
          requirementSnapshot: {
            id: review.requirementId,
            requirementId: review.requirement.requirementId,
            title: review.requirement.title,
          },
        })
      }

      return { success: true, data: review }
    } catch (error: any) {
      console.error('Error cancelling review:', error)
      return { success: false, error: error.message || 'Failed to cancel review' }
    }
  },

  /**
   * Get reviews assigned to a user
   */
  async getUserReviews(userId: string, projectId?: string) {
    try {
      const reviews = await prisma.requirementReview.findMany({
        where: {
          ...(projectId && { projectId }),
          reviewers: {
            some: {
              reviewerId: userId,
              status: { in: ['pending', 'in_progress'] },
            },
          },
          reviewStatus: { in: ['draft', 'in_review'] },
        },
        include: {
          reviewers: true,
          requirement: {
            select: {
              id: true,
              requirementId: true,
              title: true,
              description: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      })

      return { success: true, data: reviews }
    } catch (error: any) {
      console.error('Error getting user reviews:', error)
      return { success: false, error: error.message || 'Failed to get user reviews' }
    }
  },
}
