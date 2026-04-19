import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { McpAuthContext } from '../auth'
import { recordCall } from '../audit'

/**
 * mcp.list_parameters - page through the project's parameters. Scope:
 * `read`. If the calling key lacks `itar`, itar-classified rows are
 * silently filtered out (they do not even show up in the count).
 */

export const listParamsInputSchema = {
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(500).default(50),
  folderId: z.string().optional(),
  status: z.enum(['draft', 'approved', 'obsolete']).optional(),
}

export const listParamsInputZod = z.object(listParamsInputSchema)

export async function handleListParameters(ctx: McpAuthContext, input: z.infer<typeof listParamsInputZod>) {
  const startedAt = Date.now()
  try {
    const where: Record<string, unknown> = { projectId: ctx.projectId }
    if (input.folderId) where.folderId = input.folderId
    if (input.status) where.status = input.status
    if (!ctx.itarScope) where.classification = { not: 'itar' }

    const [total, rows] = await Promise.all([
      prisma.parameter.count({ where }),
      prisma.parameter.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
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
          authorType: true,
          updatedAt: true,
        },
      }),
    ])

    const output = { total, page: input.page, pageSize: input.pageSize, data: rows }
    await recordCall({
      ctx,
      toolName: 'mcp.list_parameters',
      tier: 'T0',
      input,
      output: { total, page: input.page, count: rows.length },
      success: true,
      startedAt,
    })
    return output
  } catch (e) {
    await recordCall({
      ctx,
      toolName: 'mcp.list_parameters',
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
