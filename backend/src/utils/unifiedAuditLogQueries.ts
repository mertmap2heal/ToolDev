import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

const UNNAMED_KEY = '__null__'

function toCompanyKey(value: string | null | undefined): string {
  if (value == null || value === '') return UNNAMED_KEY
  return value
}

function fromCompanyKey(key: string): string | null {
  if (key === UNNAMED_KEY) return null
  return key
}

export interface AdminUnifiedAuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  summary: string
  source: string
}

export interface PlatformUnifiedAuditEntry extends AdminUnifiedAuditEntry {
  companyKey: string | null
  companyName: string | null
}

export type UnifiedAuditFilters = {
  limit: number
  fromDate: Date | null
  toDate: Date | null
  actorFilter?: string
  actionFilter?: string
  targetFilter?: string
  companyFilter?: string
}

function compactDetails(details: string | null, maxLen = 220): string {
  if (!details) return ''
  try {
    const o = JSON.parse(details) as unknown
    const s = typeof o === 'object' && o !== null ? JSON.stringify(o) : String(o)
    return s.length > maxLen ? `${s.slice(0, maxLen - 1)}…` : s
  } catch {
    return details.length > maxLen ? `${details.slice(0, maxLen - 1)}…` : details
  }
}

function platformCompanyFields(companyName: string | null | undefined): Pick<PlatformUnifiedAuditEntry, 'companyKey' | 'companyName'> {
  const cn = companyName ?? null
  const ck = toCompanyKey(cn ?? undefined)
  return {
    companyName: cn,
    companyKey: ck === UNNAMED_KEY ? null : fromCompanyKey(ck),
  }
}

/** Project-scoped AuditLog (baseline, quality dismissals, stakeholder roles, etc.) */
export async function queryProjectAuditLogEntries(f: UnifiedAuditFilters): Promise<AdminUnifiedAuditEntry[]> {
  const platformRows = await queryProjectAuditLogPlatformEntries(f)
  return platformRows.map(({ companyKey: _c, companyName: _n, ...rest }) => rest)
}

export async function queryProjectAuditLogPlatformEntries(f: UnifiedAuditFilters): Promise<PlatformUnifiedAuditEntry[]> {
  const { limit, fromDate, toDate, actorFilter, actionFilter, targetFilter, companyFilter } = f
  const dateW: { createdAt?: { gte?: Date; lte?: Date } } = {}
  if (fromDate) dateW.createdAt = { ...dateW.createdAt, gte: fromDate }
  if (toDate) dateW.createdAt = { ...dateW.createdAt, lte: toDate }

  const where: Prisma.AuditLogWhereInput = Object.keys(dateW).length ? dateW : {}

  const rows = await prisma.auditLog.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { name: true, email: true } },
      project: { select: { id: true, name: true, companyName: true } },
    },
  })

  const out: PlatformUnifiedAuditEntry[] = []
  for (const e of rows) {
    const actor = e.user.name || e.user.email || e.userId
    const target = `project:${e.projectId}`
    const detailSuffix = e.details ? ` — ${compactDetails(e.details)}` : ''
    const summary = `${e.action} — ${e.project.name}${detailSuffix}`
    const companyName = e.project.companyName ?? null
    if (companyFilter) {
      const cf = companyFilter.trim()
      if (cf === '(no name)' || cf === '__null__') {
        if (companyName) continue
      } else if (!companyName || !companyName.toLowerCase().includes(cf.toLowerCase())) {
        continue
      }
    }
    if (actorFilter && !actor.toLowerCase().includes(actorFilter)) continue
    if (actionFilter && !e.action.toLowerCase().includes(actionFilter)) continue
    if (targetFilter && !target.toLowerCase().includes(targetFilter)) continue
    out.push({
      id: `proj-${e.id}`,
      timestamp: e.createdAt.toISOString(),
      actor,
      action: e.action,
      target,
      summary,
      source: 'project',
      ...platformCompanyFields(companyName),
    })
  }
  return out
}

export async function querySavedViewAuditEntries(f: UnifiedAuditFilters): Promise<AdminUnifiedAuditEntry[]> {
  const platformRows = await querySavedViewAuditPlatformEntries(f)
  return platformRows.map(({ companyKey: _c, companyName: _n, ...rest }) => rest)
}

export async function querySavedViewAuditPlatformEntries(f: UnifiedAuditFilters): Promise<PlatformUnifiedAuditEntry[]> {
  const { limit, fromDate, toDate, actorFilter, actionFilter, targetFilter, companyFilter } = f
  const dateW: { performedAt?: { gte?: Date; lte?: Date } } = {}
  if (fromDate) dateW.performedAt = { ...dateW.performedAt, gte: fromDate }
  if (toDate) dateW.performedAt = { ...dateW.performedAt, lte: toDate }

  const where: Prisma.SavedViewAuditEventWhereInput = Object.keys(dateW).length ? dateW : {}

  const rows = await prisma.savedViewAuditEvent.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { performedAt: 'desc' },
    take: limit,
    include: {
      project: { select: { id: true, name: true, companyName: true } },
      view: { select: { id: true, name: true } },
    },
  })

  const userIds = [...new Set(rows.map((r) => r.performedByUserId).filter(Boolean))] as string[]
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]))

  const out: PlatformUnifiedAuditEntry[] = []
  for (const e of rows) {
    const actor = e.performedByUserId ? (userMap[e.performedByUserId] ?? e.performedByUserId) : 'system'
    const target = `savedView:${e.viewId}`
    const summary = `${e.action} — ${e.view.name} (${e.project.name})`
    const companyName = e.project.companyName ?? null
    if (companyFilter) {
      const cf = companyFilter.trim()
      if (cf === '(no name)' || cf === '__null__') {
        if (companyName) continue
      } else if (!companyName || !companyName.toLowerCase().includes(cf.toLowerCase())) {
        continue
      }
    }
    if (actorFilter && !actor.toLowerCase().includes(actorFilter)) continue
    if (actionFilter && !e.action.toLowerCase().includes(actionFilter)) continue
    if (targetFilter && !target.toLowerCase().includes(targetFilter)) continue
    out.push({
      id: `sv-${e.id}`,
      timestamp: e.performedAt.toISOString(),
      actor,
      action: e.action,
      target,
      summary,
      source: 'saved_views',
      ...platformCompanyFields(companyName),
    })
  }
  return out
}
