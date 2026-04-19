import { Router, Response } from 'express'
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { requireAiEnabled } from '../middleware/requireAiEnabled.middleware'

/**
 * Phase 1c stubs. The real /ai/draft, /ai/review, /ai/impact, /ai/accept
 * handlers land in a follow-up; this file registers only the middleware
 * chain + a `ping` endpoint so the gate can be exercised end-to-end.
 *
 * Mount point: `/api/v1/parameters/:projectId/ai/...` (the router is
 * registered alongside the existing parameters routes in routes/index.ts
 * so every /ai handler inherits the same auth + membership chain).
 */
const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)
router.use('/:projectId/ai', requireAiEnabled)

/**
 * GET /ai/ping -- minimal probe. Returns 200 only when all three flags
 * (env / project / package) clear. Use to verify gate wiring.
 */
router.get('/:projectId/ai/ping', (req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: { projectId: req.params.projectId, userId: req.user?.userId, ts: Date.now() },
  })
})

export default router
