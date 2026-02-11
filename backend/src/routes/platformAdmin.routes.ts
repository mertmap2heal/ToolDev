import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, requireSuperiorAdmin, type AuthRequest } from '../middleware/auth.middleware'

const router = Router()
const prisma = new PrismaClient()

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

/** GET /platform-admin/audit-logs - placeholder for global audit logs */
router.get('/audit-logs', async (_req: AuthRequest, res: Response) => {
  try {
    res.json({ success: true, data: [] })
  } catch (error) {
    console.error('Platform admin audit logs error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
})

export default router
