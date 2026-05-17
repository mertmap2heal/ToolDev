import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getBaselines,
  getBaseline,
  createBaseline,
  lockBaseline,
  deleteBaseline,
  compareBaselines,
  compareBaselineRootsDiff,
} from '../controllers/baseline.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

/**
 * @openapi
 * /baselines/{projectId}/compare:
 *   get:
 *     tags: [Baselines]
 *     summary: Compare two baselines
 *     description: >-
 *       Return the diff between two baselines of a project. Pass the two
 *       baseline ids as query parameters.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: The project id (membership-checked).
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *         description: The id of the baseline to diff from.
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *         description: The id of the baseline to diff to.
 *     responses:
 *       '200':
 *         description: The structured diff between the two baselines.
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
 *               data: { added: [], removed: [], changed: [] }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Compare two baselines (must come before /:projectId/:baselineId to avoid route conflicts)
router.get('/:projectId/compare', compareBaselines)

/**
 * @openapi
 * /baselines/{projectId}/roots/diff:
 *   get:
 *     tags: [Baselines]
 *     summary: Diff two R-4 BaselineRoot snapshots
 *     description: >-
 *       Return the structured field/line diff between two `BaselineRoot`
 *       snapshots (the R-4 unified baseline primitive). Pass the two root
 *       ids as query parameters.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: The project id (membership-checked).
 *       - in: query
 *         name: from
 *         schema: { type: string }
 *         description: The id of the BaselineRoot to diff from.
 *       - in: query
 *         name: to
 *         schema: { type: string }
 *         description: The id of the BaselineRoot to diff to.
 *     responses:
 *       '200':
 *         description: The structured diff between the two BaselineRoot snapshots.
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
 *               data: { added: [], removed: [], changed: [] }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Diff two R-4 BaselineRoot snapshots — structured field/line diff (NX-2 #440).
// Static segment, declared before the /:projectId/:baselineId param route.
router.get('/:projectId/roots/diff', compareBaselineRootsDiff)

/**
 * @openapi
 * /baselines/{projectId}/{baselineId}:
 *   get:
 *     tags: [Baselines]
 *     summary: Get a single baseline
 *     description: Return one baseline of a project by its id.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: The project id (membership-checked).
 *       - in: path
 *         name: baselineId
 *         required: true
 *         schema: { type: string }
 *         description: The baseline id.
 *     responses:
 *       '200':
 *         description: The requested baseline.
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
 *               data: { id: bl_1, name: 'PDR Baseline', locked: false }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   delete:
 *     tags: [Baselines]
 *     summary: Delete a baseline
 *     description: >-
 *       Delete a baseline of a project. A locked baseline cannot be
 *       deleted.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: The project id (membership-checked).
 *       - in: path
 *         name: baselineId
 *         required: true
 *         schema: { type: string }
 *         description: The baseline id to delete.
 *     responses:
 *       '200':
 *         description: Baseline deleted.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     message: { type: string }
 *             example: { success: true, message: 'Baseline deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '409':
 *         description: The baseline is locked and cannot be deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *             example: { success: false, error: 'Locked baselines cannot be deleted' }
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Get a specific baseline (must come before /:projectId to avoid route conflicts)
router.get('/:projectId/:baselineId', getBaseline)

/**
 * @openapi
 * /baselines/{projectId}:
 *   get:
 *     tags: [Baselines]
 *     summary: List a project's baselines
 *     description: Return every baseline of the given project.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: The project id (membership-checked).
 *     responses:
 *       '200':
 *         description: The list of baselines.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items: { type: object }
 *             example:
 *               success: true
 *               data:
 *                 - { id: bl_1, name: 'PDR Baseline', locked: true }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Baselines]
 *     summary: Create a baseline
 *     description: >-
 *       Snapshot the current project state into a new named baseline.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: The project id (membership-checked).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *           example:
 *             name: CDR Baseline
 *             description: Snapshot taken at the Critical Design Review.
 *     responses:
 *       '201':
 *         description: Baseline created.
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
 *               data: { id: bl_2, name: 'CDR Baseline', locked: false }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Get all baselines for a project
router.get('/:projectId', getBaselines)

// Create a new baseline
router.post('/:projectId', createBaseline)

/**
 * @openapi
 * /baselines/{projectId}/{baselineId}/lock:
 *   put:
 *     tags: [Baselines]
 *     summary: Lock a baseline
 *     description: >-
 *       Lock a baseline so its snapshot becomes immutable. A locked
 *       baseline can no longer be edited or deleted.
 *     parameters:
 *       - in: path
 *         name: projectId
 *         required: true
 *         schema: { type: string }
 *         description: The project id (membership-checked).
 *       - in: path
 *         name: baselineId
 *         required: true
 *         schema: { type: string }
 *         description: The baseline id to lock.
 *     responses:
 *       '200':
 *         description: Baseline locked. Returns the locked baseline.
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
 *               data: { id: bl_2, name: 'CDR Baseline', locked: true }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Lock a baseline
router.put('/:projectId/:baselineId/lock', lockBaseline)

// Delete a baseline
router.delete('/:projectId/:baselineId', deleteBaseline)

export default router
