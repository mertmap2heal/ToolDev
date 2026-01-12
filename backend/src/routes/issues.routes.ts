import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  createIssue,
  getIssues,
  getIssue,
  updateIssue,
  deleteIssue,
} from '../controllers/issue.controller'

const router = Router()

router.use(authenticateToken)

router.post('/:projectId', createIssue)
router.get('/:projectId', getIssues)
router.get('/:projectId/:id', getIssue)
router.put('/:projectId/:id', updateIssue)
router.delete('/:projectId/:id', deleteIssue)

export default router
