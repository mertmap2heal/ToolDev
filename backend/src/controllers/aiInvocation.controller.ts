import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

/**
 * Admin-only AI invocation audit endpoints. Every AI/MCP call writes
 * one AiInvocation row; the list endpoint serves them paged for the
 * admin UI, and the export endpoint streams NDJSON for ISO/IEC 42001
 * Annex B audits. Both are gated by `requireAdmin` upstream.
 */

const MAX_PAGE = 200

export async function list(req: AuthRequest, res: Response) {
  try {
    const projectId = (req.query.projectId as string) || undefined
    const tier = (req.query.tier as string) || undefined
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE,
      Math.max(1, parseInt((req.query.pageSize as string) ?? '50', 10) || 50),
    )
    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId
    if (tier) where.tier = tier

    const [data, total] = await Promise.all([
      prisma.aiInvocation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          toolName: true,
          tier: true,
          projectId: true,
          userId: true,
          agentKeyId: true,
          inputHash: true,
          outputHash: true,
          contextTokens: true,
          success: true,
          durationMs: true,
          createdAt: true,
        },
      }),
      prisma.aiInvocation.count({ where }),
    ])
    res.json({ success: true, data, total, page, pageSize })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

export async function exportNdjson(req: AuthRequest, res: Response) {
  try {
    const projectId = (req.query.projectId as string) || undefined
    const where: Record<string, unknown> = {}
    if (projectId) where.projectId = projectId

    res.setHeader('Content-Type', 'application/x-ndjson')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="ai-invocations-${new Date().toISOString().slice(0, 10)}.ndjson"`,
    )

    // Stream rows in chunks to avoid loading the whole table into memory.
    const CHUNK = 500
    let cursor: string | null = null
    // Use a typed loop var so TS can infer the inner `rows` type cleanly.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const rows: Array<Record<string, unknown>> = await prisma.aiInvocation.findMany({
        where,
        orderBy: { id: 'asc' },
        take: CHUNK,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: {
          id: true,
          toolName: true,
          tier: true,
          projectId: true,
          userId: true,
          agentKeyId: true,
          inputHash: true,
          outputHash: true,
          contextTokens: true,
          success: true,
          durationMs: true,
          createdAt: true,
        },
      })
      if (rows.length === 0) break
      for (const r of rows) res.write(JSON.stringify(r) + '\n')
      if (rows.length < CHUNK) break
      cursor = String(rows[rows.length - 1].id)
    }
    res.end()
  } catch (e) {
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: (e as Error).message })
    } else {
      res.end()
    }
  }
}
