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

/**
 * Shape of the backend-returned draft (phase 1c). Not a persisted
 * Parameter -- the user reviews + accepts which then creates a
 * real row with authorType='ai_accepted'.
 */
export interface AiDraftResult {
  name: string
  description?: string
  dataType?: string
  defaultValue?: string
  unit?: string
  minValue?: string
  maxValue?: string
  formula?: string
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

  /**
   * POST /ai/draft -- backend calls Anthropic (or future provider)
   * and returns a structured draft. Always gated behind the
   * three-layer AI feature flag. On the happy path the caller opens
   * a Create modal with the draft fields pre-filled so a human can
   * review + accept (which records authorType='ai_accepted').
   */
  draft: async (projectId: string, description: string, contextText?: string) => {
    return apiClient.post<{
      draft: AiDraftResult
      provenance: {
        model: string
        modelVersion: string
        promptId: string
        contextHash: string
        tokensIn: number
        tokensOut: number
      }
      invocationId: string
    }>(`/parameters/${projectId}/ai/draft`, { description, contextText })
  },
  // review, impact, accept -- land in follow-up PRs.
}
