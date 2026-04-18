import { Response } from 'express'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth.middleware'
import {
  queryProjectAuditLogEntries,
  querySavedViewAuditEntries,
} from '../utils/unifiedAuditLogQueries'


const DEFAULT_COMPANY_KEY = '__default__'

const DEFAULT_ROLES = [
  {
    name: 'Viewer',
    defaultPermissions: {
      requirements: { view: true },
      verification: { view: true },
      documentation: { view: true },
      riskManagement: { view: true },
      changeRequests: { view: true },
      configurationManagement: { view: true },
    },
  },
  {
    name: 'Editor',
    defaultPermissions: {
      requirements: { view: true, create: true, edit: true, export: true },
      verification: { view: true, create: true, edit: true, export: true },
      documentation: { view: true, create: true, edit: true, export: true },
      riskManagement: { view: true, create: true, edit: true, export: true },
      changeRequests: { view: true, create: true, edit: true },
      configurationManagement: { view: true, create: true, compare: true, export: true },
    },
  },
  {
    name: 'Admin',
    defaultPermissions: {
      requirements: { view: true, create: true, edit: true, delete: true, export: true },
      verification: { view: true, create: true, edit: true, execute: true, approve: true, export: true },
      documentation: { view: true, create: true, edit: true, import: true, export: true, manageTemplates: true },
      riskManagement: { view: true, create: true, edit: true, mitigate: true, approve: true, export: true },
      changeRequests: { view: true, create: true, edit: true, approve: true, close: true },
      configurationManagement: { view: true, create: true, baseline: true, compare: true, export: true },
      admin: { manageUsers: true, manageRoles: true, manageProjects: true, auditLog: true },
    },
  },
]

/** GET /admin/roles - list all admin roles */
export const getRoles = async (_req: AuthRequest, res: Response) => {
  try {
    let roles = await prisma.adminRole.findMany({
      where: { companyKey: DEFAULT_COMPANY_KEY },
      orderBy: { name: 'asc' },
    })
    if (roles.length === 0) {
      for (const r of DEFAULT_ROLES) {
        await prisma.adminRole.create({
          data: {
            companyKey: DEFAULT_COMPANY_KEY,
            name: r.name,
            defaultPermissions: r.defaultPermissions as object,
          },
        })
      }
      roles = await prisma.adminRole.findMany({
        where: { companyKey: DEFAULT_COMPANY_KEY },
        orderBy: { name: 'asc' },
      })
    }
    const data = roles.map((r) => ({
      id: r.id,
      name: r.name,
      defaultPermissions: r.defaultPermissions as Record<string, unknown>,
    }))
    res.json({ success: true, data })
  } catch (error) {
    console.error('Admin get roles error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** POST /admin/roles - create role. Body: { name, defaultPermissions } */
export const createRole = async (req: AuthRequest, res: Response) => {
  try {
    const { name, defaultPermissions } = req.body
    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, error: 'Name is required' })
      return
    }
    const trimmed = name.trim()
    if (!trimmed) {
      res.status(400).json({ success: false, error: 'Name is required' })
      return
    }
    const permissions = defaultPermissions && typeof defaultPermissions === 'object'
      ? defaultPermissions
      : {}

    const existing = await prisma.adminRole.findUnique({
      where: {
        companyKey_name: { companyKey: DEFAULT_COMPANY_KEY, name: trimmed },
      },
    })
    if (existing) {
      res.status(400).json({ success: false, error: `Role "${trimmed}" already exists` })
      return
    }

    const role = await prisma.adminRole.create({
      data: {
        companyKey: DEFAULT_COMPANY_KEY,
        name: trimmed,
        defaultPermissions: permissions,
      },
    })
    res.status(201).json({
      success: true,
      data: {
        id: role.id,
        name: role.name,
        defaultPermissions: role.defaultPermissions as Record<string, unknown>,
      },
    })
  } catch (error) {
    console.error('Admin create role error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** PUT /admin/roles/:id - update role. Body: { name?, defaultPermissions? } */
export const updateRole = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { name, defaultPermissions } = req.body

    const role = await prisma.adminRole.findUnique({
      where: { id },
    })
    if (!role) {
      res.status(404).json({ success: false, error: 'Role not found' })
      return
    }

    const data: { name?: string; defaultPermissions?: object } = {}
    if (name !== undefined && typeof name === 'string') {
      const trimmed = name.trim()
      if (!trimmed) {
        res.status(400).json({ success: false, error: 'Name cannot be empty' })
        return
      }
      if (trimmed !== role.name) {
        const existing = await prisma.adminRole.findUnique({
          where: {
            companyKey_name: { companyKey: DEFAULT_COMPANY_KEY, name: trimmed },
          },
        })
        if (existing) {
          res.status(400).json({ success: false, error: `Role "${trimmed}" already exists` })
          return
        }
        data.name = trimmed
      }
    }
    if (defaultPermissions !== undefined && typeof defaultPermissions === 'object') {
      data.defaultPermissions = defaultPermissions
    }

    const updated = await prisma.adminRole.update({
      where: { id },
      data,
    })
    res.json({
      success: true,
      data: {
        id: updated.id,
        name: updated.name,
        defaultPermissions: updated.defaultPermissions as Record<string, unknown>,
      },
    })
  } catch (error) {
    console.error('Admin update role error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** Unified audit log entry shape for admin */
interface AuditEntry {
  id: string
  timestamp: string
  actor: string
  action: string
  target: string
  summary: string
  source?: string
}

/** GET /admin/audit-log - unified audit log. Query: limit?, from?, to?, actor?, action?, target? */
export const getAuditLog = async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Math.max(parseInt(String(req.query.limit || 50), 10) || 50, 1), 200)
    const from = req.query.from as string | undefined
    const to = req.query.to as string | undefined
    const actorFilter = (req.query.actor as string)?.trim().toLowerCase()
    const actionFilter = (req.query.action as string)?.trim().toLowerCase()
    const targetFilter = (req.query.target as string)?.trim().toLowerCase()

    const fromDate = from ? new Date(from) : null
    const toDate = to ? new Date(to) : null

    const entries: AuditEntry[] = []

    // VerAuditEvent
    const verWhere: { performedAt?: { gte?: Date; lte?: Date } } = {}
    if (fromDate) verWhere.performedAt = { ...verWhere.performedAt, gte: fromDate }
    if (toDate) verWhere.performedAt = { ...verWhere.performedAt, lte: toDate }

    const verEvents = await prisma.verAuditEvent.findMany({
      where: Object.keys(verWhere).length > 0 ? verWhere : undefined,
      orderBy: { performedAt: 'desc' },
      take: limit,
    })
    const userIds = [...new Set(verEvents.map((e) => e.performedByUserId).filter(Boolean))] as string[]
    const users = userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.name || u.email]))
    for (const e of verEvents) {
      const actor = e.performedByUserId ? (userMap[e.performedByUserId] ?? e.performedByUserId) : 'system'
      const target = `${e.entityType}:${e.entityId}`
      const summary = `${e.action} on ${e.entityType}`
      if (actorFilter && !actor.toLowerCase().includes(actorFilter)) continue
      if (actionFilter && !e.action.toLowerCase().includes(actionFilter)) continue
      if (targetFilter && !target.toLowerCase().includes(targetFilter)) continue
      entries.push({
        id: `ver-${e.id}`,
        timestamp: e.performedAt.toISOString(),
        actor,
        action: e.action,
        target,
        summary,
        source: 'verification',
      })
    }

    // TaskAuditLog
    const taskWhere: { occurredAt?: { gte?: Date; lte?: Date } } = {}
    if (fromDate) taskWhere.occurredAt = { ...taskWhere.occurredAt, gte: fromDate }
    if (toDate) taskWhere.occurredAt = { ...taskWhere.occurredAt, lte: toDate }
    const taskEvents = await prisma.taskAuditLog.findMany({
      where: Object.keys(taskWhere).length > 0 ? taskWhere : undefined,
      orderBy: { occurredAt: 'desc' },
      take: limit,
    })
    for (const e of taskEvents) {
      const actor = e.userName ?? e.userId ?? 'system'
      const target = `${e.entityType}:${e.entityId}`
      const summary = `${e.action} on ${e.entityType}`
      if (actorFilter && !actor.toLowerCase().includes(actorFilter)) continue
      if (actionFilter && !e.action.toLowerCase().includes(actionFilter)) continue
      if (targetFilter && !target.toLowerCase().includes(targetFilter)) continue
      entries.push({
        id: `task-${e.id}`,
        timestamp: e.occurredAt.toISOString(),
        actor,
        action: e.action,
        target,
        summary,
        source: 'tasks',
      })
    }

    // InventoryAuditLog
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
      entries.push({
        id: `inv-${e.id}`,
        timestamp: e.occurredAt.toISOString(),
        actor,
        action: e.action,
        target,
        summary,
        source: 'inventory',
      })
    }

    const auditFilters = {
      limit,
      fromDate,
      toDate,
      actorFilter,
      actionFilter,
      targetFilter,
    }
    const projectEntries = await queryProjectAuditLogEntries(auditFilters)
    const savedViewEntries = await querySavedViewAuditEntries(auditFilters)
    entries.push(...projectEntries, ...savedViewEntries)

    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    const data = entries.slice(0, limit)

    res.json({ success: true, data })
  } catch (error) {
    console.error('Admin audit log error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
