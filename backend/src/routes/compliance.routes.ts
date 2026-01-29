import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import * as ctrl from '../controllers/compliance.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId/rules', ctrl.getRules)
router.post('/:projectId/rules', ctrl.createRule)
router.get('/:projectId/rules/:id', ctrl.getRule)
router.patch('/:projectId/rules/:id', ctrl.updateRule)
router.delete('/:projectId/rules/:id', ctrl.deleteRule)

router.post('/:projectId/run', ctrl.runChecks)
router.get('/:projectId/runs', ctrl.getRuns)
router.get('/:projectId/runs/:runId', ctrl.getRun)

router.get('/:projectId/findings', ctrl.getFindings)

export default router
