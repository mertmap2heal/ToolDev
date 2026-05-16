import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

/**
 * Admin-only AI invocation audit endpoints. Every AI/MCP call writes
 * one AiInvocation row; the list endpoint serves them paged for the
 * admin UI, and the export endpoint streams NDJSON for ISO/IEC 42001
 * Annex B audits.
 *
 * SECURITY (SEC-1, issue #374): the platform endpoints `list` and
 * `exportNdjson` are now gated by `requireSuperiorAdmin` at the route
 * level - they see every tenant's rows and must not be reachable by
 * COMPANY_ADMIN. `buildTenantScope` is preserved as defence-in-depth so
 * the controller still applies the company filter if the route gate is
 * ever loosened. COMPANY_ADMIN callers go through `listForCompany`,
 * which derives the company filter from `req.user.company` and rejects
 * the request when the caller has no company set.
 *
 * Every call writes one row to the central `AuditLog` using the
 * `<module>:<kebab-verb>` convention (per .claude/kb/backend-patterns.md
 * "Tenant Scope" and the validation cross-cut on AuditLog as canonical).
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

export type AiInvocationAuditAction =
  | 'admin:ai-invocations-read'
  | 'admin:ai-invocations-export'
  | 'admin:ai-invocations-company-read'
  | 'admin:ai-invocations-read-denied'
  | 'admin:ai-invocations-export-denied'
  | 'admin:ai-invocations-company-read-denied'

export async function writeAccessAudit(
  userId: string,
  action: AiInvocationAuditAction,
  details: Record<string, unknown>,
) {
  // Pick a project anchor so the AuditLog row satisfies its non-null
  // projectId column. Priority:
  //   1. projectId from request payload, if a string.
  //   2. Caller's first-owned project (stable anchor for COMPANY_ADMIN).
  //   3. Any project in the DB (SUPERIOR_ADMIN fallback - sees all
  //      projects, so this still attributes the audit correctly to a
  //      real project even though the access event is platform-wide).
  // When the fallback at (3) is used, we emit a console.warn so ops can
  // spot the limitation in logs. Unifying this onto a project-less audit
  // surface is tracked in ROADMAP-phase3.md R-8 (AP-N5) - see
  // _shared/cross-cutting.md "AiInvocation ledger leaks cross-tenant via
  // requireAdmin" for the long-term plan.
  let anchorProjectId: string | null = null
  let fallbackUsed: 'none' | 'owned' | 'any' = 'none'
  if (typeof details.projectId === 'string' && details.projectId) {
    anchorProjectId = details.projectId
  } else {
    const owned = await prisma.project
      .findFirst({ where: { userId }, select: { id: true } })
      .catch(() => null)
    if (owned?.id) {
      anchorProjectId = owned.id
      fallbackUsed = 'owned'
    } else {
      // SUPERIOR_ADMIN with no owned project: fall back to any project so
      // the audit trail captures the access. The audit row content only
      // identifies the actor + action + query params - no cross-tenant
      // data leaks via the anchor. See R-8 / AP-N5 follow-up.
      const any = await prisma.project
        .findFirst({ select: { id: true } })
        .catch(() => null)
      if (any?.id) {
        anchorProjectId = any.id
        fallbackUsed = 'any'
        console.warn(
          `[aiInvocation.audit] using project-any fallback anchor for action=${action} userId=${userId} (R-8 / AP-N5 follow-up)`,
        )
      }
    }
  }
  if (!anchorProjectId) {
    // Genuinely empty database - no projects exist at all. Drop the audit
    // write rather than crash. Cannot happen post-onboarding.
    console.warn(
      `[aiInvocation.audit] dropped audit row - no project anchor available for action=${action} userId=${userId}`,
    )
    return
  }
  await prisma.auditLog
    .create({
      data: {
        projectId: anchorProjectId,
        userId,
        action,
        detailsJson: { ...details, ...(fallbackUsed !== 'none' ? { anchorFallback: fallbackUsed } : {}) },
      },
    })
    .catch(() => {
      // Audit write failure must not block the read response.
    })
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
      await writeAccessAudit(req.userId, 'admin:ai-invocations-read-denied', {
        projectId: projectId ?? null,
        tier: tier ?? null,
        page,
        pageSize,
        reason: 'project-not-in-tenant',
      })
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
    await writeAccessAudit(req.userId, 'admin:ai-invocations-read', {
      projectId: projectId ?? null,
      tier: tier ?? null,
      page,
      pageSize,
      total,
    })
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
      await writeAccessAudit(req.userId, 'admin:ai-invocations-export-denied', {
        projectId: projectId ?? null,
        reason: 'project-not-in-tenant',
      })
      return res.status(403).json({ success: false, error: 'Project not in your tenant' })
    }
    const where = scope.where

    await writeAccessAudit(req.userId, 'admin:ai-invocations-export', {
      projectId: projectId ?? null,
    })

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

/**
 * Company-scoped read of the AI invocation ledger. Admits any admin
 * tier (per route-level `requireAdmin`) but forces the where-clause to
 * the caller's company by joining `AiInvocation.projectId ->
 * Project.companyName`. A caller with no `company` set on their User
 * row is rejected with 400 - the surface is only meaningful for
 * COMPANY_ADMIN whose company is known.
 */
export async function listForCompany(req: AuthRequest, res: Response) {
  try {
    if (!req.userId) return res.status(401).json({ success: false, error: 'Unauthorized' })
    const tier = (req.query.tier as string) || undefined
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10) || 1)
    const pageSize = Math.min(
      MAX_PAGE,
      Math.max(1, parseInt((req.query.pageSize as string) ?? '50', 10) || 50),
    )

    const caller = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { company: true },
    })
    const company = caller?.company ?? null
    if (!company) {
      await writeAccessAudit(req.userId, 'admin:ai-invocations-company-read-denied', {
        tier: tier ?? null,
        reason: 'caller-has-no-company',
      })
      return res
        .status(400)
        .json({ success: false, error: 'Caller has no company; cannot scope by tenant' })
    }

    const allowed = await prisma.project.findMany({
      where: { companyName: company },
      select: { id: true },
    })
    const allowedIds = allowed.map((p) => p.id)

    const where: Record<string, unknown> = { projectId: { in: allowedIds } }
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
    await writeAccessAudit(req.userId, 'admin:ai-invocations-company-read', {
      company,
      tier: tier ?? null,
      page,
      pageSize,
      total,
    })
    res.json({ success: true, data, total, page, pageSize })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
