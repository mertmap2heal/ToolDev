import { apiClient } from './api'

/**
 * BYOK credential service. The plaintext key is sent server-side once
 * on create and never returned again; after that the UI only sees the
 * masked tail + metadata.
 */

export interface AiCredentialSummary {
  id: string
  userId: string
  provider: 'anthropic' | 'openai' | 'azure' | 'google' | 'self_hosted'
  label: string
  maskedTail: string
  scopes: string[]
  lastUsedAt: string | null
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export const aiCredentialService = {
  list: () => apiClient.get<AiCredentialSummary[]>('/ai/credentials'),

  create: (body: {
    provider: AiCredentialSummary['provider']
    label: string
    plaintextKey: string
    scopes?: string[]
  }) => apiClient.post<AiCredentialSummary>('/ai/credentials', body),

  revoke: (id: string) => apiClient.delete<AiCredentialSummary>(`/ai/credentials/${id}`),
}
