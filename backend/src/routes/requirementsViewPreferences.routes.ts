import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getRequirementsViewPreferences,
  updateRequirementsViewPreferences,
} from '../controllers/requirementsViewPreferences.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId/requirements/view-preferences', getRequirementsViewPreferences)
router.put('/:projectId/requirements/view-preferences', updateRequirementsViewPreferences)

export default router

