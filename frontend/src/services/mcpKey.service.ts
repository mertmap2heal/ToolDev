import { apiClient } from './api'

/**
 * Admin-only MCP key management. The plaintext key is returned exactly
 * once on create and never again - the consumer must surface it to the
 * user immediately. Revoke is soft (sets revokedAt); list includes
 * revoked rows for audit.
 */

export interface McpKeySummary {
  id: string
  name: string
  scopes: string[]
  itarScope: boolean
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

export interface CreateMcpKeyResponse {
  id: string
  plaintext: string
}

export const mcpKeyService = {
  list: (projectId: string) =>
    apiClient.get<McpKeySummary[]>(`/admin/projects/${projectId}/mcp-keys`),

  create: (
    projectId: string,
    body: { name: string; scopes: string[]; itarScope?: boolean; expiresAt?: string },
  ) => apiClient.post<CreateMcpKeyResponse>(`/admin/projects/${projectId}/mcp-keys`, body),

  revoke: (projectId: string, keyId: string) =>
    apiClient.delete<{ id: string; revokedAt: string }>(
      `/admin/projects/${projectId}/mcp-keys/${keyId}`,
    ),
}
