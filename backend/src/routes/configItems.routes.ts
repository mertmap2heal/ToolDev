// NX-3 (#443) — Configuration Management: ConfigItem routes.
//
// Mounted at /api/v1/config-items. Every route is tenant-scoped:
// `authenticateToken` (global) -> `projectIdParam` (UUID resolution) ->
// `requireProjectMember` (N-3 tenant-scope rule). 9 ConfigItem endpoints plus
// the CM-N6 baseline endpoints (snapshot ConfigItems into an R-4 BaselineRoot).
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import * as ctrl from '../controllers/configItem.controller'
import * as baselineCtrl from '../controllers/cmBaseline.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

// CM-N6 — ConfigItem baselining. A CM baseline is an R-4 BaselineRoot
// (`kind='CM'`); each snapshotted CI is a `linkedEntityType='ConfigItem'`
// BaselineRootItem. These `/baselines` routes are declared BEFORE the bare
// `/:projectId/:id` ConfigItem routes so the `baselines` literal segment is
// not captured by the `:id` param.
router.get('/:projectId/baselines/compare', baselineCtrl.compare)
router.get('/:projectId/baselines', baselineCtrl.list)
router.post('/:projectId/baselines', baselineCtrl.create)
router.get('/:projectId/baselines/:baselineId', baselineCtrl.get)
router.post('/:projectId/baselines/:baselineId/items', baselineCtrl.addItem)
router.post('/:projectId/baselines/:baselineId/freeze', baselineCtrl.freeze)

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
