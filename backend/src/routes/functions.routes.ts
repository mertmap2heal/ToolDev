import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  createFunction,
  getFunctions,
  getFunction,
  updateFunction,
  deleteFunction,
  moveFunction,
} from '../controllers/function.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.post('/:projectId', createFunction)
router.get('/:projectId', getFunctions)
router.get('/:projectId/:id', getFunction)
router.put('/:projectId/:id', updateFunction)
router.put('/:projectId/:id/move', moveFunction)
router.delete('/:projectId/:id', deleteFunction)

export default router
