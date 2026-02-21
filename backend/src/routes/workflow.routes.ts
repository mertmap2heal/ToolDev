import { Router } from 'express'
import {
  getWorkflowProgress,
  updateWorkflowStep,
} from '../controllers/workflow.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId', getWorkflowProgress)
router.put('/:projectId/steps/:stepId', updateWorkflowStep)

export default router
