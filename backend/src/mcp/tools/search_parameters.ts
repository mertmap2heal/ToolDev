import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { McpAuthContext } from '../auth'
import { recordCall } from '../audit'

/**
 * mcp.search_parameters - substring match over name / description.
 * Scope: `read`. Respects itar filter.
 *
 * v1 uses `contains` (Postgres ILIKE). A vector / full-text search
 * lands as T4 RAG once the embedding pipeline is live.
 */

export const searchParamsInputSchema = {
  query: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(100).default(20),
}

export const searchParamsInputZod = z.object(searchParamsInputSchema)

export async function handleSearchParameters(
  ctx: McpAuthContext,
  input: z.infer<typeof searchParamsInputZod>,
) {
  const startedAt = Date.now()
  try {
    const where: Record<string, unknown> = {
      projectId: ctx.projectId,
      OR: [
        { name: { contains: input.query, mode: 'insensitive' } },
        { description: { contains: input.query, mode: 'insensitive' } },
      ],
    }
    if (!ctx.itarScope) where.classification = { not: 'itar' }

    const rows = await prisma.parameter.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: input.limit,
      select: {
        id: true,
        name: true,
        description: true,
        dataType: true,
        unit: true,
        status: true,
        folderId: true,
        authorType: true,
      },
    })

    const output = { count: rows.length, data: rows }
    await recordCall({
      ctx,
      toolName: 'mcp.search_parameters',
      tier: 'T0',
      input,
      output: { count: rows.length, queryLen: input.query.length },
      success: true,
      startedAt,
    })
    return output
  } catch (e) {
    await recordCall({
      ctx,
      toolName: 'mcp.search_parameters',
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
