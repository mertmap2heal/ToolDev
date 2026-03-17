import { apiClient } from './api'
import type {
  RequirementReview,
  RequirementReviewer,
  CreateReviewDto,
  UpdateReviewerDto,
  ReviewStatus,
} from 'shared/types/engineering.types'
import type { ApiResponse } from 'shared/types/api.types'

export const requirementReviewService = {
  /**
   * Create a new review for a requirement
   */
  async createReview(
    projectId: string,
    requirementId: string,
    data: CreateReviewDto
  ): Promise<ApiResponse<RequirementReview>> {
    return apiClient.post<RequirementReview>(
      `/projects/${projectId}/requirements/${requirementId}/reviews`,
      data
    )
  },

  /**
   * Get reviews for a requirement
   */
  async getRequirementReviews(projectId: string, requirementId: string): Promise<ApiResponse<RequirementReview[]>> {
    return apiClient.get<RequirementReview[]>(
      `/projects/${projectId}/requirements/${requirementId}/reviews`
    )
  },

  /**
   * Get review by ID
   */
  async getReview(projectId: string, reviewId: string): Promise<ApiResponse<RequirementReview>> {
    return apiClient.get<RequirementReview>(
      `/projects/${projectId}/reviews/${reviewId}`
    )
  },

  /**
   * Get reviews for a project
   */
  async getProjectReviews(projectId: string, status?: ReviewStatus): Promise<ApiResponse<RequirementReview[]>> {
    const params = status ? { status } : {}
    return apiClient.get<RequirementReview[]>(
      `/projects/${projectId}/reviews`,
      { params }
    )
  },

  /**
   * Get reviews assigned to current user
   */
  async getMyReviews(projectId: string): Promise<ApiResponse<RequirementReview[]>> {
    return apiClient.get<RequirementReview[]>(
      `/projects/${projectId}/reviews/my-reviews`
    )
  },

  /**
   * Start a review (change status from draft to in_review)
   */
  async startReview(projectId: string, reviewId: string): Promise<ApiResponse<RequirementReview>> {
    return apiClient.post<RequirementReview>(
      `/projects/${projectId}/reviews/${reviewId}/start`
    )
  },

  /**
   * Cancel a review
   */
  async cancelReview(projectId: string, reviewId: string): Promise<ApiResponse<RequirementReview>> {
    return apiClient.post<RequirementReview>(
      `/projects/${projectId}/reviews/${reviewId}/cancel`
    )
  },

  /**
   * Update reviewer response
   */
  async updateReviewer(
    projectId: string,
    reviewId: string,
    reviewerId: string,
    data: UpdateReviewerDto
  ): Promise<ApiResponse<RequirementReviewer>> {
    return apiClient.put<RequirementReviewer>(
      `/projects/${projectId}/reviews/${reviewId}/reviewers/${reviewerId}`,
      data
    )
  },
}
