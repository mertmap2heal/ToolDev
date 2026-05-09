import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectOwnerOrAdmin } from '../middleware/requireProjectOwnerOrAdmin.middleware'
import * as ctrl from '../controllers/compliance.controller'

/**
 * SECURITY: compliance findings drive certification gating per IEEE 828 /
 * DO-178C. Read endpoints are open to project members; mutating endpoints
 * (regulation folders, rules, runChecks) require the project owner OR a
 * platform admin. Mirrors the CCB-style gate from
 * `.claude/kb/configuration-management.md` while keeping the project
 * owner — the de-facto ConfigManager — as the everyday writer.
 */
const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId/regulation-folders', ctrl.getRegulationFolders)
router.post('/:projectId/regulation-folders', requireProjectOwnerOrAdmin, ctrl.createRegulationFolder)
router.patch('/:projectId/regulation-folders/:id', requireProjectOwnerOrAdmin, ctrl.updateRegulationFolder)
router.delete('/:projectId/regulation-folders/:id', requireProjectOwnerOrAdmin, ctrl.deleteRegulationFolder)

router.get('/:projectId/rules', ctrl.getRules)
router.post('/:projectId/rules', requireProjectOwnerOrAdmin, ctrl.createRule)
router.get('/:projectId/rules/:id', ctrl.getRule)
router.patch('/:projectId/rules/:id', requireProjectOwnerOrAdmin, ctrl.updateRule)
router.delete('/:projectId/rules/:id', requireProjectOwnerOrAdmin, ctrl.deleteRule)

router.post('/:projectId/run', requireProjectOwnerOrAdmin, ctrl.runChecks)
router.get('/:projectId/runs', ctrl.getRuns)
router.get('/:projectId/runs/:runId', ctrl.getRun)

router.get('/:projectId/findings', ctrl.getFindings)

export default router
