import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth.middleware'

/**
 * Ensures the authenticated user is allowed to access the project identified
 * by req.params.projectId (or req.params.id for /projects/:id routes).
 *
 * Access granted when any of the following hold (matches the rule used by
 * resolveProjectParam.middleware.ts and requireProjectOwnerOrAdmin):
 *   - ProjectMember row with status=accepted
 *   - legacy Project.userId owner
 *   - platform admin (role SUPERIOR_ADMIN | COMPANY_ADMIN, email in
 *     ADMIN_EMAILS, or first-user fallback)
 *
 * Must be placed after authenticateToken and after the project param
 * resolver (so the param is already a UUID).
 */
export async function requireProjectMember(
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

    // Only accept "accepted" memberships; pending invites do not grant access.
    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId, status: 'accepted' },
      select: { id: true },
    })
    if (member) {
      next()
      return
    }

    const [project, user] = await Promise.all([
      prisma.project.findUnique({
        where: { id: projectId },
        select: { userId: true, companyName: true },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, role: true, company: true },
      }),
    ])
    if (project?.userId === userId) {
      next()
      return
    }
    // #281: SUPERIOR_ADMIN bypass is platform-wide; COMPANY_ADMIN bypass
    // only applies when the caller's company matches the project's
    // companyName. Previously COMPANY_ADMIN bypassed every project.
    if (user?.role === 'SUPERIOR_ADMIN') {
      next()
      return
    }
    if (
      user?.role === 'COMPANY_ADMIN' &&
      project?.companyName != null &&
      user.company != null &&
      project.companyName === user.company
    ) {
      next()
      return
    }
    if (user?.email && (await isEnvAdmin(user.email))) {
      next()
      return
    }

    res.status(403).json({ success: false, error: 'Access denied: not a member of this project' })
  } catch (err) {
    console.error('requireProjectMember error:', err)
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
