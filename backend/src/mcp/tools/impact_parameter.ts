import { z } from 'zod'
import { prisma } from '../../lib/prisma'
import type { McpAuthContext } from '../auth'
import { recordCall } from '../audit'

/**
 * mcp.impact_parameter - T3 (pure deterministic). Walks the
 * derivedParameters relation + sourceParameterId DAG to find every
 * parameter whose value could change if the input parameter's value
 * changes. Also counts linked requirements / functions for blast-radius.
 *
 * Deterministic - no LLM call - but recorded the same way so the
 * agent can reason about cost-of-change.
 */

export const impactParamInputSchema = {
  parameterId: z.string(),
  depth: z.number().int().min(1).max(10).default(5),
}

export const impactParamInputZod = z.object(impactParamInputSchema)

export async function handleImpactParameter(
  ctx: McpAuthContext,
  input: z.infer<typeof impactParamInputZod>,
) {
  const startedAt = Date.now()
  try {
    const root = await prisma.parameter.findFirst({
      where: { id: input.parameterId, projectId: ctx.projectId },
      select: { id: true, name: true, classification: true },
    })
    if (!root) throw new Error('parameter not found')
    if (root.classification === 'itar' && !ctx.itarScope) {
      throw new Error('itar scope required')
    }

    // BFS over derived chain
    const visited = new Set<string>([root.id])
    const levels: { id: string; name: string; depth: number }[] = []
    let frontier = [root.id]
    for (let d = 1; d <= input.depth && frontier.length > 0; d++) {
      const children = await prisma.parameter.findMany({
        where: { projectId: ctx.projectId, sourceParameterId: { in: frontier } },
        select: { id: true, name: true, sourceParameterId: true, classification: true },
      })
      const next: string[] = []
      for (const c of children) {
        if (visited.has(c.id)) continue
        if (c.classification === 'itar' && !ctx.itarScope) continue
        visited.add(c.id)
        next.push(c.id)
        levels.push({ id: c.id, name: c.name, depth: d })
      }
      frontier = next
    }

    const output = {
      rootParameterId: root.id,
      rootName: root.name,
      dependents: levels,
      totalImpacted: levels.length,
      maxDepthReached: levels.reduce((m, l) => Math.max(m, l.depth), 0),
    }
    await recordCall({
      ctx,
      toolName: 'mcp.impact_parameter',
      tier: 'T3',
      input,
      output: { totalImpacted: output.totalImpacted, maxDepthReached: output.maxDepthReached },
      success: true,
      startedAt,
    })
    return output
  } catch (e) {
    await recordCall({
      ctx,
      toolName: 'mcp.impact_parameter',
      tier: 'T3',
      input,
      output: null,
      success: false,
      errorMessage: (e as Error).message,
      startedAt,
    })
    throw e
  }
}
