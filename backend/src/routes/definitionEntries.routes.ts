import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as definitionEntryController from '../controllers/definitionEntry.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId', definitionEntryController.list)
router.get('/:projectId/:id/usage', definitionEntryController.usage)
router.get('/:projectId/:id', definitionEntryController.getOne)
router.post('/:projectId', definitionEntryController.create)
router.put('/:projectId/:id', definitionEntryController.update)
router.delete('/:projectId/:id', definitionEntryController.remove)

export default router
