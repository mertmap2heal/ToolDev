import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as ctrl from '../controllers/certification'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

/**
 * @openapi
 * /certification/{projectId}/state:
 *   get:
 *     tags: [Certification]
 *     summary: Get the full certification state
 *     description: >-
 *       Return the complete certification state of a project in one payload
 *       — used by the frontend to hydrate the certification module.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The full certification state.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { objectives: [], findings: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Full state (for frontend hydration)
router.get('/:projectId/state', ctrl.getFullState)

/**
 * @openapi
 * /certification/{projectId}/export/compliance-matrix:
 *   get:
 *     tags: [Certification]
 *     summary: Export the compliance matrix
 *     description: Generate and download the project's compliance matrix.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The compliance-matrix export.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Exports (must be before other :projectId routes that might conflict)
router.get('/:projectId/export/compliance-matrix', ctrl.exportComplianceMatrix)

/**
 * @openapi
 * /certification/{projectId}/export/evidence-index:
 *   get:
 *     tags: [Certification]
 *     summary: Export the evidence index
 *     description: Generate and download the project's certification evidence index.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The evidence-index export.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/export/evidence-index', ctrl.exportEvidenceIndex)

/**
 * @openapi
 * /certification/{projectId}/export/summary:
 *   get:
 *     tags: [Certification]
 *     summary: Export the certification summary
 *     description: Generate and download the project's certification summary.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The certification-summary export.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/export/summary', ctrl.exportSummary)

/**
 * @openapi
 * /certification/{projectId}/export/review-log:
 *   get:
 *     tags: [Certification]
 *     summary: Export the review log
 *     description: Generate and download the project's certification review log.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The review-log export.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/export/review-log', ctrl.exportReviewLog)

/**
 * @openapi
 * /certification/{projectId}/export/activity-log:
 *   get:
 *     tags: [Certification]
 *     summary: Export the activity log
 *     description: Generate and download the project's certification activity log.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The activity-log export.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/export/activity-log', ctrl.exportActivityLog)

/**
 * @openapi
 * /certification/{projectId}/packages/{packageId}/generate-bundle:
 *   post:
 *     tags: [Certification]
 *     summary: Generate a certification package bundle
 *     description: Generate the document bundle for a stored certification package.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: packageId
 *         required: true
 *         schema: { type: string }
 *         description: The certification package id.
 *     responses:
 *       '200':
 *         description: The generated package bundle (streamed archive).
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/:projectId/packages/:packageId/generate-bundle', ctrl.generatePackageBundleRoute)

/**
 * @openapi
 * /certification/{projectId}/audit-package:
 *   post:
 *     tags: [Certification]
 *     summary: Generate the one-command audit package (PSAC)
 *     description: >-
 *       Generate the opinionated, regulator-shaped certification audit
 *       package (N-2.2). Composes live project state — not tied to a stored
 *       CertPackage row. Streams a ZIP containing the artefact in DOCX, PDF,
 *       and JSON forms plus a manifest. PSAC is the supported artefact type.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: query
 *         name: artefactType
 *         schema: { type: string, enum: [PSAC] }
 *         description: The regulator artefact to generate. Defaults to PSAC.
 *     responses:
 *       '200':
 *         description: The audit package, streamed as a ZIP archive.
 *         content:
 *           application/zip:
 *             schema: { type: string, format: binary }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// N-2.2 (#425): the one-command opinionated audit package (PSAC). Composes
// live project state — not tied to a stored CertPackage row. projectId is
// resolved + membership-checked by router.param('projectId') above.
router.post('/:projectId/audit-package', ctrl.generateAuditPackageRoute)

/**
 * @openapi
 * /certification/{projectId}/context:
 *   get:
 *     tags: [Certification]
 *     summary: Get the certification context
 *     description: Return the project's certification context (standard, DAL, applicability).
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The certification context.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { standard: 'DO-178C', dal: 'B' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Certification]
 *     summary: Update the certification context
 *     description: Update the project's certification context.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               standard: { type: string }
 *               dal: { type: string }
 *           example: { standard: 'DO-178C', dal: 'A' }
 *     responses:
 *       '200':
 *         description: Context updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { standard: 'DO-178C', dal: 'A' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Context
router.get('/:projectId/context', ctrl.getContext)
router.patch('/:projectId/context', ctrl.updateContext)

/**
 * @openapi
 * /certification/{projectId}/baselines:
 *   get:
 *     tags: [Certification]
 *     summary: List certification baselines
 *     description: Return the project's certification baselines.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The list of certification baselines.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: cbl_1, name: 'PSAC Baseline' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a certification baseline
 *     description: Snapshot the certification state into a new baseline.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *           example: { name: 'PSAC Baseline' }
 *     responses:
 *       '201':
 *         description: Certification baseline created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: cbl_1, name: 'PSAC Baseline' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Baselines
router.get('/:projectId/baselines', ctrl.getBaselines)
router.post('/:projectId/baselines', ctrl.createBaseline)

/**
 * @openapi
 * /certification/{projectId}/releases:
 *   get:
 *     tags: [Certification]
 *     summary: List certification releases
 *     description: Return the project's certification releases.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The list of certification releases.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: rel_1, name: 'Release 1.0' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a certification release
 *     description: Create a new certification release record.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *           example: { name: 'Release 1.0' }
 *     responses:
 *       '201':
 *         description: Certification release created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: rel_1, name: 'Release 1.0' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Releases
router.get('/:projectId/releases', ctrl.getReleases)
router.post('/:projectId/releases', ctrl.createRelease)

/**
 * @openapi
 * /certification/{projectId}/objectives:
 *   get:
 *     tags: [Certification]
 *     summary: List certification objectives
 *     description: >-
 *       Return the project's certification objectives — the objective
 *       catalogue for the project's standard.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The list of certification objectives.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: obj_1, code: 'A-3.1', satisfied: false }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a certification objective
 *     description: Add a certification objective to the project.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string }
 *               description: { type: string }
 *           example: { code: 'A-3.1', description: 'High-level requirements comply with system requirements.' }
 *     responses:
 *       '201':
 *         description: Objective created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: obj_1, code: 'A-3.1' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Objectives
router.get('/:projectId/objectives', ctrl.getObjectives)
router.post('/:projectId/objectives', ctrl.createObjective)

/**
 * @openapi
 * /certification/{projectId}/objectives/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a certification objective
 *     description: Update a certification objective's fields.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The objective id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               description: { type: string }
 *               satisfied: { type: boolean }
 *           example: { satisfied: true }
 *     responses:
 *       '200':
 *         description: Objective updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: obj_1, satisfied: true } }
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
router.patch('/:projectId/objectives/:id', ctrl.updateObjective)

/**
 * @openapi
 * /certification/{projectId}/objectives/{objectiveId}/requirement-links:
 *   get:
 *     tags: [Certification]
 *     summary: List an objective's requirement links
 *     description: Return the requirements traced to a certification objective.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema: { type: string }
 *         description: The objective id.
 *     responses:
 *       '200':
 *         description: The objective's requirement links.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: lnk_1, requirementId: req_1 }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Link a requirement to an objective
 *     description: Trace a requirement to a certification objective.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema: { type: string }
 *         description: The objective id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [requirementId]
 *             properties:
 *               requirementId: { type: string }
 *           example: { requirementId: req_1 }
 *     responses:
 *       '201':
 *         description: Requirement linked to the objective.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: lnk_1, requirementId: req_1 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Objective–Requirement traceability
router.get('/:projectId/objectives/:objectiveId/requirement-links', ctrl.getObjectiveRequirementLinks)
router.post('/:projectId/objectives/:objectiveId/requirement-links', ctrl.addObjectiveRequirementLink)

/**
 * @openapi
 * /certification/{projectId}/objectives/{objectiveId}/requirement-links/{linkId}:
 *   delete:
 *     tags: [Certification]
 *     summary: Remove an objective-requirement link
 *     description: Untrace a requirement from a certification objective.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: objectiveId
 *         required: true
 *         schema: { type: string }
 *         description: The objective id.
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema: { type: string }
 *         description: The link id to remove.
 *     responses:
 *       '200':
 *         description: Link removed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Link removed' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/:projectId/objectives/:objectiveId/requirement-links/:linkId', ctrl.removeObjectiveRequirementLink)

/**
 * @openapi
 * /certification/{projectId}/compliance-matrix:
 *   get:
 *     tags: [Certification]
 *     summary: Get the compliance matrix
 *     description: Return the project's certification compliance matrix.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The compliance matrix.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { rows: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Compliance matrix
router.get('/:projectId/compliance-matrix', ctrl.getComplianceMatrix)

/**
 * @openapi
 * /certification/{projectId}/compliance-matrix/rows:
 *   put:
 *     tags: [Certification]
 *     summary: Upsert a compliance-matrix row
 *     description: Create or update a single row of the compliance matrix.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               objectiveCode: { type: string }
 *               status: { type: string }
 *           example: { objectiveCode: 'A-3.1', status: 'Satisfied' }
 *     responses:
 *       '200':
 *         description: Compliance-matrix row upserted.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { objectiveCode: 'A-3.1', status: 'Satisfied' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.put('/:projectId/compliance-matrix/rows', ctrl.upsertComplianceMatrixRow)

/**
 * @openapi
 * /certification/{projectId}/findings:
 *   get:
 *     tags: [Certification]
 *     summary: List certification findings
 *     description: Return the project's certification findings.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The list of findings.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: fnd_1, title: 'Missing MoC', status: 'Open' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a certification finding
 *     description: Record a new certification finding.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
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
 *           example: { title: 'Missing MoC for A-3.1' }
 *     responses:
 *       '201':
 *         description: Finding created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: fnd_1, title: 'Missing MoC for A-3.1' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Findings
router.get('/:projectId/findings', ctrl.getFindings)
router.post('/:projectId/findings', ctrl.createFinding)

/**
 * @openapi
 * /certification/{projectId}/findings/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a certification finding
 *     description: Update a certification finding's fields.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The finding id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *           example: { status: 'Closed' }
 *     responses:
 *       '200':
 *         description: Finding updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: fnd_1, status: 'Closed' } }
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
router.patch('/:projectId/findings/:id', ctrl.updateFinding)

/**
 * @openapi
 * /certification/{projectId}/review-log:
 *   get:
 *     tags: [Certification]
 *     summary: Get the review log
 *     description: Return the project's certification review-log entries.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The review-log entries.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: rl_1, summary: 'PSAC review' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a review-log entry
 *     description: Add an entry to the certification review log.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [summary]
 *             properties:
 *               summary: { type: string }
 *           example: { summary: 'PSAC stage-2 review' }
 *     responses:
 *       '201':
 *         description: Review-log entry created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: rl_1, summary: 'PSAC stage-2 review' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Review log
router.get('/:projectId/review-log', ctrl.getReviewLog)
router.post('/:projectId/review-log', ctrl.createReviewLogEntry)

/**
 * @openapi
 * /certification/{projectId}/review-log/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a review-log entry
 *     description: Update a certification review-log entry.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The review-log entry id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               summary: { type: string }
 *           example: { summary: 'PSAC stage-2 review — closed' }
 *     responses:
 *       '200':
 *         description: Review-log entry updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: rl_1, summary: 'PSAC stage-2 review — closed' } }
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
router.patch('/:projectId/review-log/:id', ctrl.updateReviewLogEntry)

/**
 * @openapi
 * /certification/{projectId}/activity-log:
 *   get:
 *     tags: [Certification]
 *     summary: Get the activity log
 *     description: Return the project's certification activity-log entries.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The activity-log entries.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: al_1, action: 'objective-satisfied' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Append an activity-log entry
 *     description: Append an entry to the certification activity log.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [action]
 *             properties:
 *               action: { type: string }
 *           example: { action: 'objective-satisfied' }
 *     responses:
 *       '201':
 *         description: Activity entry appended.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: al_1, action: 'objective-satisfied' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Activity log
router.get('/:projectId/activity-log', ctrl.getActivityLog)
router.post('/:projectId/activity-log', ctrl.appendActivity)

/**
 * @openapi
 * /certification/{projectId}/readiness-gates:
 *   get:
 *     tags: [Certification]
 *     summary: List readiness gates
 *     description: Return the project's certification readiness gates.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The readiness gates.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: rg_1, name: 'PDR gate', passed: false }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Readiness gates
router.get('/:projectId/readiness-gates', ctrl.getReadinessGates)

/**
 * @openapi
 * /certification/{projectId}/readiness-gates/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a readiness gate
 *     description: Update a certification readiness gate.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The readiness-gate id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               passed: { type: boolean }
 *           example: { passed: true }
 *     responses:
 *       '200':
 *         description: Readiness gate updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: rg_1, passed: true } }
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
router.patch('/:projectId/readiness-gates/:id', ctrl.updateReadinessGate)

/**
 * @openapi
 * /certification/{projectId}/packages:
 *   get:
 *     tags: [Certification]
 *     summary: List certification packages
 *     description: Return the project's stored certification packages.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The list of certification packages.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: pkg_1, name: 'PSAC package' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a certification package
 *     description: Create a new stored certification package.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *           example: { name: 'PSAC package' }
 *     responses:
 *       '201':
 *         description: Certification package created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: pkg_1, name: 'PSAC package' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Packages
router.get('/:projectId/packages', ctrl.getPackages)
router.post('/:projectId/packages', ctrl.createPackage)

/**
 * @openapi
 * /certification/{projectId}/correspondence:
 *   get:
 *     tags: [Certification]
 *     summary: List authority correspondence
 *     description: Return the project's authority-correspondence records.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The correspondence records.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: cor_1, subject: 'PSAC submission' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create an authority-correspondence record
 *     description: Record a new piece of authority correspondence.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subject]
 *             properties:
 *               subject: { type: string }
 *           example: { subject: 'PSAC submission' }
 *     responses:
 *       '201':
 *         description: Correspondence record created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: cor_1, subject: 'PSAC submission' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Authority: Correspondence
router.get('/:projectId/correspondence', ctrl.getCorrespondence)
router.post('/:projectId/correspondence', ctrl.createCorrespondence)

/**
 * @openapi
 * /certification/{projectId}/correspondence/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update an authority-correspondence record
 *     description: Update an authority-correspondence record.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The correspondence record id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               subject: { type: string }
 *           example: { subject: 'PSAC submission — acknowledged' }
 *     responses:
 *       '200':
 *         description: Correspondence record updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: cor_1, subject: 'PSAC submission — acknowledged' } }
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
 *   delete:
 *     tags: [Certification]
 *     summary: Delete an authority-correspondence record
 *     description: Delete an authority-correspondence record.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The correspondence record id.
 *     responses:
 *       '200':
 *         description: Correspondence record deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Correspondence deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/:projectId/correspondence/:id', ctrl.updateCorrespondence)
router.delete('/:projectId/correspondence/:id', ctrl.deleteCorrespondence)

/**
 * @openapi
 * /certification/{projectId}/meetings:
 *   get:
 *     tags: [Certification]
 *     summary: List authority meetings
 *     description: Return the project's authority-meeting records.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The meeting records.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: mtg_1, title: 'SOI-1' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create an authority meeting
 *     description: Record a new authority meeting.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title: { type: string }
 *           example: { title: 'SOI-1' }
 *     responses:
 *       '201':
 *         description: Meeting created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: mtg_1, title: 'SOI-1' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Authority: Meetings & Action items
router.get('/:projectId/meetings', ctrl.getMeetings)
router.post('/:projectId/meetings', ctrl.createMeeting)

/**
 * @openapi
 * /certification/{projectId}/meetings/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update an authority meeting
 *     description: Update an authority-meeting record.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The meeting id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title: { type: string }
 *           example: { title: 'SOI-1 — minutes finalised' }
 *     responses:
 *       '200':
 *         description: Meeting updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: mtg_1, title: 'SOI-1 — minutes finalised' } }
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
router.patch('/:projectId/meetings/:id', ctrl.updateMeeting)

/**
 * @openapi
 * /certification/{projectId}/meetings/{meetingId}/action-items:
 *   post:
 *     tags: [Certification]
 *     summary: Create a meeting action item
 *     description: Add an action item to an authority meeting.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: meetingId
 *         required: true
 *         schema: { type: string }
 *         description: The meeting id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [description]
 *             properties:
 *               description: { type: string }
 *           example: { description: 'Provide updated trace matrix.' }
 *     responses:
 *       '201':
 *         description: Action item created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: ai_1, description: 'Provide updated trace matrix.' } }
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
router.post('/:projectId/meetings/:meetingId/action-items', ctrl.createActionItem)

/**
 * @openapi
 * /certification/{projectId}/meetings/{meetingId}/action-items/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a meeting action item
 *     description: Update an action item of an authority meeting.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: meetingId
 *         required: true
 *         schema: { type: string }
 *         description: The meeting id.
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The action-item id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *           example: { status: 'Done' }
 *     responses:
 *       '200':
 *         description: Action item updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: ai_1, status: 'Done' } }
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
 *   delete:
 *     tags: [Certification]
 *     summary: Delete a meeting action item
 *     description: Delete an action item of an authority meeting.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: meetingId
 *         required: true
 *         schema: { type: string }
 *         description: The meeting id.
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The action-item id.
 *     responses:
 *       '200':
 *         description: Action item deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Action item deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/:projectId/meetings/:meetingId/action-items/:id', ctrl.updateActionItem)
router.delete('/:projectId/meetings/:meetingId/action-items/:id', ctrl.deleteActionItem)

/**
 * @openapi
 * /certification/{projectId}/plan:
 *   get:
 *     tags: [Certification]
 *     summary: Get the certification plan
 *     description: Return the project's certification plan.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The certification plan.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { standard: 'DO-178C', phases: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   put:
 *     tags: [Certification]
 *     summary: Create or update the certification plan
 *     description: Upsert the project's certification plan.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               standard: { type: string }
 *           example: { standard: 'DO-178C' }
 *     responses:
 *       '200':
 *         description: Certification plan upserted.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { standard: 'DO-178C' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Certification plan & milestones
router.get('/:projectId/plan', ctrl.getPlan)
router.put('/:projectId/plan', ctrl.upsertPlan)

/**
 * @openapi
 * /certification/{projectId}/milestones:
 *   get:
 *     tags: [Certification]
 *     summary: List certification milestones
 *     description: Return the project's certification milestones.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The list of certification milestones.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: ms_1, name: 'PDR', date: '2026-09-01' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a certification milestone
 *     description: Add a milestone to the certification plan.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               date: { type: string, format: date }
 *           example: { name: 'PDR', date: '2026-09-01' }
 *     responses:
 *       '201':
 *         description: Milestone created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: ms_1, name: 'PDR' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/:projectId/milestones', ctrl.getMilestones)
router.post('/:projectId/milestones', ctrl.createMilestone)

/**
 * @openapi
 * /certification/{projectId}/milestones/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a certification milestone
 *     description: Update a certification milestone.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The milestone id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               date: { type: string, format: date }
 *           example: { date: '2026-10-01' }
 *     responses:
 *       '200':
 *         description: Milestone updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: ms_1, date: '2026-10-01' } }
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
router.patch('/:projectId/milestones/:id', ctrl.updateMilestone)

/**
 * @openapi
 * /certification/{projectId}/metrics:
 *   get:
 *     tags: [Certification]
 *     summary: Get certification dashboard metrics
 *     description: Return aggregate dashboard metrics for the project's certification state.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The certification dashboard metrics.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { objectivesSatisfied: 12, objectivesTotal: 30 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Dashboard metrics
router.get('/:projectId/metrics', ctrl.getCertificationMetrics)

/**
 * @openapi
 * /certification/{projectId}/checklists:
 *   get:
 *     tags: [Certification]
 *     summary: List certification checklists
 *     description: Return the project's certification checklists.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     responses:
 *       '200':
 *         description: The list of certification checklists.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: array, items: { type: object } }
 *             example: { success: true, data: [{ id: chk_1, name: 'SOI-2 checklist' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Certification]
 *     summary: Create a certification checklist
 *     description: Create a new certification checklist.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *           example: { name: 'SOI-2 checklist' }
 *     responses:
 *       '201':
 *         description: Checklist created.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: chk_1, name: 'SOI-2 checklist' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// Checklists & sign-offs
router.get('/:projectId/checklists', ctrl.getChecklists)
router.post('/:projectId/checklists', ctrl.createChecklist)

/**
 * @openapi
 * /certification/{projectId}/checklists/{checklistId}/items/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a checklist item
 *     description: Update an item of a certification checklist.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema: { type: string }
 *         description: The checklist id.
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The checklist-item id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checked: { type: boolean }
 *           example: { checked: true }
 *     responses:
 *       '200':
 *         description: Checklist item updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: itm_1, checked: true } }
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
router.patch('/:projectId/checklists/:checklistId/items/:id', ctrl.updateChecklistItem)

/**
 * @openapi
 * /certification/{projectId}/checklists/{checklistId}/sign-offs:
 *   post:
 *     tags: [Certification]
 *     summary: Add a sign-off to a checklist
 *     description: >-
 *       Record a sign-off on a certification checklist. The signer identity
 *       is derived from the authenticated session — never from the request
 *       body (issue #163). Project membership is enforced inside the
 *       controller.
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: checklistId
 *         required: true
 *         schema: { type: string }
 *         description: The checklist id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, description: 'The signing role / discipline.' }
 *           example: { role: 'Verification Engineer' }
 *     responses:
 *       '201':
 *         description: Sign-off recorded.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: so_1, signerUserId: usr_1 } }
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
// Sign-off routes enforce project membership inside the controller (issue #163)
router.post('/:projectId/checklists/:checklistId/sign-offs', ctrl.addSignOff)

/**
 * @openapi
 * /certification/{projectId}/sign-offs/{id}:
 *   patch:
 *     tags: [Certification]
 *     summary: Update a sign-off
 *     description: >-
 *       Update a certification sign-off. The signer identity is derived from
 *       the authenticated session — never from the request body (issue
 *       #163).
 *     parameters:
 *       - $ref: '#/components/parameters/CertProjectId'
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The sign-off id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status: { type: string }
 *           example: { status: 'Revoked' }
 *     responses:
 *       '200':
 *         description: Sign-off updated.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data: { type: object }
 *             example: { success: true, data: { id: so_1, status: 'Revoked' } }
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
router.patch('/:projectId/sign-offs/:id', ctrl.updateSignOff)

export default router
