import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

interface AIGuidanceRequest {
  projectId: string
  stage: string
  context: string
  prompt: string
}

interface AIGuidanceResponse {
  guidance: string
  suggestions: string[]
  nextSteps: string[]
}

export const aiService = {
  async getGuidance(data: AIGuidanceRequest): Promise<ApiResponse<AIGuidanceResponse>> {
    return apiClient.post<AIGuidanceResponse>('/ai/guidance', data)
  },
}
