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

/**
 * @openapi
 * /requirements/{projectId}/custom-types:
 *   get:
 *     tags: [Requirements]
 *     summary: List custom requirement types
 *     description: Return the project-defined custom requirement types.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     responses:
 *       '200':
 *         description: The list of custom requirement types.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: crt_1, name: 'Safety Requirement' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Requirements]
 *     summary: Add a custom requirement type
 *     description: Create a new project-scoped custom requirement type.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *           example: { name: 'Safety Requirement' }
 *     responses:
 *       '201':
 *         description: Custom type created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: crt_1, name: 'Safety Requirement' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Custom Requirement Types - MUST be defined before /:projectId/:requirementId
router.get('/:projectId/custom-types', getCustomRequirementTypes)
router.post('/:projectId/custom-types', addCustomRequirementType)

/**
 * @openapi
 * /requirements/{projectId}/custom-types/{typeId}:
 *   delete:
 *     tags: [Requirements]
 *     summary: Delete a custom requirement type
 *     description: Remove a project-scoped custom requirement type.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - in: path
 *         name: typeId
 *         required: true
 *         schema: { type: string }
 *         description: The custom requirement type id.
 *     responses:
 *       '200':
 *         description: Custom type deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Type deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:projectId/custom-types/:typeId', deleteCustomRequirementType)

/**
 * @openapi
 * /requirements/{projectId}/migrate-category-to-type:
 *   post:
 *     tags: [Requirements]
 *     summary: Migrate legacy categories to requirement types
 *     description: >-
 *       One-off migration that converts the project's legacy free-text
 *       requirement categories into first-class custom requirement types.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     responses:
 *       '200':
 *         description: Migration complete. Returns a summary of the migration.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { migrated: 12 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Migration endpoint
router.post('/:projectId/migrate-category-to-type', migrateCategoryToRequirementType)

/**
 * @openapi
 * /requirements/{projectId}/dashboard:
 *   get:
 *     tags: [Requirements]
 *     summary: Get the requirements dashboard
 *     description: >-
 *       Return aggregate dashboard metrics for the project's requirements —
 *       counts by status, coverage, suspect-link totals, and baseline
 *       counts.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     responses:
 *       '200':
 *         description: The requirements dashboard metrics.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { total: 142, coverage: 0.86 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// RM dashboard (must be before /:projectId to avoid "dashboard" as projectId)
router.get('/:projectId/dashboard', getRequirementsDashboard)

/**
 * @openapi
 * /requirements/{projectId}/import/reqif:
 *   post:
 *     tags: [Requirements]
 *     summary: Import requirements from a ReqIF document
 *     description: >-
 *       Import requirements into the project from a ReqIF
 *       (Requirements Interchange Format) document.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reqif: { type: string, description: 'The ReqIF XML payload.' }
 *           example: { reqif: '<REQ-IF>...</REQ-IF>' }
 *     responses:
 *       '200':
 *         description: Import complete. Returns a summary of imported items.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { imported: 25 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/import/reqif', importReqif)

/**
 * @openapi
 * /requirements/{projectId}:
 *   get:
 *     tags: [Requirements]
 *     summary: List the project's requirements
 *     description: >-
 *       Return the project's requirements. Soft-deleted requirements are
 *       excluded.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     responses:
 *       '200':
 *         description: The list of requirements.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example:
 *               success: true
 *               data:
 *                 - { id: req_1, key: 'REQ-001', title: 'The system shall...', status: 'Draft' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Requirements]
 *     summary: Create a requirement
 *     description: >-
 *       Create a new requirement in the project. The description is
 *       validated against the INCOSE/EARS quality rules (N-2.3); a request
 *       with a blocking quality finding is rejected with 422 unless a
 *       non-blank `qualityOverrideReason` is supplied.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string }
 *               priority: { type: string, enum: [High, Medium, Low] }
 *               parentId: { type: string }
 *               qualityOverrideReason:
 *                 type: string
 *                 description: Audited reason to override a blocking INCOSE/EARS quality finding.
 *           example:
 *             title: Cabin lighting on door open
 *             description: When the door opens, the system shall illuminate the cabin lights within 200ms.
 *             priority: High
 *     responses:
 *       '201':
 *         description: Requirement created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example:
 *               success: true
 *               data: { id: req_2, key: 'REQ-002', title: 'Cabin lighting on door open' }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '422':
 *         description: The requirement description failed a blocking INCOSE/EARS quality rule.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ErrorEnvelope'
 *                 - type: object
 *                   properties:
 *                     qualityReport: { type: object }
 *             example:
 *               success: false
 *               error: Requirement text failed quality validation
 *               qualityReport: { score: 40, hasErrors: true }
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId', getRequirements)

/**
 * @openapi
 * /requirements/{projectId}/all:
 *   get:
 *     tags: [Requirements]
 *     summary: List all requirements including soft-deleted
 *     description: >-
 *       Return every requirement of the project, including soft-deleted
 *       rows (for archive views).
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     responses:
 *       '200':
 *         description: The list of requirements including soft-deleted.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: req_1, key: 'REQ-001', deletedAt: null }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/all', getAllRequirements)

/**
 * @openapi
 * /requirements/{projectId}/audit:
 *   get:
 *     tags: [Requirements]
 *     summary: Get requirement audit events
 *     description: >-
 *       Return audit events for a single requirement. Pass the requirement
 *       id as a query parameter.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - in: query
 *         name: requirementId
 *         schema: { type: string }
 *         description: The requirement id to fetch audit events for.
 *     responses:
 *       '200':
 *         description: The requirement's audit events.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ action: 'requirements:update', at: '2026-05-17T10:00:00Z' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/audit', getAuditEvents)

/**
 * @openapi
 * /requirements/{projectId}/audit/project:
 *   get:
 *     tags: [Requirements]
 *     summary: Get project-wide requirement audit events
 *     description: Return the audit events for every requirement in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     responses:
 *       '200':
 *         description: The project-wide requirement audit events.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ action: 'requirements:create', requirementId: req_1 }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/audit/project', getProjectAuditEvents)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/lifecycle-transition-reminder:
 *   post:
 *     tags: [Requirements]
 *     summary: Send a lifecycle-transition reminder
 *     description: >-
 *       Email the requirement's owner a reminder that a lifecycle-status
 *       transition is pending.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Reminder sent.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Reminder sent' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post(
  '/:projectId/:requirementId/lifecycle-transition-reminder',
  sendLifecycleTransitionReminder
)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}:
 *   get:
 *     tags: [Requirements]
 *     summary: Get a single requirement
 *     description: Return one requirement of the project by its id.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: The requested requirement.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example:
 *               success: true
 *               data: { id: req_1, key: 'REQ-001', title: 'The system shall...', status: 'Draft' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     tags: [Requirements]
 *     summary: Update a requirement
 *     description: >-
 *       Update a requirement. When the description changes it is re-checked
 *       against the INCOSE/EARS quality rules (N-2.3) — a blocking finding
 *       returns 422 unless a `qualityOverrideReason` is supplied. Uses
 *       optimistic concurrency: pass the current `version`.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               status: { type: string }
 *               priority: { type: string }
 *               version: { type: integer, description: 'The current version, for optimistic locking.' }
 *               qualityOverrideReason: { type: string }
 *           example:
 *             title: Cabin lighting on door open
 *             status: Reviewed
 *             version: 3
 *     responses:
 *       '200':
 *         description: Requirement updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: req_1, status: 'Reviewed', version: 4 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '409':
 *         description: Optimistic-lock conflict — the requirement changed since the supplied version.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *             example: { success: false, error: 'Requirement was modified by another user' }
 *       '422':
 *         description: The updated description failed a blocking INCOSE/EARS quality rule.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *             example: { success: false, error: 'Requirement text failed quality validation' }
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     tags: [Requirements]
 *     summary: Soft-delete a requirement
 *     description: >-
 *       Soft-delete a requirement (sets `deletedAt`). The row is recoverable
 *       via the restore endpoint until the daily cleanup job purges it.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Requirement soft-deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Requirement deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/:requirementId', getRequirement)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/children:
 *   get:
 *     tags: [Requirements]
 *     summary: Get a requirement's child requirements
 *     description: Return the direct children of a requirement in the decomposition tree.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: The child requirements.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: req_5, key: 'REQ-005', parentId: req_1 }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/:requirementId/children', getRequirementChildren)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/subscription:
 *   get:
 *     tags: [Requirements]
 *     summary: Get the caller's subscription to a requirement
 *     description: >-
 *       Return whether the current user is subscribed to change
 *       notifications for the requirement.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: The subscription state.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { subscribed: true } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/:requirementId/subscription', getRequirementSubscription)
router.post('/:projectId', createRequirement)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/subscribe:
 *   post:
 *     tags: [Requirements]
 *     summary: Subscribe to a requirement
 *     description: Subscribe the current user to change notifications for the requirement.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Subscribed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Subscribed' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/:requirementId/subscribe', subscribeToRequirement)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/unsubscribe:
 *   post:
 *     tags: [Requirements]
 *     summary: Unsubscribe from a requirement
 *     description: Unsubscribe the current user from change notifications for the requirement.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Unsubscribed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Unsubscribed' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/:requirementId/unsubscribe', unsubscribeFromRequirement)
router.put('/:projectId/:requirementId', updateRequirement)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/parent:
 *   put:
 *     tags: [Requirements]
 *     summary: Re-parent a requirement
 *     description: Move a requirement under a different parent in the decomposition tree.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               parentId:
 *                 type: string
 *                 nullable: true
 *                 description: The new parent requirement id, or null to make it a root.
 *           example: { parentId: req_1 }
 *     responses:
 *       '200':
 *         description: Requirement re-parented.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: req_5, parentId: req_1 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:projectId/:requirementId/parent', updateRequirementParent)
router.delete('/:projectId/:requirementId', deleteRequirement)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/lock:
 *   post:
 *     tags: [Requirements]
 *     summary: Lock a requirement
 *     description: Lock a requirement so its content cannot be edited.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Requirement locked.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: req_1, isLocked: true } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/:requirementId/lock', lockRequirement)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/unlock:
 *   post:
 *     tags: [Requirements]
 *     summary: Unlock a requirement
 *     description: Unlock a previously locked requirement so it can be edited again.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Requirement unlocked.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: req_1, isLocked: false } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/:requirementId/unlock', unlockRequirement)

/**
 * @openapi
 * /requirements/{projectId}/bulk-update:
 *   post:
 *     tags: [Requirements]
 *     summary: Bulk-update requirements
 *     description: Apply the same field changes to a set of requirements in one request.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids, changes]
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *               changes: { type: object }
 *           example:
 *             ids: [req_1, req_2]
 *             changes: { status: 'Reviewed', priority: 'High' }
 *     responses:
 *       '200':
 *         description: Bulk update applied. Returns the count updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { updated: 2 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/bulk-update', bulkUpdateRequirements)

/**
 * @openapi
 * /requirements/{projectId}/bulk-import:
 *   post:
 *     tags: [Requirements]
 *     summary: Bulk-import requirements
 *     description: >-
 *       Create many requirements in one atomic request. Either all rows
 *       import or none do.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requirements]
 *             properties:
 *               requirements: { type: array, items: { type: object } }
 *           example:
 *             requirements:
 *               - { title: 'The system shall...', priority: 'High' }
 *     responses:
 *       '200':
 *         description: Bulk import complete. Returns the count imported.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { imported: 30 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/bulk-import', bulkImportRequirements)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/comments:
 *   post:
 *     tags: [Requirements]
 *     summary: Add a comment to a requirement
 *     description: Post a comment on a requirement's discussion thread.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string }
 *           example: { body: 'Confirmed the 200ms threshold with the test team.' }
 *     responses:
 *       '201':
 *         description: Comment created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: cmt_1, body: 'Confirmed...' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/:requirementId/comments', createRequirementComment)

/**
 * @openapi
 * /requirements/{projectId}/comments/{commentId}:
 *   delete:
 *     tags: [Requirements]
 *     summary: Delete a requirement comment
 *     description: Remove a comment from a requirement's discussion thread.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - in: path
 *         name: commentId
 *         required: true
 *         schema: { type: string }
 *         description: The comment id to delete.
 *     responses:
 *       '200':
 *         description: Comment deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Comment deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:projectId/comments/:commentId', deleteRequirementComment)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/component:
 *   patch:
 *     tags: [Requirements]
 *     summary: Assign a requirement to a component
 *     description: >-
 *       Assign (or clear) the PBS component a requirement is allocated to.
 *       Backs the drag-and-drop allocation UI.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               componentId:
 *                 type: string
 *                 nullable: true
 *                 description: The component id to allocate to, or null to clear.
 *           example: { componentId: cmp_1 }
 *     responses:
 *       '200':
 *         description: Component assignment updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: req_1, componentId: cmp_1 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Component assignment (drag-and-drop)
router.patch('/:projectId/:requirementId/component', updateRequirementComponent)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/restore:
 *   post:
 *     tags: [Requirements]
 *     summary: Restore a soft-deleted requirement
 *     description: Clear `deletedAt` on a soft-deleted requirement, bringing it back.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Requirement restored.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: req_1, deletedAt: null } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Requirement Soft Delete & Archive
router.post(
  '/:projectId/:requirementId/restore',
  restoreRequirement
)

/**
 * @openapi
 * /requirements/{projectId}/{requirementId}/permanent:
 *   delete:
 *     tags: [Requirements]
 *     summary: Permanently delete a requirement
 *     description: >-
 *       Hard-delete a requirement, bypassing the soft-delete window. This
 *       is irreversible and requires the caller to be a project owner or
 *       admin.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *       - $ref: '#/components/parameters/RequirementId'
 *     responses:
 *       '200':
 *         description: Requirement permanently deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Requirement permanently deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete(
  '/:projectId/:requirementId/permanent',
  requireProjectOwnerOrAdmin,
  permanentDeleteRequirement
)

/**
 * @openapi
 * /requirements/{projectId}/archive/recently-deleted:
 *   get:
 *     tags: [Requirements]
 *     summary: List recently soft-deleted requirements
 *     description: >-
 *       Return the project's recently soft-deleted requirements — the trash
 *       view, before the daily cleanup job purges them.
 *     parameters:
 *       - $ref: '#/components/parameters/RequirementsProjectId'
 *     responses:
 *       '200':
 *         description: The recently soft-deleted requirements.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: req_9, key: 'REQ-009', deletedAt: '2026-05-16T09:00:00Z' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get(
  '/:projectId/archive/recently-deleted',
  getRecentlyDeletedRequirements
)

export default router
