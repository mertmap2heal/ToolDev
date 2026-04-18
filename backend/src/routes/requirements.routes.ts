import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { requireProjectOwnerOrAdmin } from '../middleware/requireProjectOwnerOrAdmin.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getRequirements,
  getAllRequirements,
  getRequirement,
  getAuditEvents,
  getProjectAuditEvents,
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
  sendLifecycleTransitionReminder,
} from '../controllers/requirement.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

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
router.get('/:projectId/audit/project', getProjectAuditEvents)
router.post(
  '/:projectId/:requirementId/lifecycle-transition-reminder',
  sendLifecycleTransitionReminder
)
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

// Component assignment (drag-and-drop)
router.patch('/:projectId/:requirementId/component', updateRequirementComponent)


// Requirement Soft Delete & Archive
router.post(
  '/:projectId/:requirementId/restore',
  restoreRequirement
)

router.delete(
  '/:projectId/:requirementId/permanent',
  requireProjectOwnerOrAdmin,
  permanentDeleteRequirement
)

router.get(
  '/:projectId/archive/recently-deleted',
  getRecentlyDeletedRequirements
)

export default router
