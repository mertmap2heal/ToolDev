import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as ctrl from '../controllers/excelColumnMapping.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId', ctrl.list)
router.get('/:projectId/:id', ctrl.getOne)
router.post('/:projectId', ctrl.create)
router.put('/:projectId/:id', ctrl.update)
router.delete('/:projectId/:id', ctrl.remove)

export default router
