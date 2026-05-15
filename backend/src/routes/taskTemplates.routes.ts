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
import {
  requireBodyProjectMember,
  requireTemplateProjectMember,
} from '../middleware/requireTaskProjectMember.middleware'

const router = Router()

router.use(authenticateToken)

// SEC-2 (#375): route-level membership middleware on GET / PATCH / DELETE
// individual templates. The controller still applies its own auth checks
// (it correctly handles SUPERIOR_ADMIN + global templates), but the
// middleware writes a `tasks:tenant-scope-denied` audit row when a foreign
// tenant probes a template id.
router.post('/', createTemplate)
router.get('/', getTemplates)
router.get('/:id', requireTemplateProjectMember(), getTemplate)
router.patch('/:id', requireTemplateProjectMember(), updateTemplate)
router.delete('/:id', requireTemplateProjectMember(), deleteTemplate)

// Creating a task from a template produces a project-scoped task; require
// the caller to be a member of the target project (#159).
router.post(
  '/:id/create-task',
  requireBodyProjectMember('body', ['project_id', 'projectId'], { resourceLabel: 'task-template' }),
  createTaskFromTemplate
)

export default router
