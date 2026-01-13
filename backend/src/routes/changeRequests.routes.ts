import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  createChangeRequest,
  getChangeRequests,
  getChangeRequest,
  updateChangeRequest,
  deleteChangeRequest,
} from '../controllers/changeRequest.controller'

const router = Router()

router.use(authenticateToken)

router.post('/:projectId', createChangeRequest)
router.get('/:projectId', getChangeRequests)
router.get('/:projectId/:id', getChangeRequest)
router.put('/:projectId/:id', updateChangeRequest)
router.delete('/:projectId/:id', deleteChangeRequest)

export default router
