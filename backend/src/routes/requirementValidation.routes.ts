import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as validationController from '../controllers/requirementValidation.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId', validationController.validateProjectRequirements)
router.get('/:projectId/requirement/:requirementId', validationController.validateRequirement)
router.get('/:projectId/circular-dependencies', validationController.checkCircularDependencies)
router.get('/:projectId/duplicate-ids', validationController.checkDuplicateIds)

export default router
