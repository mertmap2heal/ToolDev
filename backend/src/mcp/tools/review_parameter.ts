import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { McpAuthContext } from '../auth'
import { recordCall } from '../audit'
import { resolveProviderForUser } from '../../services/aiProvider'
import { createHash } from 'crypto'

/**
 * mcp.review_parameter - T2. Asks the LLM to critique an existing
 * parameter (spelling, unit consistency, missing bounds, etc.) and
 * returns a structured review block. Scope: `review`.
 *
 * Does NOT mutate the parameter. The caller may attach the review
 * text to the parameter's comments via a follow-up write call.
 */

const REVIEW_PROMPT_ID = 'prompt_v1_parameter_review'
const REVIEW_SYSTEM = `You are an aerospace / automotive requirements engineer reviewing a parameter definition.

Return strict JSON:
{
  "issues": ["one-line issue descriptions"],
  "suggestions": ["concrete recommended changes"],
  "overallGrade": "excellent | good | needs_work | poor"
}

Never add commentary outside the JSON.`

export const reviewParamInputSchema = {
  parameterId: z.string(),
}

export const reviewParamInputZod = z.object(reviewParamInputSchema)

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function parseJson<T>(s: string): T | null {
  const t = s.trim()
  const c = t.startsWith('```')
    ? t.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim()
    : t
  try {
    return JSON.parse(c) as T
  } catch {
    return null
  }
}

export async function handleReviewParameter(
  ctx: McpAuthContext,
  input: z.infer<typeof reviewParamInputZod>,
) {
  const startedAt = Date.now()
  try {
    const row = await prisma.parameter.findFirst({
      where: { id: input.parameterId, projectId: ctx.projectId },
      select: {
        id: true, name: true, description: true, dataType: true,
        defaultValue: true, unit: true, minValue: true, maxValue: true,
        formula: true, classification: true,
      },
    })
    if (!row) throw new Error('parameter not found')
    if (row.classification === 'itar' && !ctx.itarScope) {
      throw new Error('itar scope required')
    }

    const user = `Parameter:\n${JSON.stringify(row, null, 2)}`
    const contextHash = sha256(user)
    const { adapter, provider } = await resolveProviderForUser({
      userId: ctx.issuedById,
      projectId: ctx.projectId,
    })
    const res = await adapter.chat({ system: REVIEW_SYSTEM, user, maxTokens: 1024 })
    const review = parseJson<{
      issues?: string[]
      suggestions?: string[]
      overallGrade?: string
    }>(res.text) ?? { issues: ['model returned non-JSON'], suggestions: [], overallGrade: 'needs_work' }

    const inv = await prisma.aiInvocation.create({
      data: {
        projectId: ctx.projectId,
        userId: null,
        agentKeyId: ctx.keyId,
        toolName: 'mcp.review_parameter',
        tier: 'T2',
        model: res.model,
        modelVersion: res.modelVersion,
        promptId: REVIEW_PROMPT_ID,
        contextHash,
        inputHash: contextHash,
        outputHash: sha256(res.text),
        contextTokens: res.tokensIn,
        outputTokens: res.tokensOut,
        success: true,
        durationMs: Date.now() - startedAt,
      },
    })

    const output = {
      parameterId: row.id,
      review,
      provenance: {
        model: res.model,
        modelVersion: res.modelVersion,
        promptId: REVIEW_PROMPT_ID,
        provider,
        tokensIn: res.tokensIn,
        tokensOut: res.tokensOut,
      },
      invocationId: inv.id,
    }
    // recordCall writes a second audit row; skip - the inv.create above already covers it.
    return output
  } catch (e) {
    await recordCall({
      ctx,
      toolName: 'mcp.review_parameter',
      tier: 'T2',
      input,
      output: null,
      success: false,
      errorMessage: (e as Error).message,
      startedAt,
    })
    throw e
  }
}
