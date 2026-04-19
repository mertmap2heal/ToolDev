import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from './auth.middleware'

/**
 * Three-layer AI feature gate (ai-ready-vision.md §5, plan §7).
 *
 * An AI-tier endpoint (T1 / T2 / T3) is allowed only when ALL of:
 *   1. The global env flag `FEATURES_AI_ENABLED` is `true`.
 *   2. `Project.aiEnabled` is `true` for the resolved project.
 *   3. (Frontend-side gate, not enforced here: the sold package tier
 *      lists `ai` in `frontend/src/config/packages/*.json`.)
 *
 * Any failure returns 403 with a structured error code so the client
 * can render an actionable message.
 *
 * This middleware MUST run after `authenticateToken` and `projectIdParam`
 * (or any equivalent that attached `req.params.projectId`).
 */
export async function requireAiEnabled(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (process.env.FEATURES_AI_ENABLED !== 'true') {
    res.status(403).json({
      success: false,
      error: 'AI features are disabled on this instance.',
      code: 'AI_DISABLED_GLOBAL',
    })
    return
  }

  const projectId = req.params.projectId
  if (!projectId) {
    res.status(400).json({
      success: false,
      error: 'projectId is required to check AI enablement.',
      code: 'AI_MISSING_PROJECT_ID',
    })
    return
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { aiEnabled: true },
  })

  if (!project) {
    res.status(404).json({
      success: false,
      error: 'Project not found.',
      code: 'PROJECT_NOT_FOUND',
    })
    return
  }

  if (!project.aiEnabled) {
    res.status(403).json({
      success: false,
      error: 'AI features are disabled for this project. An admin can enable them in project settings.',
      code: 'AI_DISABLED_PROJECT',
    })
    return
  }

  next()
}
