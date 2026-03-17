import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as exportTemplateController from '../controllers/requirementExportTemplate.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Requirements Export templates (ExportBuilder presets)
router.get('/:projectId/archive/deleted',  exportTemplateController.listDeleted)
router.get('/:projectId',                  exportTemplateController.list)
router.get('/:projectId/:id',              exportTemplateController.getOne)
router.post('/:projectId',                 exportTemplateController.create)
router.put('/:projectId/:id',              exportTemplateController.update)
router.post('/:projectId/:id/restore',     exportTemplateController.restore)
router.delete('/:projectId/:id/permanent', exportTemplateController.permanentDelete)
router.delete('/:projectId/:id',           exportTemplateController.remove)

export default router
