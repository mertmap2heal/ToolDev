import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { authenticateToken, requireSuperiorAdmin, type AuthRequest } from '../middleware/auth.middleware'
import { checkCompanyUserLimit } from '../controllers/auth.controller'
import {
  queryProjectAuditLogPlatformEntries,
  querySavedViewAuditPlatformEntries,
} from '../utils/unifiedAuditLogQueries'

const router = Router()

/** All routes require auth + SUPERIOR_ADMIN */
router.use(authenticateToken)
router.use((req, res, next) => {
  requireSuperiorAdmin(req as AuthRequest, res, next).catch(next)
})

const UNNAMED_KEY = '__null__'

function toCompanyKey(value: string | null): string {
  if (value == null || value === '') return UNNAMED_KEY
  return value
}

function fromCompanyKey(key: string): string | null {
  if (key === UNNAMED_KEY) return null
  return key
}

/** GET /platform-admin/stats - platform overview stats for dashboard */
router.get('/stats', async (_req: AuthRequest, res: Response) => {
  try {
    const [totalUsers, totalProjects, companyCount, limits, recentAuditRaw] =
      await Promise.all([
        prisma.user.count({
          where: { OR: [{ role: null }, { role: { not: 'SUPERIOR_ADMIN' } }] },
        }),
        prisma.project.count(),
        prisma.user.findMany({ select: { company: true } }).then((rows) => {
          const keys = new Set(rows.map((r) => toCompanyKey(r.company)))
          return keys.size
        }),
        prisma.companyLimit.findMany({ select: { companyKey: true, maxUsers: true } }),
        prisma.verAuditEvent.findMany({
          orderBy: { performedAt: 'desc' },
          take: 5,
          include: { project: { select: { companyName: true } } },
        }),
      ])

    const limitByKey = new Map(limits.map((l) => [l.companyKey, l.maxUsers]))

    let companiesAtLimit = 0
    const userRows = await prisma.user.findMany({ select: { company: true } })
    const companyKeys = new Set<string>()
    for (const r of userRows) companyKeys.add(toCompanyKey(r.company))
    for (const key of companyKeys) {
      const maxUsers = limitByKey.get(key)
      if (maxUsers == null) continue
      const rawKey = fromCompanyKey(key)
      const current = await prisma.user.count({
        where: {
          ...(rawKey == null
            ? { OR: [{ company: null }, { company: '' }] }
            : { company: rawKey }),
          OR: [{ role: null }, { role: { not: 'SUPERIOR_ADMIN' } }],
        },
      })
      if (current >= maxUsers) companiesAtLimit++
    }

    const recentEvents = recentAuditRaw.map((e) => ({
      id: `ver-${e.id}`,
      timestamp: e.performedAt.toISOString(),
      action: e.action,
      entityType: e.entityType,
      companyName: e.project?.companyName ?? null,
    }))

    res.json({
      success: true,
      data: {
        totalUsers,
        totalProjects,
        totalCompanies: companyCount,
        companiesAtLimit,
        recentEvents,
      },
    })
  } catch (error) {
    console.error('Platform admin stats error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /platform-admin/users - create user (superior admin). Body: { email, name, password, company?, makeCompanyAdmin? } */
router.post('/users', async (req: AuthRequest, res: Response) => {
  try {
    const { email, name, password, company, makeCompanyAdmin } = req.body
    if (!email || typeof email !== 'string') {
      return res.status(400).json({ success: false, error: 'Email is required' })
    }
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail.includes('@')) {
      return res.status(400).json({ success: false, error: 'Invalid email format' })
    }
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ success: false, error: 'Name is required' })
    }
    const displayName = (name.trim() || trimmedEmail.split('@')[0]) || 'User'
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ success: false, error: 'Password is required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' })
    }
    const limitError = await checkCompanyUserLimit(company)
    if (limitError) {
      return res.status(403).json({ success: false, error: limitError })
    }
    const existingUser = await prisma.user.findUnique({ where: { email: trimmedEmail } })
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' })
    }
    const hashedPassword = await bcrypt.hash(password, 10)
    const role = makeCompanyAdmin === true ? 'COMPANY_ADMIN' : null
    const rawCompany = company != null ? String(company).trim() : ''
    const companyValue = rawCompany === '' || rawCompany === UNNAMED_KEY ? null : rawCompany
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail,
        password: hashedPassword,
        name: displayName,
        company: companyValue,
        role,
        mustChangePasswordOnFirstLogin: true,
      },
      select: { id: true, email: true, name: true, company: true },
    })
    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          company: user.company,
        },
        message: 'User created',
      },
    })
  } catch (error) {
    console.error('Platform admin create user error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** POST /platform-admin/companies - create a company (provision tenant). Body: { companyKey, displayName?, maxUsers? } */
router.post('/companies', async (req: AuthRequest, res: Response) => {
  try {
    const { companyKey, displayName, maxUsers } = req.body
    if (!companyKey || typeof companyKey !== 'string') {
      return res.status(400).json({ success: false, error: 'companyKey is required' })
    }
    const key = String(companyKey).trim()
    if (!key) {
      return res.status(400).json({ success: false, error: 'companyKey cannot be empty' })
    }
    if (key === UNNAMED_KEY) {
      return res.status(400).json({ success: false, error: 'Invalid companyKey' })
    }
    const slug = key.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    if (!slug) {
      return res.status(400).json({ success: false, error: 'companyKey must contain alphanumeric characters' })
    }
    const displayNameStr =
      displayName != null && displayName !== '' ? String(displayName).trim() : key
    const maxUsersVal =
      maxUsers == null
        ? null
        : typeof maxUsers === 'number'
          ? maxUsers
          : parseInt(String(maxUsers), 10)
    if (maxUsersVal !== null && (Number.isNaN(maxUsersVal) || maxUsersVal < 0)) {
      return res.status(400).json({ success: false, error: 'maxUsers must be a non-negative number or null' })
    }

    const existingOrg = await prisma.organization.findUnique({
      where: { companyKey: key },
    })
    if (existingOrg) {
      return res.status(400).json({ success: false, error: 'Company already exists' })
    }

    await prisma.$transaction([
      prisma.organization.create({
        data: {
          companyKey: key,
          name: key,
          displayName: displayNameStr,
        },
      }),
      ...(maxUsersVal !== null
        ? [
            prisma.companyLimit.upsert({
              where: { companyKey: key },
              update: { maxUsers: maxUsersVal },
              create: { companyKey: key, maxUsers: maxUsersVal },
            }),
          ]
        : []),
    ])

    res.status(201).json({
      success: true,
      data: {
        companyKey: key,
        displayName: displayNameStr,
        maxUsers: maxUsersVal,
      },
    })
  } catch (error) {
    console.error('Platform admin create company error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** GET /platform-admin/companies - companies (including unnamed) with users and project count */
router.get('/companies', async (_req: AuthRequest, res: Response) => {
  try {
    const [userRows, projectRows] = await Promise.all([
      prisma.user.findMany({ select: { company: true } }),
      prisma.project.findMany({ select: { companyName: true } }),
    ])
    const companyKeys = new Set<string>()
    for (const r of userRows) {
      companyKeys.add(toCompanyKey(r.company))
    }
    for (const r of projectRows) {
      companyKeys.add(toCompanyKey(r.companyName))
    }

    const keys = Array.from(companyKeys).sort((a, b) => {
      if (a === UNNAMED_KEY) return -1
      if (b === UNNAMED_KEY) return 1
      return a.localeCompare(b)
    })

    const data: { key: string | null; displayName: string; users: { id: string; email: string; name: string }[]; projectCount: number }[] = []

    for (const key of keys) {
      const rawKey = fromCompanyKey(key)
      const displayName = rawKey == null ? '(No name)' : rawKey

      const [users, projectCount] = await Promise.all([
        prisma.user.findMany({
          where: {
            ...(rawKey == null
              ? { OR: [{ company: null }, { company: '' }] }
              : { company: rawKey }),
            OR: [
              { role: null },
              { role: { not: 'SUPERIOR_ADMIN' } },
            ],
          },
          select: { id: true, email: true, name: true },
        }),
        prisma.project.count({
          where: rawKey == null
            ? { OR: [{ companyName: null }, { companyName: '' }] }
            : { companyName: rawKey },
        }),
      ])

      data.push({
        key: rawKey,
        displayName,
        users: users.map((u) => ({ id: u.id, email: u.email, name: u.name })),
        projectCount,
      })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Platform admin companies error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** GET /platform-admin/limits - companies with current user count and max user limit */
router.get('/limits', async (_req: AuthRequest, res: Response) => {
  try {
    const [userRows, projectRows, limits] = await Promise.all([
      prisma.user.findMany({ select: { company: true } }),
      prisma.project.findMany({ select: { companyName: true } }),
      prisma.companyLimit.findMany({ select: { companyKey: true, maxUsers: true } }),
    ])
    const companyKeys = new Set<string>()
    for (const r of userRows) companyKeys.add(toCompanyKey(r.company))
    for (const r of projectRows) companyKeys.add(toCompanyKey(r.companyName))
    const limitByKey = new Map(limits.map((l) => [l.companyKey, l.maxUsers]))

    const keys = Array.from(companyKeys).sort((a, b) => {
      if (a === UNNAMED_KEY) return -1
      if (b === UNNAMED_KEY) return 1
      return a.localeCompare(b)
    })

    const data: { companyKey: string; displayName: string; currentUserCount: number; maxUsers: number | null }[] = []

    for (const key of keys) {
      const rawKey = fromCompanyKey(key)
      const displayName = rawKey == null ? '(No name)' : rawKey
      const currentUserCount = await prisma.user.count({
        where: {
          ...(rawKey == null
            ? { OR: [{ company: null }, { company: '' }] }
            : { company: rawKey }),
          OR: [{ role: null }, { role: { not: 'SUPERIOR_ADMIN' } }],
        },
      })
      data.push({
        companyKey: key,
        displayName,
        currentUserCount,
        maxUsers: limitByKey.get(key) ?? null,
      })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Platform admin limits error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** PUT /platform-admin/limits - set max user limit for a company. Body: { companyKey: string, maxUsers: number | null } */
router.put('/limits', async (req: AuthRequest, res: Response) => {
  try {
    const { companyKey, maxUsers } = req.body
    if (companyKey === undefined || companyKey === null) {
      return res.status(400).json({ success: false, error: 'companyKey is required' })
    }
    const key = String(companyKey).trim() || UNNAMED_KEY
    const value = maxUsers == null ? null : typeof maxUsers === 'number' ? maxUsers : parseInt(String(maxUsers), 10)
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      return res.status(400).json({ success: false, error: 'maxUsers must be a non-negative number or null' })
    }

    await prisma.companyLimit.upsert({
      where: { companyKey: key },
      update: { maxUsers: value },
      create: { companyKey: key, maxUsers: value },
    })
    res.json({ success: true, data: { companyKey: key, maxUsers: value } })
  } catch (error) {
    console.error('Platform admin set limit error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** GET /platform-admin/organizations - list organizations (with profile and stats) */
router.get('/organizations', async (_req: AuthRequest, res: Response) => {
  try {
    const [userRows, projectRows, orgRows, limits] = await Promise.all([
      prisma.user.findMany({ select: { company: true } }),
      prisma.project.findMany({ select: { companyName: true } }),
      prisma.organization.findMany({ select: { companyKey: true, name: true, displayName: true, description: true, contactEmail: true } }),
      prisma.companyLimit.findMany({ select: { companyKey: true, maxUsers: true } }),
    ])
    const companyKeys = new Set<string>()
    for (const r of userRows) companyKeys.add(toCompanyKey(r.company))
    for (const r of projectRows) companyKeys.add(toCompanyKey(r.companyName))
    for (const o of orgRows) companyKeys.add(o.companyKey)
    const limitByKey = new Map(limits.map((l) => [l.companyKey, l.maxUsers]))
    const orgByKey = new Map(orgRows.map((o) => [o.companyKey, o]))

    const keys = Array.from(companyKeys).sort((a, b) => {
      if (a === UNNAMED_KEY) return -1
      if (b === UNNAMED_KEY) return 1
      return a.localeCompare(b)
    })

    const data: {
      companyKey: string
      name: string
      displayName: string | null
      description: string | null
      contactEmail: string | null
      userCount: number
      projectCount: number
      maxUsers: number | null
    }[] = []

    for (const key of keys) {
      const rawKey = fromCompanyKey(key)
      const org = orgByKey.get(key)
      const defaultDisplayName = rawKey == null ? '(No name)' : rawKey
      const [userCount, projectCount] = await Promise.all([
        prisma.user.count({
          where: {
            ...(rawKey == null
              ? { OR: [{ company: null }, { company: '' }] }
              : { company: rawKey }),
            OR: [{ role: null }, { role: { not: 'SUPERIOR_ADMIN' } }],
          },
        }),
        prisma.project.count({
          where: rawKey == null
            ? { OR: [{ companyName: null }, { companyName: '' }] }
            : { companyName: rawKey },
        }),
      ])
      data.push({
        companyKey: key,
        name: org?.name ?? rawKey ?? defaultDisplayName,
        displayName: org?.displayName ?? defaultDisplayName,
        description: org?.description ?? null,
        contactEmail: org?.contactEmail ?? null,
        userCount,
        projectCount,
        maxUsers: limitByKey.get(key) ?? null,
      })
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('Platform admin organizations error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** PUT /platform-admin/organizations/:companyKey - upsert organization profile */
router.put('/organizations/:companyKey', async (req: AuthRequest, res: Response) => {
  try {
    const companyKeyParam = req.params.companyKey
    const companyKey = companyKeyParam === '' || companyKeyParam === 'null' ? UNNAMED_KEY : decodeURIComponent(companyKeyParam)
    const { name, displayName, description, contactEmail } = req.body
    const nameStr = name != null ? String(name).trim() : (companyKey === UNNAMED_KEY ? '(No name)' : companyKey)
    const displayNameStr = displayName != null && displayName !== '' ? String(displayName).trim() : null
    const descriptionStr = description != null && description !== '' ? String(description).trim() : null
    const contactEmailStr = contactEmail != null && contactEmail !== '' ? String(contactEmail).trim() : null

    const org = await prisma.organization.upsert({
      where: { companyKey },
      update: {
        name: nameStr,
        displayName: displayNameStr,
        description: descriptionStr,
        contactEmail: contactEmailStr,
      },
      create: {
        companyKey,
        name: nameStr,
        displayName: displayNameStr,
        description: descriptionStr,
        contactEmail: contactEmailStr,
      },
      select: { companyKey: true, name: true, displayName: true, description: true, contactEmail: true },
    })
    res.json({ success: true, data: org })
  } catch (error) {
    console.error('Platform admin update organization error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

/** Global audit log entry shape */
interface PlatformAuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  summary: string
  source: string
  companyKey: string | null
  companyName: string | null
}

/** GET /platform-admin/audit-logs - global audit logs. Query: limit?, from?, to?, actor?, action?, target?, company? */
router.get('/audit-logs', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 50), 10) || 50, 1), 200)
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const actorFilter = (req.query.actor as string)?.trim().toLowerCase()
    const actionFilter = (req.query.action as string)?.trim().toLowerCase()
    const targetFilter = (req.query.target as string)?.trim().toLowerCase()
    const companyFilter = (req.query.company as string)?.trim().toLowerCase()

    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null
    const entries: PlatformAuditEntry[] = []

    // VerAuditEvent - has project relation for company
    const verWhere: { performedAt?: { gte?: Date; lte?: Date } } = {}
    if (fromDate) verWhere.performedAt = { ...verWhere.performedAt, gte: fromDate }
    if (toDate) verWhere.performedAt = { ...verWhere.performedAt, lte: toDate }

    const verEvents = await prisma.verAuditEvent.findMany({
      where: Object.keys(verWhere).length > 0 ? verWhere : undefined,
      orderBy: { performedAt: 'desc' },
      take: limit,
      include: { project: { select: { companyName: true } } },
    })
    const verUserIds = [...new Set(verEvents.map((e) => e.performedByUserId).filter(Boolean))] as string[]
    const verUsers =
      verUserIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: verUserIds } },
            select: { id: true, name: true, email: true },
          })
        : []
    const verUserMap = Object.fromEntries(verUsers.map((u) => [u.id, u.name || u.email]))
    for (const e of verEvents) {
      const actor = e.performedByUserId ? (verUserMap[e.performedByUserId] ?? e.performedByUserId) : 'system'
      const target = `${e.entityType}:${e.entityId}`
      const summary = `${e.action} on ${e.entityType}`
      const companyName = e.project?.companyName ?? null
      const companyKey = companyName ? toCompanyKey(companyName) : UNNAMED_KEY
      if (actorFilter && !actor.toLowerCase().includes(actorFilter)) continue
      if (actionFilter && !e.action.toLowerCase().includes(actionFilter)) continue
      if (targetFilter && !target.toLowerCase().includes(targetFilter)) continue
      let companyMatches = true
      if (companyFilter) {
        if (companyFilter === '(no name)' || companyFilter === '__null__') {
          companyMatches = !companyName || companyName === ''
        } else {
          companyMatches = !!(companyName && companyName.toLowerCase().includes(companyFilter))
        }
      }
      if (!companyMatches) continue
      entries.push({
        id: `ver-${e.id}`,
        timestamp: e.performedAt.toISOString(),
        actor,
        action: e.action,
        target,
        summary,
        source: 'verification',
        companyKey: companyKey === UNNAMED_KEY ? null : fromCompanyKey(companyKey),
        companyName,
      })
    }

    // TaskAuditLog - lookup company via Task.project
    const taskWhere: { occurredAt?: { gte?: Date; lte?: Date } } = {}
    if (fromDate) taskWhere.occurredAt = { ...taskWhere.occurredAt, gte: fromDate }
    if (toDate) taskWhere.occurredAt = { ...taskWhere.occurredAt, lte: toDate }
    const taskEvents = await prisma.taskAuditLog.findMany({
      where: Object.keys(taskWhere).length > 0 ? taskWhere : undefined,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
    const taskIds = taskEvents.filter((e) => e.entityType === 'TASK').map((e) => e.entityId)
    const taskToCompany = new Map<string, string | null>()
    if (taskIds.length > 0) {
      const tasks = await prisma.task.findMany({
        where: { id: { in: taskIds } },
        include: { project: { select: { companyName: true } } },
      })
      for (const t of tasks) {
        taskToCompany.set(t.id, t.project?.companyName ?? null)
      }
    }
    for (const e of taskEvents) {
      const actor = e.userName ?? e.userId ?? 'system'
      const target = `${e.entityType}:${e.entityId}`
      const summary = `${e.action} on ${e.entityType}`
      const companyName = e.entityType === 'TASK' ? taskToCompany.get(e.entityId) ?? null : null
      if (actorFilter && !actor.toLowerCase().includes(actorFilter)) continue
      if (actionFilter && !e.action.toLowerCase().includes(actionFilter)) continue
      if (targetFilter && !target.toLowerCase().includes(targetFilter)) continue
      let taskCompanyMatches = true
      if (companyFilter) {
        if (companyFilter === '(no name)' || companyFilter === '__null__') {
          taskCompanyMatches = !companyName || companyName === ''
        } else {
          taskCompanyMatches = !!(companyName && companyName.toLowerCase().includes(companyFilter))
        }
      }
      if (!taskCompanyMatches) continue
      entries.push({
        id: `task-${e.id}`,
        timestamp: e.occurredAt.toISOString(),
        actor,
        action: e.action,
        target,
        summary,
        source: 'tasks',
        companyKey: companyName ? fromCompanyKey(toCompanyKey(companyName)) : null,
        companyName,
      })
    }

    // InventoryAuditLog - no direct company; use null
    const invWhere: { occurredAt?: { gte?: Date; lte?: Date } } = {}
    if (fromDate) invWhere.occurredAt = { ...invWhere.occurredAt, gte: fromDate }
    if (toDate) invWhere.occurredAt = { ...invWhere.occurredAt, lte: toDate }
    const invEvents = await prisma.inventoryAuditLog.findMany({
      where: Object.keys(invWhere).length > 0 ? invWhere : undefined,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
    for (const e of invEvents) {
      const actor = e.userName ?? e.userId ?? 'system'
      const target = `${e.entityType}:${e.entityId}`
      const summary = `${e.action} on ${e.entityType}`
      if (actorFilter && !actor.toLowerCase().includes(actorFilter)) continue
      if (actionFilter && !e.action.toLowerCase().includes(actionFilter)) continue
      if (targetFilter && !target.toLowerCase().includes(targetFilter)) continue
      if (companyFilter) continue // inventory has no company context
      entries.push({
        id: `inv-${e.id}`,
        timestamp: e.occurredAt.toISOString(),
        actor,
        action: e.action,
        target,
        summary,
        source: 'inventory',
        companyKey: null,
        companyName: null,
      })
    }

    const platformAuditFilters = {
      limit,
      fromDate,
      toDate,
      actorFilter,
      actionFilter,
      targetFilter,
      companyFilter,
    }
    const projectAuditEntries = await queryProjectAuditLogPlatformEntries(platformAuditFilters)
    for (const e of projectAuditEntries) {
      entries.push(e)
    }
    const savedViewPlatformEntries = await querySavedViewAuditPlatformEntries(platformAuditFilters)
    for (const e of savedViewPlatformEntries) {
      entries.push(e)
    }

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    const data = entries.slice(0, limit)

    res.json({ success: true, data })
  } catch (error) {
    console.error('Platform admin audit logs error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
