import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { McpAuthContext } from '../auth'
import { recordCall } from '../audit'

/**
 * mcp.accept_parameter - persists a previously-drafted parameter as
 * an `ai_accepted` row. Scope: `draft` (since this is the terminal
 * step of the draft workflow).
 *
 * The caller must pass the draft fields exactly as returned by
 * draft_parameter plus the `invocationId` to stitch provenance.
 */

export const acceptParamInputSchema = {
  invocationId: z.string(),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  dataType: z.string().optional(),
  defaultValue: z.string().optional(),
  unit: z.string().optional(),
  minValue: z.string().optional(),
  maxValue: z.string().optional(),
  formula: z.string().optional(),
  folderId: z.string().optional(),
  classification: z.enum(['public', 'internal', 'confidential', 'itar']).optional(),
}

export const acceptParamInputZod = z.object(acceptParamInputSchema)

async function nextParameterId(projectId: string): Promise<string> {
  const last = await prisma.parameter.findFirst({
    where: { projectId, parameterId: { startsWith: 'PRM-' } },
    orderBy: { parameterId: 'desc' },
    select: { parameterId: true },
  })
  const n = last?.parameterId ? parseInt(last.parameterId.replace('PRM-', ''), 10) : 0
  const next = Number.isFinite(n) ? n + 1 : 1
  return 'PRM-' + String(next).padStart(4, '0')
}

export async function handleAcceptParameter(
  ctx: McpAuthContext,
  input: z.infer<typeof acceptParamInputZod>,
) {
  const startedAt = Date.now()
  try {
    const invocation = await prisma.aiInvocation.findUnique({
      where: { id: input.invocationId },
    })
    if (!invocation || invocation.projectId !== ctx.projectId) {
      throw new Error('invocation not found or cross-project')
    }
    if (input.classification === 'itar' && !ctx.itarScope) {
      throw new Error('itar scope required to create itar parameters')
    }
    const parameterId = await nextParameterId(ctx.projectId)
    const row = await prisma.parameter.create({
      data: {
        projectId: ctx.projectId,
        parameterId,
        name: input.name,
        description: input.description ?? null,
        dataType: input.dataType ?? 'float',
        defaultValue: input.defaultValue ?? null,
        unit: input.unit ?? null,
        minValue: input.minValue ?? null,
        maxValue: input.maxValue ?? null,
        formula: input.formula ?? null,
        folderId: input.folderId ?? null,
        classification: input.classification ?? 'internal',
        status: 'draft',
        authorType: 'ai_accepted',
        authorAiModel: invocation.model ?? null,
        authorAiVersion: invocation.modelVersion ?? null,
        authorAiPromptId: invocation.promptId ?? null,
        authorAiContextHash: invocation.contextHash ?? null,
        reviewStatus: 'drafted',
      },
      select: { id: true, parameterId: true, name: true, authorType: true },
    })
    await recordCall({
      ctx,
      toolName: 'mcp.accept_parameter',
      tier: 'T1',
      input: { invocationId: input.invocationId, name: input.name },
      output: { parameterId: row.id },
      success: true,
      startedAt,
    })
    return { accepted: true, parameter: row }
  } catch (e) {
    await recordCall({
      ctx,
      toolName: 'mcp.accept_parameter',
      tier: 'T1',
      input: { invocationId: input.invocationId, name: input.name },
      output: null,
      success: false,
      errorMessage: (e as Error).message,
      startedAt,
    })
    throw e
  }
}
