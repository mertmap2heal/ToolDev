// NX-3 (#443) — Configuration Management: ConfigItem routes.
//
// Mounted at /api/v1/config-items. Every route is tenant-scoped:
// `authenticateToken` (global) -> `projectIdParam` (UUID resolution) ->
// `requireProjectMember` (N-3 tenant-scope rule). 9 endpoints.
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import * as ctrl from '../controllers/configItem.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

// Static segment before the /:id param route so it is not shadowed.
router.get('/:projectId/search', ctrl.search)

router.get('/:projectId', ctrl.list)
router.post('/:projectId', ctrl.create)
router.get('/:projectId/:id', ctrl.get)
router.put('/:projectId/:id', ctrl.update)
router.delete('/:projectId/:id', ctrl.remove)
router.post('/:projectId/:id/lock', ctrl.lock)
router.post('/:projectId/:id/unlock', ctrl.unlock)
router.post('/:projectId/:id/link-source', ctrl.linkSource)

export default router
