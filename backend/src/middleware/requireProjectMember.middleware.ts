import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth.middleware'

/**
 * Ensures the authenticated user is a member of the project identified by
 * req.params.projectId (or req.params.id for /projects/:id routes).  Must be
 * placed after authenticateToken and after the project param resolver (so the
 * param is already a UUID).
 *
 * Returns 403 when the user has no ProjectMember record for the project and
 * is not the legacy Project.userId owner.
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

    const member = await prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: { id: true },
    })

    if (member) {
      next()
      return
    }

    // Legacy fallback: Project.userId is the original owner and may predate
    // any ProjectMember row. Treat that user as a project member.
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    })
    if (project?.userId === userId) {
      next()
      return
    }

    res.status(403).json({ success: false, error: 'Access denied: not a member of this project' })
  } catch (err) {
    console.error('requireProjectMember error:', err)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
