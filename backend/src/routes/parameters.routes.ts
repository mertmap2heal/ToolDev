import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getParameters,
  getParameter,
  updateParameter,
  deleteParameter,
} from '../controllers/parameter.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId', getParameters)
router.get('/:projectId/:id', getParameter)
router.put('/:projectId/:id', updateParameter)
router.delete('/:projectId/:id', deleteParameter)

export default router
