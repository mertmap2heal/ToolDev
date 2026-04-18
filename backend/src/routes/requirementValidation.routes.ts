import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as validationController from '../controllers/requirementValidation.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

router.get('/:projectId', validationController.validateProjectRequirements)
router.get('/:projectId/requirement/:requirementId', validationController.validateRequirement)
router.get('/:projectId/circular-dependencies', validationController.checkCircularDependencies)
router.get('/:projectId/duplicate-ids', validationController.checkDuplicateIds)

export default router
