import { apiClient } from './api'
import type { WorkflowProgress } from 'shared/types/workflow.types'
import type { ApiResponse } from 'shared/types/api.types'

export const workflowService = {
  async getWorkflowProgress(projectId: string): Promise<ApiResponse<WorkflowProgress>> {
    return apiClient.get<WorkflowProgress>(`/workflow/${projectId}`)
  },

  async updateWorkflowStep(
    projectId: string,
    stepId: string,
    data: { isCompleted: boolean }
  ): Promise<ApiResponse<void>> {
    return apiClient.put<void>(`/workflow/${projectId}/steps/${stepId}`, data)
  },
}
