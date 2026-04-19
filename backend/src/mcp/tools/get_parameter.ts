import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { McpAuthContext } from '../auth'
import { recordCall } from '../audit'

/**
 * mcp.get_parameter - fetch a single parameter by id or by
 * (projectId, name). Scope: `read`. Respects the itar filter.
 */

export const getParamInputSchema = {
  id: z.string().optional(),
  name: z.string().optional(),
}

export const getParamInputZod = z.object(getParamInputSchema).refine(
  (v) => !!v.id || !!v.name,
  { message: 'id or name is required' },
)

export async function handleGetParameter(ctx: McpAuthContext, input: z.infer<typeof getParamInputZod>) {
  const startedAt = Date.now()
  try {
    const where: Record<string, unknown> = input.id
      ? { id: input.id, projectId: ctx.projectId }
      : { projectId: ctx.projectId, name: input.name }
    const row = await prisma.parameter.findFirst({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        dataType: true,
        defaultValue: true,
        unit: true,
        minValue: true,
        maxValue: true,
        status: true,
        folderId: true,
        classification: true,
        authorType: true,
        updatedAt: true,
      },
    })
    if (row && !ctx.itarScope && row.classification === 'itar') {
      await recordCall({
        ctx,
        toolName: 'mcp.get_parameter',
        tier: 'T0',
        input,
        output: null,
        success: false,
        errorMessage: 'not_found',
        startedAt,
      })
      return { found: false }
    }
    const output = row ? { found: true, parameter: row } : { found: false }
    await recordCall({
      ctx,
      toolName: 'mcp.get_parameter',
      tier: 'T0',
      input,
      output,
      success: true,
      startedAt,
    })
    return output
  } catch (e) {
    await recordCall({
      ctx,
      toolName: 'mcp.get_parameter',
      tier: 'T0',
      input,
      output: null,
      success: false,
      errorMessage: (e as Error).message,
      startedAt,
    })
    throw e
  }
}
