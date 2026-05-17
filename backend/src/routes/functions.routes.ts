import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import {
  createFunction,
  getFunctions,
  getFunction,
  updateFunction,
  deleteFunction,
  moveFunction,
  updateFunctionComponent,
} from '../controllers/function.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

router.post('/:projectId', createFunction)
router.get('/:projectId', getFunctions)
router.get('/:projectId/:id', getFunction)
router.put('/:projectId/:id', updateFunction)
router.put('/:projectId/:id/move', moveFunction)
router.patch('/:projectId/:id/component', updateFunctionComponent)
router.delete('/:projectId/:id', deleteFunction)

export default router
