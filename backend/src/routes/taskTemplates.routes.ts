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
import { requireBodyProjectMember } from '../middleware/requireTaskProjectMember.middleware'

const router = Router()

router.use(authenticateToken)

router.post('/', createTemplate)
router.get('/', getTemplates)
router.get('/:id', getTemplate)
router.patch('/:id', updateTemplate)
router.delete('/:id', deleteTemplate)

// Creating a task from a template produces a project-scoped task; require
// the caller to be a member of the target project (#159).
router.post(
  '/:id/create-task',
  requireBodyProjectMember('body', ['project_id', 'projectId']),
  createTaskFromTemplate
)

export default router
