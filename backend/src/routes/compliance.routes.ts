import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as ctrl from '../controllers/compliance.controller'

/**
 * SECURITY: compliance findings drive certification gating per IEEE 828 /
 * DO-178C. Read endpoints are open to project members; mutating endpoints
 * (regulation folders, rules, runChecks) require admin to mirror the CCB
 * gate documented in `.claude/kb/configuration-management.md`.
 */
const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId/regulation-folders', ctrl.getRegulationFolders)
router.post('/:projectId/regulation-folders', requireAdmin, ctrl.createRegulationFolder)
router.patch('/:projectId/regulation-folders/:id', requireAdmin, ctrl.updateRegulationFolder)
router.delete('/:projectId/regulation-folders/:id', requireAdmin, ctrl.deleteRegulationFolder)

router.get('/:projectId/rules', ctrl.getRules)
router.post('/:projectId/rules', requireAdmin, ctrl.createRule)
router.get('/:projectId/rules/:id', ctrl.getRule)
router.patch('/:projectId/rules/:id', requireAdmin, ctrl.updateRule)
router.delete('/:projectId/rules/:id', requireAdmin, ctrl.deleteRule)

router.post('/:projectId/run', requireAdmin, ctrl.runChecks)
router.get('/:projectId/runs', ctrl.getRuns)
router.get('/:projectId/runs/:runId', ctrl.getRun)

router.get('/:projectId/findings', ctrl.getFindings)

export default router
