import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getRequirements,
  getAllRequirements,
  getRequirement,
  getAuditEvents,
  getRequirementsDashboard,
  importReqif,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  restoreRequirement,
  permanentDeleteRequirement,
  getRecentlyDeletedRequirements,
  getRequirementChildren,
  getRequirementSubscription,
  subscribeToRequirement,
  unsubscribeFromRequirement,
  createRequirementComment,
  deleteRequirementComment,
  updateRequirementParent,
  bulkUpdateRequirements,
  bulkImportRequirements,
  getCustomRequirementTypes,
  addCustomRequirementType,
  deleteCustomRequirementType,
  migrateCategoryToRequirementType,
  updateRequirementComponent,
  lockRequirement,
  unlockRequirement,
} from '../controllers/requirement.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Custom Requirement Types - MUST be defined before /:projectId/:requirementId
router.get('/:projectId/custom-types', getCustomRequirementTypes)
router.post('/:projectId/custom-types', addCustomRequirementType)
router.delete('/:projectId/custom-types/:typeId', deleteCustomRequirementType)

// Migration endpoint
router.post('/:projectId/migrate-category-to-type', migrateCategoryToRequirementType)

// RM dashboard (must be before /:projectId to avoid "dashboard" as projectId)
router.get('/:projectId/dashboard', getRequirementsDashboard)
router.post('/:projectId/import/reqif', importReqif)

router.get('/:projectId', getRequirements)
router.get('/:projectId/all', getAllRequirements)
router.get('/:projectId/audit', getAuditEvents)
router.get('/:projectId/:requirementId', getRequirement)
router.get('/:projectId/:requirementId/children', getRequirementChildren)
router.get('/:projectId/:requirementId/subscription', getRequirementSubscription)
router.post('/:projectId', createRequirement)
router.post('/:projectId/:requirementId/subscribe', subscribeToRequirement)
router.post('/:projectId/:requirementId/unsubscribe', unsubscribeFromRequirement)
router.put('/:projectId/:requirementId', updateRequirement)
router.put('/:projectId/:requirementId/parent', updateRequirementParent)
router.delete('/:projectId/:requirementId', deleteRequirement)
router.post('/:projectId/:requirementId/lock', lockRequirement)
router.post('/:projectId/:requirementId/unlock', unlockRequirement)
router.post('/:projectId/bulk-update', bulkUpdateRequirements)
router.post('/:projectId/bulk-import', bulkImportRequirements)

router.post('/:projectId/:requirementId/comments', createRequirementComment)
router.delete('/:projectId/comments/:commentId', deleteRequirementComment)

// Custom Requirement Types (Moved to top)

// Migration endpoint
router.post('/:projectId/migrate-category-to-type', migrateCategoryToRequirementType)

// Component assignment (drag-and-drop)
router.patch('/:projectId/:requirementId/component', updateRequirementComponent)


// Requirement Soft Delete & Archive
router.post(
  '/:projectId/:requirementId/restore',
  restoreRequirement
)

router.delete(
  '/:projectId/:requirementId/permanent',
  permanentDeleteRequirement
)

router.get(
  '/:projectId/archive/recently-deleted',
  getRecentlyDeletedRequirements
)

export default router
