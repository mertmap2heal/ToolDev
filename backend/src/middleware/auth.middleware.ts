import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AuthRequest extends Request {
  userId?: string
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1]

  if (!token) {
    return res.status(401).json({ success: false, error: 'No token provided' })
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return res.status(500).json({ success: false, error: 'Server configuration error' })
  }

  jwt.verify(token, secret, (err, decoded) => {
    if (err) {
      return res.status(403).json({ success: false, error: 'Invalid token' })
    }

    if (decoded && typeof decoded === 'object' && 'userId' in decoded) {
      req.userId = decoded.userId as string
    }
    next()
  })
}

/** Requires authenticated user with role SUPERIOR_ADMIN. Use after authenticateToken. */
export const requireSuperiorAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  if (!user || user.role !== 'SUPERIOR_ADMIN') {
    return res.status(403).json({ success: false, error: 'Platform admin access required' })
  }
  next()
}

/** Requires admin (SUPERIOR_ADMIN, COMPANY_ADMIN, ADMIN_EMAILS, or first user). Use after authenticateToken. */
export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.userId
  if (!userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' })
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  })
  if (!user) {
    return res.status(401).json({ success: false, error: 'User not found' })
  }
  const isAdmin =
    user.role === 'SUPERIOR_ADMIN' ||
    user.role === 'COMPANY_ADMIN' ||
    (await resolveIsAdmin(user.email))
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Admin access required' })
  }
  next()
}

async function resolveIsAdmin(email: string | null): Promise<boolean> {
  if (!email) return false
  const list = process.env.ADMIN_EMAILS
  if (list) {
    const emails = list.split(',').map((e) => e.trim().toLowerCase())
    return emails.includes(email.toLowerCase())
  }
  const first = await prisma.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { email: true },
  })
  return first?.email?.toLowerCase() === email.toLowerCase()
}
