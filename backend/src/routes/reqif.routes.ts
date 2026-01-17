import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import * as reqifController from '../controllers/reqif.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId/export', reqifController.exportToReqIF)
router.post('/:projectId/import', reqifController.importFromReqIF)

export default router
