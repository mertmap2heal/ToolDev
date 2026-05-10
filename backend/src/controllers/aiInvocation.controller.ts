import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

/**
 * Admin-only AI invocation audit endpoints. Every AI/MCP call writes
 * one AiInvocation row; the list endpoint serves them paged for the
 * admin UI, and the export endpoint streams NDJSON for ISO/IEC 42001
 * Annex B audits. Both are gated by `requireAdmin` upstream.
 *
 * SECURITY (HIGH-3): requireAdmin admits any COMPANY_ADMIN. Without an
 * extra company filter, an admin of company A could read or stream every
 * other tenant's AI audit trail. We compute an allowed-project-id set
 * (caller's company's projects) for non-superior admins and intersect any
 * caller-supplied projectId filter with it. SUPERIOR_ADMIN keeps
 * platform-wide visibility.
 */

const MAX_PAGE = 200

async function buildTenantScope(callerId: string, requestedProjectId: string | undefined): Promise<{
  where: Record<string, unknown>
  forbidden: boolean
}> {
  const caller = await prisma.user.findUnique({
    where: { id: callerId },
    select: { role: true, company: true },
  })
  const where: Record<string, unknown> = {}
  if (caller?.role === 'SUPERIOR_ADMIN') {
    if (requestedProjectId) where.projectId = requestedProjectId
    return { where, forbidden: false }
  }
  // Non-superior admins (COMPANY_ADMIN, ADMIN_EMAILS, first-user fallback)
  // see only their own company's projects.
  const company = caller?.company ?? null
  const allowed = company
    ? await prisma.project.findMany({
        where: { companyName: company },
        select: { id: true },
      })
    : []
  const allowedIds = new Set(allowed.map((p) => p.id))
  if (requestedProjectId) {
    if (!allowedIds.has(requestedProjectId)) return { where, forbidden: true }
    where.projectId = requestedProjectId
  } else {
    where.projectId = { in: Array.from(allowedIds) }
  }
  return { where, forbidden: false }
}

export async function list(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const projectId = (req.query.projectId as string) || undefined
    const tier = (req.query.tier as string) || undefined
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE,
      Math.max(1, parseInt((req.query.pageSize as string) ?? '50', 10) || 50),
    )

    const scope = await buildTenantScope(req.userId, projectId)
    if (scope.forbidden) {
      return res.status(403).json({ success: false, error: 'Project not in your tenant' })
    }
    const where: Record<string, unknown> = { ...scope.where }
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
    if (!req.userId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const projectId = (req.query.projectId as string) || undefined
    const scope = await buildTenantScope(req.userId, projectId)
    if (scope.forbidden) {
      return res.status(403).json({ success: false, error: 'Project not in your tenant' })
    }
    const where = scope.where

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
