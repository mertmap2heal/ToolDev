import { apiClient } from './api'
import type { ApiResponse } from 'shared/types/api.types'

export interface ColumnMappingEntry {
  systemField: string
  excelColumn: string
  namedRange?: string
}

export interface ExcelColumnMapping {
  id: string
  projectId: string
  name: string
  description?: string | null
  mappings: ColumnMappingEntry[]
  createdById?: string | null
  createdAt: string
  updatedAt: string
}

export const excelColumnMappingService = {
  async list(projectId: string): Promise<ApiResponse<ExcelColumnMapping[]>> {
    return apiClient.get<ExcelColumnMapping[]>(`/excel-column-mappings/${projectId}`)
  },

  async getOne(projectId: string, id: string): Promise<ApiResponse<ExcelColumnMapping>> {
    return apiClient.get<ExcelColumnMapping>(`/excel-column-mappings/${projectId}/${id}`)
  },

  async create(
    projectId: string,
    data: { name: string; description?: string; mappings: ColumnMappingEntry[] }
  ): Promise<ApiResponse<ExcelColumnMapping>> {
    return apiClient.post<ExcelColumnMapping>(`/excel-column-mappings/${projectId}`, data)
  },

  async update(
    projectId: string,
    id: string,
    data: { name?: string; description?: string; mappings?: ColumnMappingEntry[] }
  ): Promise<ApiResponse<ExcelColumnMapping>> {
    return apiClient.put<ExcelColumnMapping>(`/excel-column-mappings/${projectId}/${id}`, data)
  },

  async remove(projectId: string, id: string): Promise<ApiResponse<{ id: string }>> {
    return apiClient.delete<{ id: string }>(`/excel-column-mappings/${projectId}/${id}`)
  },
}
