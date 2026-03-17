import { Router, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { authenticateToken, type AuthRequest } from '../middleware/auth.middleware'

const router = Router()
const prisma = new PrismaClient()

const UNNAMED_KEY = '__null__'

function toCompanyKey(value: string | null | undefined): string {
  if (value == null || value === '') return UNNAMED_KEY
  return String(value)
}

function fromCompanyKey(key: string): string | null {
  if (key === UNNAMED_KEY) return null
  return key
}

/** GET /organization/me - current user's organization profile and stats */
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { company: true },
    })
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' })
    }
    const companyKey = toCompanyKey(user.company)
    const rawKey = fromCompanyKey(companyKey)

    const [orgRow, limitRow, userCount, projectCount] = await Promise.all([
      prisma.organization.findUnique({
        where: { companyKey },
        select: { companyKey: true, name: true, displayName: true, description: true, contactEmail: true },
      }),
      prisma.companyLimit.findUnique({
        where: { companyKey },
        select: { maxUsers: true },
      }),
      prisma.user.count({
        where: {
          AND: [
            rawKey == null
              ? { OR: [{ company: null }, { company: '' }] }
              : { company: rawKey },
            { OR: [{ role: null }, { role: { not: 'SUPERIOR_ADMIN' } }] },
          ],
        },
      }),
      prisma.project.count({
        where: rawKey == null
          ? { OR: [{ companyName: null }, { companyName: '' }] }
          : { companyName: rawKey },
      }),
    ])

    const displayName = orgRow?.displayName ?? (rawKey == null ? '(No name)' : rawKey)
    const name = orgRow?.name ?? rawKey ?? ''
    res.json({
      success: true,
      data: {
        organization: {
          companyKey,
          name: orgRow?.name ?? (name || displayName),
          displayName: orgRow?.displayName ?? displayName,
          description: orgRow?.description ?? null,
          contactEmail: orgRow?.contactEmail ?? null,
        },
        userCount,
        projectCount,
        maxUsers: limitRow?.maxUsers ?? null,
      },
    })
  } catch (error) {
    const err = error as Error
    console.error('Organization me error:', err)
    const message = process.env.NODE_ENV === 'production' ? 'Internal server error' : (err.message ?? 'Internal server error')
    res.status(500).json({ success: false, error: message })
  }
})

export default router
