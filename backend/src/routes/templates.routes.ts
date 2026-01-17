import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import * as templateController from '../controllers/template.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', templateController.getTemplates)
router.get('/:projectId/:templateId', templateController.getTemplate)
router.post('/:projectId', templateController.createTemplate)
router.put('/:projectId/:templateId', templateController.updateTemplate)
router.delete('/:projectId/:templateId', templateController.deleteTemplate)

export default router
