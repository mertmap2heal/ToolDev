import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth.middleware'

/**
 * Allows the request through only when the authenticated user is:
 *   - the legacy Project.userId owner, OR
 *   - a ProjectMember with role === 'owner' for this project, OR
 *   - a platform admin (User.role === 'SUPERIOR_ADMIN' | 'COMPANY_ADMIN',
 *     or email listed in ADMIN_EMAILS, or the first-ever user when that
 *     env var is not set, matching the existing requireAdmin semantics).
 *
 * Must be placed after authenticateToken and after the project param
 * resolver (so req.params.id / req.params.projectId is a UUID).
 *
 * Returns 401 when no user, 404 when project not found, 403 otherwise.
 */
export async function requireProjectOwnerOrAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.userId ?? req.user?.userId
    const projectId = req.params.projectId ?? req.params.id

    if (!userId || !projectId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }

    const [project, user] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true },
      }),
    ])

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' })
      return
    }

    if (project.userId === userId) {
      next()
      return
    }

    if (user?.role === 'SUPERIOR_ADMIN' || user?.role === 'COMPANY_ADMIN') {
      next()
      return
    }

    if (user?.email && (await isEnvAdmin(user.email))) {
      next()
      return
    }

    const ownerMember = await prisma.projectMember.findFirst({
      where: { projectId, userId, role: 'owner' },
      select: { id: true },
    })
    if (ownerMember) {
      next()
      return
    }

    res.status(403).json({
      success: false,
      error: 'Only the project owner or an administrator can perform this action',
    })
  } catch (err) {
    console.error('requireProjectOwnerOrAdmin error:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

async function isEnvAdmin(email: string): Promise<boolean> {
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
