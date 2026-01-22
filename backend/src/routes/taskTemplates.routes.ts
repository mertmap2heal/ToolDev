import { Router } from 'express'
import {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  createTaskFromTemplate,
} from '../controllers/template.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

router.post('/', createTemplate)
router.get('/', getTemplates)
router.get('/:id', getTemplate)
router.patch('/:id', updateTemplate)
router.delete('/:id', deleteTemplate)
router.post('/:id/create-task', createTaskFromTemplate)

export default router
