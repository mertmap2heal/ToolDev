import { apiClient } from './api'
import type {
  Diagram,
  CreateDiagramDto,
  UpdateDiagramDto,
  DiagramLayout,
  SourceElementType,
} from 'shared/types/diagram.types'
import type { ApiResponse } from 'shared/types/api.types'

/**
 * Diagram service provides client-side API methods for managing
 * MBSE diagrams including creation, updates, and linking to source elements.
 */
export const diagramService = {
  /**
   * Get all diagrams for a project
   */
  async getDiagrams(projectId: string): Promise<ApiResponse<Diagram[]>> {
    return apiClient.get<Diagram[]>(`/diagrams/${projectId}`)
  },

  /**
   * Get a single diagram by ID
   */
  async getDiagram(projectId: string, diagramId: string): Promise<ApiResponse<Diagram>> {
    return apiClient.get<Diagram>(`/diagrams/${projectId}/${diagramId}`)
  },

  /**
   * Create a new diagram
   */
  async createDiagram(projectId: string, data: CreateDiagramDto): Promise<ApiResponse<Diagram>> {
    return apiClient.post<Diagram>(`/diagrams/${projectId}`, data)
  },

  /**
   * Update an existing diagram
   */
  async updateDiagram(
    projectId: string,
    diagramId: string,
    data: UpdateDiagramDto
  ): Promise<ApiResponse<Diagram>> {
    return apiClient.put<Diagram>(`/diagrams/${projectId}/${diagramId}`, data)
  },

  /**
   * Delete a diagram
   */
  async deleteDiagram(projectId: string, diagramId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/diagrams/${projectId}/${diagramId}`)
  },

  /**
   * Get diagrams linked to a specific element
   */
  async getDiagramsByElement(
    projectId: string,
    elementType: SourceElementType,
    elementId: string
  ): Promise<ApiResponse<Diagram[]>> {
    return apiClient.get<Diagram[]>(`/diagrams/${projectId}/element/${elementType}/${elementId}`)
  },

  /**
   * Save diagram layout (node positions, viewport, etc.)
   */
  async saveDiagramLayout(
    projectId: string,
    diagramId: string,
    layout: DiagramLayout
  ): Promise<ApiResponse<Diagram>> {
    return apiClient.put<Diagram>(`/diagrams/${projectId}/${diagramId}/layout`, { layout })
  },
}
