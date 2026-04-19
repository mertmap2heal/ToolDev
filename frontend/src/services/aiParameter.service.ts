import { apiClient } from './api'

/**
 * AI-tier parameter service. Every call here is gated server-side by
 * requireAiEnabled (three-layer: env + project + package). A 403 from
 * any endpoint carries `code: "AI_DISABLED_*"` which the UI uses to
 * render an actionable message.
 *
 * Phase 1c only ships the `ping` probe; `draft` / `review` / `impact`
 * / `accept` arrive in a follow-up PR. Signatures are declared here
 * so the rest of the frontend can import them once they're live.
 */

export interface AiDraftInput {
  contextText: string
  parentFunctionId?: string
  folderId?: string
}

export interface AiDraftResult {
  id: string
  name: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  formula?: string
  authorType: 'ai_suggestion'
  reviewStatus: 'drafted'
  authorAiModel: string
  authorAiVersion: string
  authorAiPromptId: string
}

export const aiParameterService = {
  /**
   * Health probe. Returns 200 only when all three AI flags pass.
   */
  ping: async (projectId: string) => {
    return apiClient.get<{ projectId: string; userId: string; ts: number }>(
      `/parameters/${projectId}/ai/ping`,
    )
  },

  // draft, review, impact, accept -- land in phase 1c follow-up.
}
