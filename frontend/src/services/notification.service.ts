import { apiClient } from './api'
import type { Notification } from 'shared/types/project.types'
import type { ApiResponse } from 'shared/types/api.types'

const BASE = '/notifications'

export const notificationService = {
  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    return apiClient.get<Notification[]>(BASE)
  },

  async markAsRead(id: string): Promise<ApiResponse<void>> {
    return apiClient.patch<void>(`${BASE}/${id}/read`, {})
  },

  async markAllAsRead(): Promise<ApiResponse<void>> {
    return apiClient.patch<void>(`${BASE}/read-all`, {})
  },
}
