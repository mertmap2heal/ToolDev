import { apiClient } from './api'
import type { Component, ComponentTreeNode, CreateComponentDto, UpdateComponentDto } from 'shared/types/project.types'
import type { ApiResponse } from 'shared/types/api.types'

export const componentService = {
  /**
   * Get component tree for a project
   */
  async getComponentTree(projectId: string): Promise<ApiResponse<ComponentTreeNode[]>> {
    return apiClient.get<ComponentTreeNode[]>(`/projects/${projectId}/components`)
  },

  /**
   * Get or create the root component (MPAC) for a project
   */
  async getOrCreateRootComponent(projectId: string): Promise<ApiResponse<ComponentTreeNode>> {
    return apiClient.get<ComponentTreeNode>(`/projects/${projectId}/components/root`)
  },

  /**
   * Get a single component by ID
   */
  async getComponent(projectId: string, componentId: string): Promise<ApiResponse<Component>> {
    return apiClient.get<Component>(`/projects/${projectId}/components/${componentId}`)
  },

  /**
   * Create a new component under a parent
   */
  async createComponent(projectId: string, data: Omit<CreateComponentDto, 'projectId'>): Promise<ApiResponse<Component>> {
    return apiClient.post<Component>(`/projects/${projectId}/components`, data)
  },

  /**
   * Update a component
   */
  async updateComponent(projectId: string, componentId: string, data: UpdateComponentDto): Promise<ApiResponse<Component>> {
    return apiClient.put<Component>(`/projects/${projectId}/components/${componentId}`, data)
  },

  /**
   * Delete a component
   * @param reassignTo Optional component ID to reassign children/artifacts to
   */
  async deleteComponent(projectId: string, componentId: string, reassignTo?: string): Promise<ApiResponse<void>> {
    const url = reassignTo
      ? `/projects/${projectId}/components/${componentId}?reassignTo=${reassignTo}`
      : `/projects/${projectId}/components/${componentId}`
    return apiClient.delete<void>(url)
  },

  /**
   * Sync PBS nodes from localStorage to the component table
   */
  async syncPBSToComponents(projectId: string, nodes: any[]): Promise<ApiResponse<ComponentTreeNode[]>> {
    return apiClient.post<ComponentTreeNode[]>(`/projects/${projectId}/components/sync-pbs`, { nodes })
  },
}
