import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  createFunction,
  getFunctions,
  getFunction,
  updateFunction,
  deleteFunction,
} from '../controllers/function.controller'

const router = Router()

router.use(authenticateToken)

router.post('/:projectId', createFunction)
router.get('/:projectId', getFunctions)
router.get('/:projectId/:id', getFunction)
router.put('/:projectId/:id', updateFunction)
router.delete('/:projectId/:id', deleteFunction)

export default router
