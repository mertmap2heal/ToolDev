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
