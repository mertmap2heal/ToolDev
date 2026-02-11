import { apiClient } from './api'
import type {
  Task,
  CreateTaskDto,
  UpdateTaskDto,
  ListTasksFilters,
} from 'shared/types/task.types'
import type { ApiResponse, PaginatedResponse as ApiPaginatedResponse } from 'shared/types/api.types'

export const taskService = {
  async getTasks(filters?: ListTasksFilters): Promise<ApiResponse<ApiPaginatedResponse<Task>>> {
    const params = new URLSearchParams()
    
    if (filters) {
      if (filters.projectId) params.append('project_id', filters.projectId)
      if (filters.search) params.append('search', filters.search)
      if (filters.status) params.append('status', filters.status)
      if (filters.priority) params.append('priority', filters.priority)
      if (filters.dueFrom) params.append('due_from', filters.dueFrom)
      if (filters.dueTo) params.append('due_to', filters.dueTo)
      if (filters.createdFrom) params.append('created_from', filters.createdFrom)
      if (filters.createdTo) params.append('created_to', filters.createdTo)
      if (filters.tag) params.append('tag', filters.tag)
      if (filters.blocked !== undefined) params.append('blocked', String(filters.blocked))
      if (filters.hasAttachments) params.append('has_attachments', 'true')
      if (filters.hasComments) params.append('has_comments', 'true')
      if (filters.overdue) params.append('overdue', 'true')
      if (filters.hasDependencies) params.append('has_dependencies', 'true')
      if (filters.sort) params.append('sort', filters.sort)
      if (filters.groupBy) params.append('group_by', filters.groupBy)
      if (filters.page) params.append('page', String(filters.page))
      if (filters.pageSize) params.append('page_size', String(filters.pageSize))
    }

    const queryString = params.toString()
    return apiClient.get<ApiPaginatedResponse<Task>>(`/tasks${queryString ? `?${queryString}` : ''}`)
  },

  async getTask(id: string): Promise<ApiResponse<Task>> {
    return apiClient.get<Task>(`/tasks/${id}`)
  },

  async createTask(data: CreateTaskDto, idempotencyKey?: string): Promise<ApiResponse<Task>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
    return apiClient.post<Task>('/tasks', data, headers)
  },

  async updateTask(id: string, data: UpdateTaskDto, idempotencyKey?: string): Promise<ApiResponse<Task>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
    return apiClient.patch<Task>(`/tasks/${id}`, data, headers)
  },

  async deleteTask(id: string, idempotencyKey?: string): Promise<ApiResponse<void>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
    return apiClient.delete<void>(`/tasks/${id}`, headers)
  },

  async duplicateTask(
    id: string,
    options: { includeSubtasks?: boolean; includeAttachments?: boolean },
    idempotencyKey?: string
  ): Promise<ApiResponse<Task>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
    return apiClient.post<Task>(`/tasks/${id}/duplicate`, options, headers)
  },

  async bulkUpdateTasks(
    taskIds: string[],
    updates: UpdateTaskDto,
    idempotencyKey?: string
  ): Promise<ApiResponse<Task[]>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
    return apiClient.post<Task[]>('/tasks/bulk', { task_ids: taskIds, updates }, headers)
  },

  // Board methods
  async getBoardColumns(projectId?: string): Promise<ApiResponse<any[]>> {
    const params = projectId ? `?project_id=${projectId}` : ''
    return apiClient.get<any[]>(`/board/columns${params}`)
  },

  async updateBoardColumn(
    columnId: string,
    updates: { wipLimit?: number; sortOrder?: number; name?: string }
  ): Promise<ApiResponse<any>> {
    return apiClient.patch<any>(`/board/columns/${columnId}`, {
      wip_limit: updates.wipLimit,
      sort_order: updates.sortOrder,
      name: updates.name,
    })
  },

  async moveTaskOnBoard(
    taskId: string,
    targetStatus: string,
    targetSortOrder?: number,
    idempotencyKey?: string
  ): Promise<ApiResponse<Task>> {
    const headers = idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined
    return apiClient.post<Task>(
      '/board/move-task',
      {
        task_id: taskId,
        target_status: targetStatus,
        target_sort_order: targetSortOrder,
      },
      headers
    )
  },

  // Tag methods
  async getTags(): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>('/tags')
  },

  async createTag(data: { name: string; color?: string }): Promise<ApiResponse<any>> {
    return apiClient.post<any>('/tags', data)
  },

  async linkTagToTask(taskId: string, tagId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/tasks/${taskId}/tags/${tagId}`)
  },

  async unlinkTagFromTask(taskId: string, tagId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/tasks/${taskId}/tags/${tagId}`)
  },

  // Comment methods
  async getComments(taskId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`/tasks/${taskId}/comments`)
  },

  async createComment(taskId: string, data: { bodyRich: string; authorName?: string }): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/tasks/${taskId}/comments`, {
      body_rich: data.bodyRich,
      author_name: data.authorName,
    })
  },

  // Attachment methods
  async getAttachments(taskId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`/tasks/${taskId}/attachments`)
  },

  async uploadAttachment(
    taskId: string,
    file: File
  ): Promise<ApiResponse<any>> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        const fileData = reader.result as string
        const response = await apiClient.post<any>(`/tasks/${taskId}/attachments`, {
          fileName: file.name,
          fileData,
          mimeType: file.type,
        })
        resolve(response)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  },

  async deleteAttachment(attachmentId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/attachments/${attachmentId}`)
  },

  // Relation methods
  async getRelations(taskId: string): Promise<ApiResponse<any>> {
    return apiClient.get<any>(`/tasks/${taskId}/relations`)
  },

  async createRelation(
    taskId: string,
    data: { targetTaskId: string; relationType: string }
  ): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/tasks/${taskId}/relations`, {
      target_task_id: data.targetTaskId,
      relation_type: data.relationType,
    })
  },

  async deleteRelation(relationId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/relations/${relationId}`)
  },

  async getDependencyWarnings(taskId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`/tasks/${taskId}/dependency-warnings`)
  },

  // Activity methods
  async getActivity(taskId: string): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>(`/tasks/${taskId}/activity`)
  },

  // Calendar methods
  async getCalendarTasks(data: {
    projectId?: string
    startDate?: string
    endDate?: string
  }): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams()
    if (data.projectId) params.append('project_id', data.projectId)
    if (data.startDate) params.append('start_date', data.startDate)
    if (data.endDate) params.append('end_date', data.endDate)
    const queryString = params.toString()
    return apiClient.get<any[]>(`/tasks/calendar${queryString ? `?${queryString}` : ''}`)
  },

  // Saved View methods
  async getSavedViews(projectId?: string): Promise<ApiResponse<any[]>> {
    const params = projectId ? `?project_id=${projectId}` : ''
    return apiClient.get<any[]>(`/saved-views${params}`)
  },

  async createSavedView(data: {
    projectId?: string
    name: string
    viewType: string
    queryJson?: string
    columnsJson?: string
    sortJson?: string
    groupJson?: string
  }): Promise<ApiResponse<any>> {
    return apiClient.post<any>('/saved-views', {
      project_id: data.projectId,
      name: data.name,
      view_type: data.viewType,
      query_json: data.queryJson,
      columns_json: data.columnsJson,
      sort_json: data.sortJson,
      group_json: data.groupJson,
    })
  },

  async getSavedView(viewId: string): Promise<ApiResponse<any>> {
    return apiClient.get<any>(`/saved-views/${viewId}`)
  },

  async updateSavedView(
    viewId: string,
    data: {
      name?: string
      queryJson?: string
      columnsJson?: string
      sortJson?: string
      groupJson?: string
    }
  ): Promise<ApiResponse<any>> {
    return apiClient.patch<any>(`/saved-views/${viewId}`, {
      name: data.name,
      query_json: data.queryJson,
      columns_json: data.columnsJson,
      sort_json: data.sortJson,
      group_json: data.groupJson,
    })
  },

  async deleteSavedView(viewId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/saved-views/${viewId}`)
  },

  // Automation methods
  async getAutomationRules(): Promise<ApiResponse<any[]>> {
    return apiClient.get<any[]>('/automation/rules')
  },

  async createAutomationRule(data: {
    name: string
    triggerType: string
    conditionsJson: string
    actionsJson: string
  }): Promise<ApiResponse<any>> {
    return apiClient.post<any>('/automation/rules', {
      name: data.name,
      trigger_type: data.triggerType,
      conditions_json: data.conditionsJson,
      actions_json: data.actionsJson,
    })
  },

  async testAutomationRule(ruleId: string, taskId: string): Promise<ApiResponse<any>> {
    return apiClient.post<any>(`/automation/rules/${ruleId}/test`, { task_id: taskId })
  },

  async getAutomationRuns(ruleId?: string, limit?: number): Promise<ApiResponse<any[]>> {
    const params = new URLSearchParams()
    if (ruleId) params.append('rule_id', ruleId)
    if (limit) params.append('limit', String(limit))
    const queryString = params.toString()
    return apiClient.get<any[]>(`/automation/runs${queryString ? `?${queryString}` : ''}`)
  },

  // CSV Import/Export methods
  async exportTasks(data: {
    projectId?: string
    filters?: any
    columns?: string[]
  }): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '/api/v1' : 'http://localhost:5000/api/v1')
    const response = await fetch(`${apiBase}/csv/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        project_id: data.projectId,
        ...data.filters,
        columns: data.columns || ['title', 'status', 'priority', 'due_date', 'tags'],
      }),
    })
    return response.blob()
  },

  async importTasks(data: {
    csvData: string
    projectId?: string
    mapping?: Record<string, string>
  }): Promise<ApiResponse<any>> {
    return apiClient.post<any>('/csv/import', {
      csv_data: data.csvData,
      project_id: data.projectId,
      mapping: data.mapping,
    })
  },
}
