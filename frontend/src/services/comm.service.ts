import { apiClient } from './api'
import type { CommBus, CommMessage, CommField } from 'shared/types/engineering.types'

// #289: every nested call now passes projectId in the URL so that the
// backend's project-membership middleware runs and the service-layer
// ownership checks scope the resource to the caller's project.

export const commService = {
  // ── Buses ─────────────────────────────────────────────────────────────────

  async getBuses(projectId: string): Promise<CommBus[]> {
    const res = await apiClient.get<CommBus[]>(`/comm/${projectId}/buses`)
    if (!res.success) throw new Error(res.error)
    return res.data ?? []
  },

  async createBus(projectId: string, data: { name: string; description?: string; protocol: string; config?: Record<string, unknown> }): Promise<CommBus> {
    const res = await apiClient.post<CommBus>(`/comm/${projectId}/buses`, data)
    if (!res.success) throw new Error(res.error)
    return res.data!
  },

  async updateBus(projectId: string, busId: string, data: Partial<{ name: string; description: string; protocol: string; config: Record<string, unknown> | null }>): Promise<CommBus> {
    const res = await apiClient.patch<CommBus>(`/comm/${projectId}/buses/${busId}`, data)
    if (!res.success) throw new Error(res.error)
    return res.data!
  },

  async deleteBus(projectId: string, busId: string): Promise<void> {
    const res = await apiClient.delete(`/comm/${projectId}/buses/${busId}`)
    if (!res.success) throw new Error(res.error)
  },

  // ── Messages ──────────────────────────────────────────────────────────────

  async getMessages(projectId: string, busId: string): Promise<CommMessage[]> {
    const res = await apiClient.get<CommMessage[]>(`/comm/${projectId}/buses/${busId}/messages`)
    if (!res.success) throw new Error(res.error)
    return res.data ?? []
  },

  async createMessage(projectId: string, busId: string, data: { name: string; messageId?: string; direction?: string; description?: string; metadata?: Record<string, unknown> }): Promise<CommMessage> {
    const res = await apiClient.post<CommMessage>(`/comm/${projectId}/buses/${busId}/messages`, data)
    if (!res.success) throw new Error(res.error)
    return res.data!
  },

  async updateMessage(projectId: string, messageId: string, data: Partial<{ name: string; messageId: string | null; direction: string | null; description: string; metadata: Record<string, unknown> | null }>): Promise<CommMessage> {
    const res = await apiClient.patch<CommMessage>(`/comm/${projectId}/messages/${messageId}`, data)
    if (!res.success) throw new Error(res.error)
    return res.data!
  },

  async deleteMessage(projectId: string, messageId: string): Promise<void> {
    const res = await apiClient.delete(`/comm/${projectId}/messages/${messageId}`)
    if (!res.success) throw new Error(res.error)
  },

  // ── Fields ────────────────────────────────────────────────────────────────

  async getFields(projectId: string, messageId: string): Promise<CommField[]> {
    const res = await apiClient.get<CommField[]>(`/comm/${projectId}/messages/${messageId}/fields`)
    if (!res.success) throw new Error(res.error)
    return res.data ?? []
  },

  async createField(projectId: string, messageId: string, data: { fieldName: string; parameterId?: string | null; description?: string; dataType?: string; order?: number; config?: Record<string, unknown> }): Promise<CommField> {
    const res = await apiClient.post<CommField>(`/comm/${projectId}/messages/${messageId}/fields`, data)
    if (!res.success) throw new Error(res.error)
    return res.data!
  },

  async updateField(projectId: string, fieldId: string, data: Partial<{ fieldName: string; parameterId: string | null; description: string | null; dataType: string | null; order: number; config: Record<string, unknown> | null }>): Promise<CommField> {
    const res = await apiClient.patch<CommField>(`/comm/${projectId}/fields/${fieldId}`, data)
    if (!res.success) throw new Error(res.error)
    return res.data!
  },

  async deleteField(projectId: string, fieldId: string): Promise<void> {
    const res = await apiClient.delete(`/comm/${projectId}/fields/${fieldId}`)
    if (!res.success) throw new Error(res.error)
  },

  async reorderFields(projectId: string, messageId: string, orderedIds: string[]): Promise<void> {
    const res = await apiClient.put(`/comm/${projectId}/messages/${messageId}/fields/reorder`, { orderedIds })
    if (!res.success) throw new Error(res.error)
  },
}
