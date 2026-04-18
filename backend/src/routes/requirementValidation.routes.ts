import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as validationController from '../controllers/requirementValidation.controller'
import * as qualityWorkbenchController from '../controllers/requirementQualityWorkbench.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

router.get('/:projectId', validationController.validateProjectRequirements)
router.get('/:projectId/requirement/:requirementId', validationController.validateRequirement)
router.get('/:projectId/circular-dependencies', validationController.checkCircularDependencies)
router.get('/:projectId/duplicate-ids', validationController.checkDuplicateIds)

router.get('/:projectId/quality-dismissals', requireProjectMember, qualityWorkbenchController.listQualityDismissals)
router.put('/:projectId/quality-dismissals', requireProjectMember, qualityWorkbenchController.upsertQualityDismissals)
router.delete('/:projectId/quality-dismissals', requireProjectMember, qualityWorkbenchController.deleteQualityDismissal)
router.delete(
  '/:projectId/quality-dismissals/requirement/:requirementId',
  requireProjectMember,
  qualityWorkbenchController.deleteAllDismissalsForRequirement
)
router.delete(
  '/:projectId/quality-dismissals/project/all',
  requireProjectMember,
  qualityWorkbenchController.clearAllDismissalsForProject
)
router.post('/:projectId/quality-dismissals/bulk-skip-warnings', requireProjectMember, qualityWorkbenchController.bulkSkipWarnings)

export default router
