import { z } from 'zod'
import type { McpAuthContext } from '../auth'
import { recordCall } from '../audit'
import { draftParameter as doDraft } from '../../services/aiParameter.service'

/**
 * mcp.draft_parameter - T1. Produces a structured draft the caller
 * can hand to accept_parameter. Scope: `draft`.
 *
 * The tool does NOT persist anything - the response carries the
 * draft + provenance + invocationId. A follow-up accept_parameter
 * call (with human sign-off) is required to create the real row.
 */

export const draftParamInputSchema = {
  description: z.string().min(3).max(2000),
  contextText: z.string().max(10_000).optional(),
}

export const draftParamInputZod = z.object(draftParamInputSchema)

export async function handleDraftParameter(
  ctx: McpAuthContext,
  input: z.infer<typeof draftParamInputZod>,
) {
  const startedAt = Date.now()
  try {
    const result = await doDraft({
      projectId: ctx.projectId,
      userId: ctx.issuedById,
      description: input.description,
      contextText: input.contextText,
    })
    await recordCall({
      ctx,
      toolName: 'mcp.draft_parameter',
      tier: 'T1',
      input,
      output: { invocationId: result.invocationId, name: result.draft.name },
      success: true,
      startedAt,
      tokensIn: result.provenance.tokensIn,
      tokensOut: result.provenance.tokensOut,
      model: result.provenance.model,
      modelVersion: result.provenance.modelVersion,
    })
    return result
  } catch (e) {
    await recordCall({
      ctx,
      toolName: 'mcp.draft_parameter',
      tier: 'T1',
      input,
      output: null,
      success: false,
      errorMessage: (e as Error).message,
      startedAt,
    })
    throw e
  }
}
