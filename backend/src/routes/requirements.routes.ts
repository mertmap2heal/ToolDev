import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getRequirements,
  getRequirement,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getRequirementChildren,
  createRequirementComment,
  deleteRequirementComment,
  updateRequirementParent,
  bulkUpdateRequirements,
  bulkImportRequirements,
} from '../controllers/requirement.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', getRequirements)
router.get('/:projectId/:requirementId', getRequirement)
router.get('/:projectId/:requirementId/children', getRequirementChildren)
router.post('/:projectId', createRequirement)
router.put('/:projectId/:requirementId', updateRequirement)
router.put('/:projectId/:requirementId/parent', updateRequirementParent)
router.delete('/:projectId/:requirementId', deleteRequirement)
router.post('/:projectId/bulk-update', bulkUpdateRequirements)
router.post('/:projectId/bulk-import', bulkImportRequirements)

router.post('/:projectId/:requirementId/comments', createRequirementComment)
router.delete('/:projectId/comments/:commentId', deleteRequirementComment)

export default router
