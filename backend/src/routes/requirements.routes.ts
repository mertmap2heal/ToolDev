import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getRequirements,
  getRequirement,
  getAuditEvents,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getRequirementChildren,
  createRequirementComment,
  deleteRequirementComment,
  updateRequirementParent,
  bulkUpdateRequirements,
  bulkImportRequirements,
  getCustomRequirementTypes,
  addCustomRequirementType,
  deleteCustomRequirementType,
  migrateCategoryToRequirementType,
} from '../controllers/requirement.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', getRequirements)
router.get('/:projectId/audit', getAuditEvents)
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

// Custom Requirement Types
router.get('/:projectId/custom-types', getCustomRequirementTypes)
router.post('/:projectId/custom-types', addCustomRequirementType)
router.delete('/:projectId/custom-types/:typeId', deleteCustomRequirementType)

// Migration endpoint
router.post('/:projectId/migrate-category-to-type', migrateCategoryToRequirementType)

export default router
