import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth.middleware'

/**
 * Ensures the authenticated user is a member of the project identified by
 * req.params.projectId.  Must be placed after authenticateToken and after
 * the projectIdParam resolver (so req.params.projectId is already a UUID).
 *
 * Returns 403 when the user is neither a ProjectMember nor the project owner (project.userId).
 */
export async function requireProjectMember(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.userId
    const { projectId } = req.params

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

    // Legacy / backfill gap: project creator (project.userId) may not have a ProjectMember row yet.
    const project = await prisma.project.findFirst({
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
