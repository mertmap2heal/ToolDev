import { Router, NextFunction } from 'express'
import multer from 'multer'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as mocController from '../controllers/verification/moc.controller'
import * as methodController from '../controllers/verification/method.controller'
import * as setupController from '../controllers/verification/setup.controller'
import * as testCaseController from '../controllers/verification/testCase.controller'
import * as testPlanController from '../controllers/verification/testPlan.controller'
import * as evidenceController from '../controllers/verification/evidence.controller'
import * as coverageController from '../controllers/verification/coverage.controller'
import * as reviewController from '../controllers/verification/review.controller'
import * as nonconformityController from '../controllers/verification/nonconformity.controller'
import * as baselineController from '../controllers/verification/baseline.controller'
import * as settingsController from '../controllers/verification/settings.controller'
import * as overviewController from '../controllers/verification/overview.controller'
import * as customOptionController from '../controllers/verification/customOption.controller'
import * as testResultController from '../controllers/verification/testResult.controller'
import * as customSectionController from '../controllers/verification/customSection.controller'
import * as templateController from '../controllers/verification/template.controller'
import * as runIngestionController from '../controllers/verificationV2/runIngestion.controller'
import * as testRunController from '../controllers/verification/testRun.controller'
import * as auditController from '../controllers/verification/audit.controller'
import { reportService } from '../services/verification/report.service'
import { traceabilityMatrixService } from '../services/verification/TraceabilityMatrixService'
import { exportTemplateService } from '../services/verification/exportTemplate.service'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

/**
 * multer instance for the test-result file-ingest endpoint (N-2.4).
 * memoryStorage keeps the file in a Buffer (no disk write); the 8 MB cap
 * matches the ReqIF import cap (#298) and bounds the XML-parser workload.
 */
const testResultUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
})

/**
 * Wrap multer's single-file middleware so a multer error (e.g. the file
 * exceeding the 8 MB cap) becomes a clean 400 instead of Express's default
 * 500. A successful parse passes control to the controller.
 */
function uploadTestResultFile(req: AuthRequest, res: Response, next: NextFunction): void {
  testResultUpload.single('file')(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Uploaded file exceeds the 8 MB limit'
            : `Upload error: ${err.message}`
        res.status(400).json({ success: false, error: msg })
        return
      }
      res.status(400).json({
        success: false,
        error: `Upload error: ${(err as Error)?.message || 'invalid upload'}`,
      })
      return
    }
    next()
  })
}

// A) MoC Endpoints
// MoC rows are system-wide compliance definitions; only admins may mutate them (#132).
/**
 * @openapi
 * /verification/moc:
 *   get:
 *     tags: [Verification]
 *     summary: List Methods of Compliance
 *     description: Return the system-wide Method-of-Compliance (MoC) definitions.
 *     responses:
 *       '200':
 *         description: The list of MoC definitions.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ code: 'MC1', name: 'Compliance Statement' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a Method of Compliance
 *     description: Create a system-wide MoC definition. Admin-only.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, name]
 *             properties: { code: { type: string }, name: { type: string } }
 *           example: { code: 'MC1', name: 'Compliance Statement' }
 *     responses:
 *       '201':
 *         description: MoC created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { code: 'MC1', name: 'Compliance Statement' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/moc', mocController.getMocs)
/**
 * @openapi
 * /verification/moc/{code}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a Method of Compliance by code
 *     description: Return one MoC definition by its code.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: The MoC code.
 *     responses:
 *       '200':
 *         description: The requested MoC definition.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { code: 'MC1', name: 'Compliance Statement' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a Method of Compliance
 *     description: Update a system-wide MoC definition. Admin-only.
 *     parameters:
 *       - in: path
 *         name: code
 *         required: true
 *         schema: { type: string }
 *         description: The MoC code.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { name: { type: string } }
 *           example: { name: 'Compliance Statement (rev B)' }
 *     responses:
 *       '200':
 *         description: MoC updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { code: 'MC1', name: 'Compliance Statement (rev B)' } }
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
router.get('/moc/:code', mocController.getMocByCode)
router.post('/moc', requireAdmin, mocController.createMoc)
router.patch('/moc/:code', requireAdmin, mocController.updateMoc)

// B) Methods
/**
 * @openapi
 * /verification/methods/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List verification methods
 *     description: Return the project's verification methods.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of verification methods.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: vm_1, name: 'Functional Test' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a verification method
 *     description: Create a verification method in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string }, type: { type: string, enum: [Test, Analysis, Inspection, Demonstration] } }
 *           example: { name: 'Functional Test', type: 'Test' }
 *     responses:
 *       '201':
 *         description: Verification method created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vm_1, name: 'Functional Test' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/methods/:projectId', methodController.getMethods)
router.post('/methods/:projectId', methodController.createMethod)
/**
 * @openapi
 * /verification/methods/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a verification method
 *     description: Return one verification method by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested verification method.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vm_1, name: 'Functional Test' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a verification method
 *     description: Update a verification method.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { name: { type: string } }
 *           example: { name: 'Functional Test (rev B)' }
 *     responses:
 *       '200':
 *         description: Verification method updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vm_1, name: 'Functional Test (rev B)' } }
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
router.get('/methods/:projectId/:id', methodController.getMethod)
router.patch('/methods/:projectId/:id', methodController.updateMethod)
/**
 * @openapi
 * /verification/methods/{projectId}/{id}/approve:
 *   post:
 *     tags: [Verification]
 *     summary: Approve a verification method
 *     description: Mark a verification method as approved.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Verification method approved.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vm_1, status: 'Approved' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/methods/:projectId/:id/approve', methodController.approveMethod)
/**
 * @openapi
 * /verification/methods/{projectId}/{id}/deprecate:
 *   post:
 *     tags: [Verification]
 *     summary: Deprecate a verification method
 *     description: Mark a verification method as deprecated.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Verification method deprecated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vm_1, status: 'Deprecated' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/methods/:projectId/:id/deprecate', methodController.deprecateMethod)

// C) Test Setups
/**
 * @openapi
 * /verification/setups/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List test setups
 *     description: Return the project's test setups.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of test setups.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: ts_1, name: 'Brake Rig' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a test setup
 *     description: Create a test setup in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string } }
 *           example: { name: 'Brake Rig' }
 *     responses:
 *       '201':
 *         description: Test setup created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ts_1, name: 'Brake Rig' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/setups/:projectId', setupController.getSetups)
router.post('/setups/:projectId', setupController.createSetup)
/**
 * @openapi
 * /verification/setups/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a test setup
 *     description: Return one test setup by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested test setup.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ts_1, name: 'Brake Rig' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a test setup
 *     description: Update a test setup.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { name: { type: string } }
 *           example: { name: 'Brake Rig (rev B)' }
 *     responses:
 *       '200':
 *         description: Test setup updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ts_1, name: 'Brake Rig (rev B)' } }
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
 *     tags: [Verification]
 *     summary: Delete a test setup
 *     description: Delete a test setup.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test setup deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Setup deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/setups/:projectId/:id', setupController.getSetup)
router.patch('/setups/:projectId/:id', setupController.updateSetup)
router.delete('/setups/:projectId/:id', setupController.deleteSetup)
/**
 * @openapi
 * /verification/setups/{projectId}/{id}/approve:
 *   post:
 *     tags: [Verification]
 *     summary: Approve a test setup
 *     description: Mark a test setup as approved.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test setup approved.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ts_1, status: 'Approved' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/setups/:projectId/:id/approve', setupController.approveSetup)
/**
 * @openapi
 * /verification/setups/{projectId}/{id}/deprecate:
 *   post:
 *     tags: [Verification]
 *     summary: Deprecate a test setup
 *     description: Mark a test setup as deprecated.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test setup deprecated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ts_1, status: 'Deprecated' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/setups/:projectId/:id/deprecate', setupController.deprecateSetup)
/**
 * @openapi
 * /verification/setups/{projectId}/{id}/diagram/export:
 *   post:
 *     tags: [Verification]
 *     summary: Export a test-setup diagram
 *     description: Generate and export the diagram for a test setup.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The exported diagram.
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/setups/:projectId/:id/diagram/export', setupController.exportSetupDiagram)
/**
 * @openapi
 * /verification/setups/{projectId}/{setupId}/components/{componentId}/manual:
 *   post:
 *     tags: [Verification]
 *     summary: Upload a component manual to a test setup
 *     description: >-
 *       Upload a PDF component manual against a component of a test setup
 *       (multipart form upload).
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: setupId
 *         required: true
 *         schema: { type: string }
 *         description: The test-setup id.
 *       - in: path
 *         name: componentId
 *         required: true
 *         schema: { type: string }
 *         description: The component id.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties: { file: { type: string, format: binary } }
 *     responses:
 *       '200':
 *         description: Manual uploaded.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Manual uploaded' }
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
router.post('/setups/:projectId/:setupId/components/:componentId/manual', setupController.uploadComponentManual)

// C.1) Custom Options
/**
 * @openapi
 * /verification/custom-options/{projectId}/{optionType}:
 *   get:
 *     tags: [Verification]
 *     summary: List custom options of a type
 *     description: Return the project's custom options for a given option type.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: optionType
 *         required: true
 *         schema: { type: string }
 *         description: The custom-option type key.
 *     responses:
 *       '200':
 *         description: The custom options of that type.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: co_1, value: 'High-bay lab' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/custom-options/:projectId/:optionType', customOptionController.getCustomOptions)
/**
 * @openapi
 * /verification/custom-options/{projectId}:
 *   post:
 *     tags: [Verification]
 *     summary: Add a custom option
 *     description: Add a custom option for a verification option type.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [optionType, value]
 *             properties: { optionType: { type: string }, value: { type: string } }
 *           example: { optionType: 'location', value: 'High-bay lab' }
 *     responses:
 *       '201':
 *         description: Custom option created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: co_1, value: 'High-bay lab' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/custom-options/:projectId', customOptionController.addCustomOption)
/**
 * @openapi
 * /verification/custom-options/{projectId}/{id}:
 *   delete:
 *     tags: [Verification]
 *     summary: Remove a custom option
 *     description: Delete a verification custom option.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Custom option removed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Option removed' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/custom-options/:projectId/:id', customOptionController.removeCustomOption)

// D) Test Cases
/**
 * @openapi
 * /verification/test-cases/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List test cases
 *     description: Return the project's verification test cases.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of test cases.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: tc_1, key: 'TC-001', title: 'Brake decel test' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a test case
 *     description: Create a verification test case in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties: { title: { type: string }, description: { type: string } }
 *           example: { title: 'Brake decel test' }
 *     responses:
 *       '201':
 *         description: Test case created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tc_1, key: 'TC-001' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-cases/:projectId', testCaseController.getTestCases)
router.post('/test-cases/:projectId', testCaseController.createTestCase)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/run-results:
 *   get:
 *     tags: [Verification]
 *     summary: Get a test case's run results
 *     description: Return the ingested test-run results for a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test case's run results.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ runId: tr_1, status: 'PASS' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-cases/:projectId/:id/run-results', runIngestionController.getRunResultsForTestCase)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a test case
 *     description: Return one verification test case by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested test case.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tc_1, key: 'TC-001' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a test case
 *     description: Update a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { title: { type: string } }
 *           example: { title: 'Brake decel test (rev B)' }
 *     responses:
 *       '200':
 *         description: Test case updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tc_1, title: 'Brake decel test (rev B)' } }
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
 *     tags: [Verification]
 *     summary: Delete a test case
 *     description: Delete a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test case deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Test case deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-cases/:projectId/:id', testCaseController.getTestCase)
router.patch('/test-cases/:projectId/:id', testCaseController.updateTestCase)
router.delete('/test-cases/:projectId/:id', testCaseController.deleteTestCase)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/review:
 *   post:
 *     tags: [Verification]
 *     summary: Submit a test case for review
 *     description: Move a verification test case into the review state.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test case submitted for review.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tc_1, status: 'InReview' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-cases/:projectId/:id/review', testCaseController.reviewTestCase)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/approve:
 *   post:
 *     tags: [Verification]
 *     summary: Approve a test case
 *     description: Mark a verification test case as approved.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test case approved.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tc_1, status: 'Approved' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-cases/:projectId/:id/approve', testCaseController.approveTestCase)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/version:
 *   post:
 *     tags: [Verification]
 *     summary: Create a new test-case version
 *     description: Snapshot a verification test case into a new version.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '201':
 *         description: New test-case version created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tc_1, version: 2 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-cases/:projectId/:id/version', testCaseController.createTestCaseVersion)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/link-setup:
 *   post:
 *     tags: [Verification]
 *     summary: Link a test setup to a test case
 *     description: Associate a test setup with a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [setupId]
 *             properties: { setupId: { type: string } }
 *           example: { setupId: ts_1 }
 *     responses:
 *       '200':
 *         description: Setup linked to the test case.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tc_1, setupId: ts_1 } }
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
router.post('/test-cases/:projectId/:id/link-setup', testCaseController.linkSetup)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/unlink-setup:
 *   post:
 *     tags: [Verification]
 *     summary: Unlink a test setup from a test case
 *     description: Remove the association between a test setup and a test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [setupId]
 *             properties: { setupId: { type: string } }
 *           example: { setupId: ts_1 }
 *     responses:
 *       '200':
 *         description: Setup unlinked from the test case.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Setup unlinked' }
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
router.post('/test-cases/:projectId/:id/unlink-setup', testCaseController.unlinkSetup)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/verification-links:
 *   get:
 *     tags: [Verification]
 *     summary: List a test case's verification links
 *     description: Return the verification elements (requirements, etc.) linked to a test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test case's verification links.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: vl_1, requirementId: req_1 }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Link a verification element to a test case
 *     description: Link a verification element (requirement) to a test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { requirementId: { type: string } }
 *           example: { requirementId: req_1 }
 *     responses:
 *       '201':
 *         description: Verification element linked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vl_1, requirementId: req_1 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-cases/:projectId/:id/verification-links', testCaseController.getVerificationLinks)
router.post('/test-cases/:projectId/:id/verification-links', testCaseController.linkVerificationElement)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{id}/verification-links/{linkId}:
 *   delete:
 *     tags: [Verification]
 *     summary: Unlink a verification element from a test case
 *     description: Remove a verification-element link from a test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema: { type: string }
 *         description: The verification-link id.
 *     responses:
 *       '200':
 *         description: Verification element unlinked.
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
router.delete('/test-cases/:projectId/:id/verification-links/:linkId', testCaseController.unlinkVerificationElement)

// Custom Sections
/**
 * @openapi
 * /verification/test-cases/{projectId}/{testCaseId}/custom-sections:
 *   get:
 *     tags: [Verification]
 *     summary: List a test case's custom sections
 *     description: Return the custom sections of a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: testCaseId
 *         required: true
 *         schema: { type: string }
 *         description: The test-case id.
 *     responses:
 *       '200':
 *         description: The test case's custom sections.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: cs_1, title: 'Preconditions' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a test-case custom section
 *     description: Add a custom section to a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: testCaseId
 *         required: true
 *         schema: { type: string }
 *         description: The test-case id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties: { title: { type: string } }
 *           example: { title: 'Preconditions' }
 *     responses:
 *       '201':
 *         description: Custom section created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: cs_1, title: 'Preconditions' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-cases/:projectId/:testCaseId/custom-sections', customSectionController.getCustomSections)
router.post('/test-cases/:projectId/:testCaseId/custom-sections', customSectionController.createCustomSection)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{sectionId}/custom-sections:
 *   patch:
 *     tags: [Verification]
 *     summary: Update a test-case custom section
 *     description: Update a custom section of a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *         description: The custom-section id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { title: { type: string } }
 *           example: { title: 'Preconditions (rev B)' }
 *     responses:
 *       '200':
 *         description: Custom section updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: cs_1, title: 'Preconditions (rev B)' } }
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
 *     tags: [Verification]
 *     summary: Delete a test-case custom section
 *     description: Delete a custom section of a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *         description: The custom-section id.
 *     responses:
 *       '200':
 *         description: Custom section deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Section deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/test-cases/:projectId/:sectionId/custom-sections', customSectionController.updateCustomSection)
router.delete('/test-cases/:projectId/:sectionId/custom-sections', customSectionController.deleteCustomSection)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{testCaseId}/custom-sections/reorder:
 *   post:
 *     tags: [Verification]
 *     summary: Reorder a test case's custom sections
 *     description: Reorder the custom sections of a verification test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: testCaseId
 *         required: true
 *         schema: { type: string }
 *         description: The test-case id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { order: { type: array, items: { type: string } } }
 *           example: { order: [cs_2, cs_1] }
 *     responses:
 *       '200':
 *         description: Custom sections reordered.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Sections reordered' }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-cases/:projectId/:testCaseId/custom-sections/reorder', customSectionController.reorderSections)

// Section Images
/**
 * @openapi
 * /verification/test-cases/{projectId}/{sectionId}/custom-sections/images:
 *   post:
 *     tags: [Verification]
 *     summary: Upload a custom-section image
 *     description: Upload an image into a test-case custom section (multipart form upload).
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string }
 *         description: The custom-section id.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties: { file: { type: string, format: binary } }
 *     responses:
 *       '200':
 *         description: Image uploaded.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: img_1 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-cases/:projectId/:sectionId/custom-sections/images', customSectionController.uploadImage)
/**
 * @openapi
 * /verification/test-cases/{projectId}/{imageId}/custom-sections/images:
 *   delete:
 *     tags: [Verification]
 *     summary: Delete a custom-section image
 *     description: Delete an image from a test-case custom section.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema: { type: string }
 *         description: The section-image id.
 *     responses:
 *       '200':
 *         description: Image deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Image deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/test-cases/:projectId/:imageId/custom-sections/images', customSectionController.deleteImage)

// E) Test Plans
/**
 * @openapi
 * /verification/test-plans/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List test plans
 *     description: Return the project's verification test plans.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of test plans.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: tp_1, name: 'PDR Test Plan' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a test plan
 *     description: Create a verification test plan in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string } }
 *           example: { name: 'PDR Test Plan' }
 *     responses:
 *       '201':
 *         description: Test plan created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tp_1, name: 'PDR Test Plan' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-plans/:projectId', testPlanController.getTestPlans)
router.post('/test-plans/:projectId', testPlanController.createTestPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a test plan
 *     description: Return one verification test plan by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested test plan.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tp_1, name: 'PDR Test Plan' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a test plan
 *     description: Update a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { name: { type: string } }
 *           example: { name: 'PDR Test Plan (rev B)' }
 *     responses:
 *       '200':
 *         description: Test plan updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tp_1, name: 'PDR Test Plan (rev B)' } }
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
 *     tags: [Verification]
 *     summary: Delete a test plan
 *     description: Delete a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test plan deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Test plan deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-plans/:projectId/:id', testPlanController.getTestPlan)
router.patch('/test-plans/:projectId/:id', testPlanController.updateTestPlan)
router.delete('/test-plans/:projectId/:id', testPlanController.deleteTestPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/add-case:
 *   post:
 *     tags: [Verification]
 *     summary: Add a test case to a test plan
 *     description: Add a verification test case to a test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testCaseId]
 *             properties: { testCaseId: { type: string } }
 *           example: { testCaseId: tc_1 }
 *     responses:
 *       '200':
 *         description: Test case added to the plan.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tp_1, testCaseIds: [tc_1] } }
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
router.post('/test-plans/:projectId/:id/add-case', testPlanController.addCaseToPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/remove-case:
 *   post:
 *     tags: [Verification]
 *     summary: Remove a test case from a test plan
 *     description: Remove a verification test case from a test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [testCaseId]
 *             properties: { testCaseId: { type: string } }
 *           example: { testCaseId: tc_1 }
 *     responses:
 *       '200':
 *         description: Test case removed from the plan.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Case removed' }
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
router.post('/test-plans/:projectId/:id/remove-case', testPlanController.removeCaseFromPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/link-setup:
 *   post:
 *     tags: [Verification]
 *     summary: Link a test setup to a test plan
 *     description: Associate a test setup with a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [setupId]
 *             properties: { setupId: { type: string } }
 *           example: { setupId: ts_1 }
 *     responses:
 *       '200':
 *         description: Setup linked to the test plan.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tp_1, setupId: ts_1 } }
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
router.post('/test-plans/:projectId/:id/link-setup', testPlanController.linkSetupToPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/link-setup/{setupId}:
 *   delete:
 *     tags: [Verification]
 *     summary: Unlink a test setup from a test plan
 *     description: Remove the association between a test setup and a test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *       - in: path
 *         name: setupId
 *         required: true
 *         schema: { type: string }
 *         description: The test-setup id to unlink.
 *     responses:
 *       '200':
 *         description: Setup unlinked from the test plan.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Setup unlinked' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/test-plans/:projectId/:id/link-setup/:setupId', testPlanController.unlinkSetupFromPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/reorder-cases:
 *   post:
 *     tags: [Verification]
 *     summary: Reorder a test plan's test cases
 *     description: Reorder the test cases within a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { order: { type: array, items: { type: string } } }
 *           example: { order: [tc_2, tc_1] }
 *     responses:
 *       '200':
 *         description: Test cases reordered.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Cases reordered' }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-plans/:projectId/:id/reorder-cases', testPlanController.reorderCases)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/approve:
 *   post:
 *     tags: [Verification]
 *     summary: Approve a test plan
 *     description: Mark a verification test plan as approved.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test plan approved.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tp_1, status: 'Approved' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-plans/:projectId/:id/approve', testPlanController.approveTestPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/close:
 *   post:
 *     tags: [Verification]
 *     summary: Close a test plan
 *     description: Close a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test plan closed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tp_1, status: 'Closed' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-plans/:projectId/:id/close', testPlanController.closeTestPlan)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/verification-links:
 *   get:
 *     tags: [Verification]
 *     summary: List a test plan's verification links
 *     description: Return the verification elements linked to a test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test plan's verification links.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: vl_1, requirementId: req_1 }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Link a verification element to a test plan
 *     description: Link a verification element (requirement) to a test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { requirementId: { type: string } }
 *           example: { requirementId: req_1 }
 *     responses:
 *       '201':
 *         description: Verification element linked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vl_1, requirementId: req_1 } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-plans/:projectId/:id/verification-links', testPlanController.getVerificationLinks)
router.post('/test-plans/:projectId/:id/verification-links', testPlanController.linkVerificationElement)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/verification-links/{linkId}:
 *   delete:
 *     tags: [Verification]
 *     summary: Unlink a verification element from a test plan
 *     description: Remove a verification-element link from a test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *       - in: path
 *         name: linkId
 *         required: true
 *         schema: { type: string }
 *         description: The verification-link id.
 *     responses:
 *       '200':
 *         description: Verification element unlinked.
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
router.delete('/test-plans/:projectId/:id/verification-links/:linkId', testPlanController.unlinkVerificationElement)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/revisions:
 *   post:
 *     tags: [Verification]
 *     summary: Create a test-plan revision
 *     description: Create a new revision of a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { note: { type: string } }
 *           example: { note: 'Revised after PDR comments.' }
 *     responses:
 *       '201':
 *         description: Test-plan revision created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rev_1, revision: 2 } }
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
router.post('/test-plans/:projectId/:id/revisions', testPlanController.createTestPlanRevision)
/**
 * @openapi
 * /verification/test-plans/{projectId}/{id}/revisions/{revisionId}:
 *   patch:
 *     tags: [Verification]
 *     summary: Update a test-plan revision
 *     description: Update a revision of a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *       - in: path
 *         name: revisionId
 *         required: true
 *         schema: { type: string }
 *         description: The revision id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { note: { type: string } }
 *           example: { note: 'Revised after PDR comments (updated).' }
 *     responses:
 *       '200':
 *         description: Test-plan revision updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rev_1, note: 'Revised after PDR comments (updated).' } }
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
 *     tags: [Verification]
 *     summary: Delete a test-plan revision
 *     description: Delete a revision of a verification test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *       - in: path
 *         name: revisionId
 *         required: true
 *         schema: { type: string }
 *         description: The revision id.
 *     responses:
 *       '200':
 *         description: Test-plan revision deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Revision deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.patch('/test-plans/:projectId/:id/revisions/:revisionId', testPlanController.updateTestPlanRevision)
router.delete('/test-plans/:projectId/:id/revisions/:revisionId', testPlanController.deleteTestPlanRevision)

// E.1) Verification audit trail (read-only)
/**
 * @openapi
 * /verification/audit/{projectId}/entity/{entityType}/{entityId}:
 *   get:
 *     tags: [Verification]
 *     summary: Get an entity's verification audit trail
 *     description: Return the read-only verification audit trail for one entity.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: entityType
 *         required: true
 *         schema: { type: string }
 *         description: The verification entity type (e.g. TEST_CASE).
 *       - in: path
 *         name: entityId
 *         required: true
 *         schema: { type: string }
 *         description: The entity id.
 *     responses:
 *       '200':
 *         description: The entity's verification audit trail.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ action: 'test-case:approve', at: '2026-05-17T10:00:00Z' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/audit/:projectId/entity/:entityType/:entityId', auditController.getEntityAuditTrail)
/**
 * @openapi
 * /verification/audit/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: Get the project verification audit trail
 *     description: Return the read-only verification audit trail for the whole project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The project's verification audit trail.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ action: 'test-plan:approve' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/audit/:projectId', auditController.getProjectAuditTrail)

// F) Evidence
/**
 * @openapi
 * /verification/evidence/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List verification evidence
 *     description: Return the project's verification evidence records.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of evidence records.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: ev_1, name: 'Brake test report' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a verification evidence record
 *     description: Create a verification evidence record in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string } }
 *           example: { name: 'Brake test report' }
 *     responses:
 *       '201':
 *         description: Evidence record created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ev_1, name: 'Brake test report' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/evidence/:projectId', evidenceController.getEvidence)
router.post('/evidence/:projectId', evidenceController.createEvidence)
/**
 * @openapi
 * /verification/evidence/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a verification evidence record
 *     description: Return one verification evidence record by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested evidence record.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ev_1, name: 'Brake test report' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/evidence/:projectId/:id', evidenceController.getEvidenceById)
/**
 * @openapi
 * /verification/evidence/{projectId}/{id}/link:
 *   post:
 *     tags: [Verification]
 *     summary: Link evidence to an artefact
 *     description: Link a verification evidence record to a verification artefact.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { linkedEntityType: { type: string }, linkedEntityId: { type: string } }
 *           example: { linkedEntityType: 'VerTestResult', linkedEntityId: tr_1 }
 *     responses:
 *       '200':
 *         description: Evidence linked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ev_1 } }
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
router.post('/evidence/:projectId/:id/link', evidenceController.linkEvidence)
/**
 * @openapi
 * /verification/evidence/{projectId}/{id}/unlink:
 *   post:
 *     tags: [Verification]
 *     summary: Unlink evidence from an artefact
 *     description: Remove an evidence link from a verification artefact.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { linkedEntityType: { type: string }, linkedEntityId: { type: string } }
 *           example: { linkedEntityType: 'VerTestResult', linkedEntityId: tr_1 }
 *     responses:
 *       '200':
 *         description: Evidence unlinked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Evidence unlinked' }
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
router.post('/evidence/:projectId/:id/unlink', evidenceController.unlinkEvidence)

// H) Coverage
/**
 * @openapi
 * /verification/coverage/{projectId}/moc-summary:
 *   get:
 *     tags: [Verification]
 *     summary: Get the MoC coverage summary
 *     description: Return the project's Method-of-Compliance coverage summary.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The MoC coverage summary.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { covered: 24, total: 30 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/coverage/:projectId/moc-summary', coverageController.getMocSummary)
/**
 * @openapi
 * /verification/coverage/{projectId}/plan/{planId}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a test plan's coverage
 *     description: Return the verification coverage for a single test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: planId
 *         required: true
 *         schema: { type: string }
 *         description: The test-plan id.
 *     responses:
 *       '200':
 *         description: The test plan's coverage.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { passed: 8, total: 10 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/coverage/:projectId/plan/:planId', coverageController.getPlanCoverage)

// H.1) Traceability Matrix (Req -> TC -> TestRun)
/**
 * @openapi
 * /verification/traceability-matrix/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: Get the verification traceability matrix
 *     description: >-
 *       Return the project's verification traceability matrix
 *       (Requirement -> Test Case -> Test Run).
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: query
 *         name: full
 *         schema: { type: boolean }
 *         description: When `true`, return the full matrix rather than the summary.
 *       - in: query
 *         name: considerPassedWithErrors
 *         schema: { type: boolean }
 *         description: Whether a run that passed with errors counts as a pass. Defaults to true.
 *     responses:
 *       '200':
 *         description: The traceability matrix.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { rows: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/traceability-matrix/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const considerPassedWithErrors = req.query.considerPassedWithErrors !== 'false'
    const full = req.query.full === 'true'
    if (full) {
      const data = await traceabilityMatrixService.getFullTraceabilityMatrix(projectId, { considerPassedWithErrors })
      res.json({ success: true, data })
    } else {
      const data = await traceabilityMatrixService.getTraceabilityMatrix(projectId, { considerPassedWithErrors })
      res.json({ success: true, data })
    }
  } catch (error: any) {
    console.error('Traceability matrix error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})
/**
 * @openapi
 * /verification/traceability-matrix/{projectId}/gaps:
 *   get:
 *     tags: [Verification]
 *     summary: Get verification coverage gaps
 *     description: >-
 *       Return the project's verification coverage gaps — requirements with
 *       no test coverage.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The coverage gaps.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ requirementId: req_1, key: 'REQ-001' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/traceability-matrix/:projectId/gaps', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const gaps = await traceabilityMatrixService.getCoverageGaps(projectId)
    res.json({ success: true, data: gaps })
  } catch (error: any) {
    console.error('Coverage gaps error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// I) Reviews
/**
 * @openapi
 * /verification/reviews/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List verification reviews
 *     description: Return the project's verification reviews.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of verification reviews.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: rv_1, name: 'TC review' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a verification review
 *     description: Create a verification review in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string } }
 *           example: { name: 'TC review' }
 *     responses:
 *       '201':
 *         description: Verification review created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rv_1, name: 'TC review' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reviews/:projectId', reviewController.getReviews)
router.post('/reviews/:projectId', reviewController.createReview)
/**
 * @openapi
 * /verification/reviews/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a verification review
 *     description: Return one verification review by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested verification review.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rv_1, name: 'TC review' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a verification review
 *     description: Update a verification review.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { name: { type: string } }
 *           example: { name: 'TC review (rev B)' }
 *     responses:
 *       '200':
 *         description: Verification review updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rv_1, name: 'TC review (rev B)' } }
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
router.get('/reviews/:projectId/:id', reviewController.getReview)
router.patch('/reviews/:projectId/:id', reviewController.updateReview)
/**
 * @openapi
 * /verification/reviews/{projectId}/{id}/items:
 *   post:
 *     tags: [Verification]
 *     summary: Add a review item
 *     description: Add an item to a verification review.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { entityType: { type: string }, entityId: { type: string } }
 *           example: { entityType: 'TEST_CASE', entityId: tc_1 }
 *     responses:
 *       '201':
 *         description: Review item added.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ri_1 } }
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
router.post('/reviews/:projectId/:id/items', reviewController.addReviewItem)
/**
 * @openapi
 * /verification/reviews/{projectId}/{id}/items/{itemId}:
 *   patch:
 *     tags: [Verification]
 *     summary: Update a review item
 *     description: Update an item of a verification review.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string }
 *         description: The review-item id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { status: { type: string } }
 *           example: { status: 'Resolved' }
 *     responses:
 *       '200':
 *         description: Review item updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: ri_1, status: 'Resolved' } }
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
router.patch('/reviews/:projectId/:id/items/:itemId', reviewController.updateReviewItem)
/**
 * @openapi
 * /verification/reviews/{projectId}/{id}/close:
 *   post:
 *     tags: [Verification]
 *     summary: Close a verification review
 *     description: Close a verification review.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Verification review closed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rv_1, status: 'Closed' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/reviews/:projectId/:id/close', reviewController.closeReview)

// J) Nonconformities
/**
 * @openapi
 * /verification/nonconformities/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List nonconformities
 *     description: Return the project's verification nonconformities.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of nonconformities.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: nc_1, title: 'Sensor drift' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a nonconformity
 *     description: Record a verification nonconformity.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties: { title: { type: string } }
 *           example: { title: 'Sensor drift' }
 *     responses:
 *       '201':
 *         description: Nonconformity created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: nc_1, title: 'Sensor drift' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/nonconformities/:projectId', nonconformityController.getNonconformities)
router.post('/nonconformities/:projectId', nonconformityController.createNonconformity)
/**
 * @openapi
 * /verification/nonconformities/{projectId}/from-failed-run-result/{runResultId}:
 *   post:
 *     tags: [Verification]
 *     summary: Create a nonconformity from a failed run result
 *     description: Create a nonconformity directly from a failed test-run result.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runResultId
 *         required: true
 *         schema: { type: string }
 *         description: The failed test-run-result id.
 *     responses:
 *       '201':
 *         description: Nonconformity created from the failed run result.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: nc_1, runResultId: rr_1 } }
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
router.post('/nonconformities/:projectId/from-failed-run-result/:runResultId', nonconformityController.createNonconformityFromFailedResult)
/**
 * @openapi
 * /verification/nonconformities/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a nonconformity
 *     description: Return one verification nonconformity by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested nonconformity.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: nc_1, title: 'Sensor drift' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a nonconformity
 *     description: Update a verification nonconformity.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { status: { type: string } }
 *           example: { status: 'Resolved' }
 *     responses:
 *       '200':
 *         description: Nonconformity updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: nc_1, status: 'Resolved' } }
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
router.get('/nonconformities/:projectId/:id', nonconformityController.getNonconformity)
router.patch('/nonconformities/:projectId/:id', nonconformityController.updateNonconformity)
/**
 * @openapi
 * /verification/nonconformities/{projectId}/{id}/create-reverify-task:
 *   post:
 *     tags: [Verification]
 *     summary: Create a re-verify task for a nonconformity
 *     description: Create a task to re-verify the artefact affected by a nonconformity.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '201':
 *         description: Re-verify task created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { taskId: tk_1 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/nonconformities/:projectId/:id/create-reverify-task', nonconformityController.createReverifyTask)
/**
 * @openapi
 * /verification/nonconformities/{projectId}/{id}/mark-reverified:
 *   post:
 *     tags: [Verification]
 *     summary: Mark a nonconformity re-verified
 *     description: Mark a verification nonconformity as re-verified.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Nonconformity marked re-verified.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: nc_1, status: 'Reverified' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/nonconformities/:projectId/:id/mark-reverified', nonconformityController.markReverified)

// K) Baselines
/**
 * @openapi
 * /verification/baselines/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List verification baselines
 *     description: Return the project's verification baselines.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of verification baselines.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: vb_1, name: 'V&V Baseline' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a verification baseline
 *     description: Snapshot the verification state into a new baseline.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string } }
 *           example: { name: 'V&V Baseline' }
 *     responses:
 *       '201':
 *         description: Verification baseline created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vb_1, name: 'V&V Baseline' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/baselines/:projectId', baselineController.getBaselines)
router.post('/baselines/:projectId', baselineController.createBaseline)
/**
 * @openapi
 * /verification/baselines/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a verification baseline
 *     description: Return one verification baseline by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested verification baseline.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vb_1, name: 'V&V Baseline' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/baselines/:projectId/:id', baselineController.getBaseline)
/**
 * @openapi
 * /verification/baselines/{projectId}/{id}/compare/{otherId}:
 *   post:
 *     tags: [Verification]
 *     summary: Compare two verification baselines
 *     description: Return the diff between two verification baselines.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *       - in: path
 *         name: otherId
 *         required: true
 *         schema: { type: string }
 *         description: The id of the other baseline to compare against.
 *     responses:
 *       '200':
 *         description: The diff between the two verification baselines.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { added: [], removed: [], changed: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/baselines/:projectId/:id/compare/:otherId', baselineController.compareBaselines)

// L) Settings
/**
 * @openapi
 * /verification/settings/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: Get verification settings
 *     description: Return the project's verification-module settings.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The verification settings.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { considerPassedWithErrors: true } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update verification settings
 *     description: Update the project's verification-module settings.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { considerPassedWithErrors: { type: boolean } }
 *           example: { considerPassedWithErrors: false }
 *     responses:
 *       '200':
 *         description: Verification settings updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { considerPassedWithErrors: false } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/settings/:projectId', settingsController.getSettings)
router.patch('/settings/:projectId', settingsController.updateSettings)
/**
 * @openapi
 * /verification/settings/{projectId}/validate:
 *   post:
 *     tags: [Verification]
 *     summary: Validate verification settings
 *     description: Validate a proposed verification-settings payload.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { considerPassedWithErrors: { type: boolean } }
 *           example: { considerPassedWithErrors: false }
 *     responses:
 *       '200':
 *         description: The settings are valid.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { valid: true } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/settings/:projectId/validate', settingsController.validateSettings)

// M) Overview
/**
 * @openapi
 * /verification/overview/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: Get the verification overview
 *     description: Return aggregate overview metrics for the project's verification state.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The verification overview.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { testCases: 42, passed: 30 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/overview/:projectId', overviewController.getOverview)

// O) Templates
/**
 * @openapi
 * /verification/templates/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List verification templates
 *     description: Return the project's verification templates.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of verification templates.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: vt_1, name: 'TC template' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a verification template
 *     description: Create a verification template in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string } }
 *           example: { name: 'TC template' }
 *     responses:
 *       '201':
 *         description: Verification template created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vt_1, name: 'TC template' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/templates/:projectId', templateController.listTemplates)
router.post('/templates/:projectId', templateController.createTemplate)
/**
 * @openapi
 * /verification/templates/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a verification template
 *     description: Return one verification template by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested verification template.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vt_1, name: 'TC template' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a verification template
 *     description: Update a verification template.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { name: { type: string } }
 *           example: { name: 'TC template (rev B)' }
 *     responses:
 *       '200':
 *         description: Verification template updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vt_1, name: 'TC template (rev B)' } }
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
 *     tags: [Verification]
 *     summary: Delete a verification template
 *     description: Delete a verification template.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Verification template deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Template deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/templates/:projectId/:id', templateController.getTemplate)
router.patch('/templates/:projectId/:id', templateController.updateTemplate)
/**
 * @openapi
 * /verification/templates/{projectId}/{id}/publish:
 *   post:
 *     tags: [Verification]
 *     summary: Publish a verification template
 *     description: Publish a verification template.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Verification template published.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vt_1, status: 'Published' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/templates/:projectId/:id/publish', templateController.publishTemplate)
/**
 * @openapi
 * /verification/templates/{projectId}/{id}/duplicate:
 *   post:
 *     tags: [Verification]
 *     summary: Duplicate a verification template
 *     description: Create a copy of a verification template.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '201':
 *         description: Verification template duplicated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vt_2, name: 'TC template (copy)' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/templates/:projectId/:id/duplicate', templateController.duplicateTemplate)
/**
 * @openapi
 * /verification/templates/{projectId}/{id}/archive:
 *   post:
 *     tags: [Verification]
 *     summary: Archive a verification template
 *     description: Archive a verification template.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Verification template archived.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: vt_1, status: 'Archived' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/templates/:projectId/:id/archive', templateController.archiveTemplate)
router.delete('/templates/:projectId/:id', templateController.deleteTemplate)

// N) Test Results
/**
 * @openapi
 * /verification/test-results/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List test results
 *     description: Return the project's verification test results.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of test results.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: tres_1, status: 'PASS' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a test result
 *     description: Create a verification test result in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { status: { type: string, enum: [PASS, FAIL, SKIPPED] } }
 *           example: { status: 'PASS' }
 *     responses:
 *       '201':
 *         description: Test result created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tres_1, status: 'PASS' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-results/:projectId', testResultController.getTestResults)
router.post('/test-results/:projectId', testResultController.createTestResult)
/**
 * @openapi
 * /verification/test-results/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a test result
 *     description: Return one verification test result by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The requested test result.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tres_1, status: 'PASS' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a test result
 *     description: Update a verification test result.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { status: { type: string } }
 *           example: { status: 'FAIL' }
 *     responses:
 *       '200':
 *         description: Test result updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tres_1, status: 'FAIL' } }
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
 *     tags: [Verification]
 *     summary: Delete a test result
 *     description: Delete a verification test result.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test result deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Result deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-results/:projectId/:id', testResultController.getTestResult)
router.patch('/test-results/:projectId/:id', testResultController.updateTestResult)
router.delete('/test-results/:projectId/:id', testResultController.deleteTestResult)
/**
 * @openapi
 * /verification/test-results/{projectId}/{id}/link:
 *   post:
 *     tags: [Verification]
 *     summary: Link a test result to an artefact
 *     description: Link a verification test result to a verification artefact.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { linkedEntityType: { type: string }, linkedEntityId: { type: string } }
 *           example: { linkedEntityType: 'VerTestCase', linkedEntityId: tc_1 }
 *     responses:
 *       '200':
 *         description: Test result linked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tres_1 } }
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
router.post('/test-results/:projectId/:id/link', testResultController.linkTestResult)
/**
 * @openapi
 * /verification/test-results/{projectId}/{id}/unlink:
 *   post:
 *     tags: [Verification]
 *     summary: Unlink a test result from an artefact
 *     description: Remove a test-result link from a verification artefact.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { linkedEntityType: { type: string }, linkedEntityId: { type: string } }
 *           example: { linkedEntityType: 'VerTestCase', linkedEntityId: tc_1 }
 *     responses:
 *       '200':
 *         description: Test result unlinked.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Result unlinked' }
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
router.post('/test-results/:projectId/:id/unlink', testResultController.unlinkTestResult)
/**
 * @openapi
 * /verification/test-results/{projectId}/{id}/download:
 *   get:
 *     tags: [Verification]
 *     summary: Download a test result file
 *     description: Download the file attached to a verification test result.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test-result file (streamed download).
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-results/:projectId/:id/download', testResultController.downloadTestResult)

// N.1) Test Runs (Automated Ingestion + Manual)
/**
 * @openapi
 * /verification/runs/ingest/{projectId}:
 *   post:
 *     tags: [Verification]
 *     summary: Ingest an automated test-run result (JSON)
 *     description: >-
 *       Ingest a normalised automated test-run result as a JSON body
 *       (N-2.4). For raw CI-tool output files use the `/file` variant.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { results: { type: array, items: { type: object } } }
 *           example: { results: [{ testCaseKey: 'TC-001', status: 'PASS' }] }
 *     responses:
 *       '200':
 *         description: The test run was ingested.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { runId: tr_1, summary: { passed: 1, failed: 0 } } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/runs/ingest/:projectId', runIngestionController.ingestAutomatedResult)
/**
 * @openapi
 * /verification/runs/ingest/{projectId}/file:
 *   post:
 *     tags: [Verification]
 *     summary: Ingest a test-run result file (CI upload)
 *     description: >-
 *       Upload a raw CI-tool output file (JUnit / xUnit / NUnit / Robot /
 *       TAP / pytest), parse it, and ingest the run (N-2.4). The `format`
 *       field must name the parser. Multipart form upload; the file is
 *       capped at 8 MB.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, format]
 *             properties:
 *               file: { type: string, format: binary }
 *               format: { type: string, enum: [junit, xunit, nunit, robot, tap, pytest] }
 *     responses:
 *       '200':
 *         description: The file was parsed and the run ingested.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { runId: tr_1, summary: { passed: 12, failed: 1 } } }
 *       '400':
 *         description: Missing or oversized file, unknown format, or a parse error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *             example: { success: false, error: 'Uploaded file exceeds the 8 MB limit' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
// File upload variant — accepts a raw CI-tool output file (JUnit/xUnit/NUnit/
// Robot/TAP/pytest) and parses it before ingestion. projectId is membership-
// scoped by router.param above; the 8 MB cap is enforced by multer.
router.post(
  '/runs/ingest/:projectId/file',
  uploadTestResultFile,
  runIngestionController.ingestFileResult
)
/**
 * @openapi
 * /verification/test-runs/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: List test runs
 *     description: Return the project's verification test runs.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The list of test runs.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: array, items: { type: object } } }
 *             example: { success: true, data: [{ id: tr_1, name: 'Nightly run' }] }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   post:
 *     tags: [Verification]
 *     summary: Create a test run
 *     description: Create a manual verification test run in the project.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties: { name: { type: string } }
 *           example: { name: 'PDR manual run' }
 *     responses:
 *       '201':
 *         description: Test run created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_2, name: 'PDR manual run' } }
 *       '400':
 *         $ref: '#/components/responses/ValidationError'
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/test-runs/:projectId', runIngestionController.getTestRuns)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}:
 *   get:
 *     tags: [Verification]
 *     summary: Get a test run
 *     description: Return one verification test run by id.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *     responses:
 *       '200':
 *         description: The requested test run.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_1, name: 'Nightly run' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 *   patch:
 *     tags: [Verification]
 *     summary: Update a test run
 *     description: Update a verification test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { name: { type: string } }
 *           example: { name: 'Nightly run (rev B)' }
 *     responses:
 *       '200':
 *         description: Test run updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_1, name: 'Nightly run (rev B)' } }
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
router.get('/test-runs/:projectId/:runId', runIngestionController.getTestRun)
router.post('/test-runs/:projectId', testRunController.createTestRun)
router.patch('/test-runs/:projectId/:runId', testRunController.updateTestRun)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/start:
 *   post:
 *     tags: [Verification]
 *     summary: Start the test-run timer
 *     description: Start the execution timer for a verification test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *     responses:
 *       '200':
 *         description: Timer started.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_1, timerState: 'running' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-runs/:projectId/:runId/start', testRunController.startTimer)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/pause:
 *   post:
 *     tags: [Verification]
 *     summary: Pause the test-run timer
 *     description: Pause the execution timer for a verification test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *     responses:
 *       '200':
 *         description: Timer paused.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_1, timerState: 'paused' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-runs/:projectId/:runId/pause', testRunController.pauseTimer)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/resume:
 *   post:
 *     tags: [Verification]
 *     summary: Resume the test-run timer
 *     description: Resume the execution timer for a verification test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *     responses:
 *       '200':
 *         description: Timer resumed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_1, timerState: 'running' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-runs/:projectId/:runId/resume', testRunController.resumeTimer)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/stop:
 *   post:
 *     tags: [Verification]
 *     summary: Stop the test-run timer
 *     description: Stop the execution timer for a verification test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *     responses:
 *       '200':
 *         description: Timer stopped.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_1, timerState: 'stopped' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-runs/:projectId/:runId/stop', testRunController.stopTimer)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/complete-and-export:
 *   post:
 *     tags: [Verification]
 *     summary: Complete a test run and export it
 *     description: Mark a verification test run complete and export the result.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *     responses:
 *       '200':
 *         description: Test run completed and exported.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: tr_1, status: 'Complete' } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-runs/:projectId/:runId/complete-and-export', testRunController.completeAndExport)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/results/{resultId}:
 *   patch:
 *     tags: [Verification]
 *     summary: Update a run result
 *     description: Update a single result within a verification test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *       - in: path
 *         name: resultId
 *         required: true
 *         schema: { type: string }
 *         description: The run-result id.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties: { status: { type: string } }
 *           example: { status: 'PASS' }
 *     responses:
 *       '200':
 *         description: Run result updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rr_1, status: 'PASS' } }
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
router.patch('/test-runs/:projectId/:runId/results/:resultId', testRunController.updateRunResult)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/results/{resultId}/sync:
 *   post:
 *     tags: [Verification]
 *     summary: Sync a run result
 *     description: Re-sync a run result with its linked test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *       - in: path
 *         name: resultId
 *         required: true
 *         schema: { type: string }
 *         description: The run-result id.
 *     responses:
 *       '200':
 *         description: Run result synced.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rr_1 } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/test-runs/:projectId/:runId/results/:resultId/sync', testRunController.syncRunResult)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{runId}/results/{resultId}/evidence:
 *   post:
 *     tags: [Verification]
 *     summary: Upload evidence to a run result
 *     description: Attach an evidence file to a verification run result (multipart form upload).
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - in: path
 *         name: runId
 *         required: true
 *         schema: { type: string }
 *         description: The test-run id.
 *       - in: path
 *         name: resultId
 *         required: true
 *         schema: { type: string }
 *         description: The run-result id.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties: { file: { type: string, format: binary } }
 *     responses:
 *       '200':
 *         description: Evidence uploaded to the run result.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, data: { id: rr_1, evidenceId: ev_1 } }
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
router.post('/test-runs/:projectId/:runId/results/:resultId/evidence', testRunController.uploadEvidence)
/**
 * @openapi
 * /verification/test-runs/{projectId}/{id}:
 *   delete:
 *     tags: [Verification]
 *     summary: Delete a test run
 *     description: Delete a verification test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: Test run deleted.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/SuccessEnvelope' }
 *             example: { success: true, message: 'Test run deleted' }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '404':
 *         $ref: '#/components/responses/NotFoundError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.delete('/test-runs/:projectId/:id', runIngestionController.deleteTestRun)

// Reports
/**
 * @openapi
 * /verification/reports/test-case/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Generate a test-case report
 *     description: Generate the verification report for a single test case.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test-case report.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { testCaseId: tc_1, sections: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports/test-case/:projectId/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const report = await reportService.generateTestCaseReport(projectId, id)
    res.json({ success: true, data: report })
  } catch (error: any) {
    console.error('Generate test case report error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

/**
 * @openapi
 * /verification/reports/test-plan/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Generate a test-plan report
 *     description: Generate the verification report for a single test plan.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test-plan report.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { testPlanId: tp_1, sections: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports/test-plan/:projectId/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const report = await reportService.generateTestPlanReport(projectId, id)
    res.json({ success: true, data: report })
  } catch (error: any) {
    console.error('Generate test plan report error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

/**
 * @openapi
 * /verification/reports/test-setup/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Generate a test-setup report
 *     description: Generate the verification report for a single test setup.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test-setup report.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { testSetupId: ts_1, sections: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports/test-setup/:projectId/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const report = await reportService.generateTestSetupReport(projectId, id)
    res.json({ success: true, data: report })
  } catch (error: any) {
    console.error('Generate test setup report error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

/**
 * @openapi
 * /verification/reports/test-result/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Generate a test-result report
 *     description: Generate the verification report for a single test result.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test-result report.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { testResultId: tres_1, sections: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports/test-result/:projectId/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const report = await reportService.generateTestResultReport(projectId, id)
    res.json({ success: true, data: report })
  } catch (error: any) {
    console.error('Generate test result report error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

/**
 * @openapi
 * /verification/reports/test-run/{projectId}/{id}:
 *   get:
 *     tags: [Verification]
 *     summary: Generate a test-run report
 *     description: Generate the verification report for a single test run.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *       - $ref: '#/components/parameters/VerEntityId'
 *     responses:
 *       '200':
 *         description: The test-run report.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { testRunId: tr_1, sections: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports/test-run/:projectId/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const report = await reportService.generateTestRunReport(projectId, id)
    res.json({ success: true, data: report })
  } catch (error: any) {
    console.error('Generate test run report error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

/**
 * @openapi
 * /verification/reports/compliance-matrix/{projectId}:
 *   get:
 *     tags: [Verification]
 *     summary: Generate the verification compliance matrix
 *     description: Generate the project's verification compliance-matrix report.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     responses:
 *       '200':
 *         description: The compliance-matrix report.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties: { data: { type: object } }
 *             example: { success: true, data: { rows: [] } }
 *       '401':
 *         $ref: '#/components/responses/UnauthorizedError'
 *       '403':
 *         $ref: '#/components/responses/ForbiddenError'
 *       '500':
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/reports/compliance-matrix/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const report = await reportService.generateComplianceMatrix(projectId)
    res.json({ success: true, data: report })
  } catch (error: any) {
    console.error('Generate compliance matrix error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

// Export with template (DOCX)
/**
 * @openapi
 * /verification/export-with-template/{projectId}:
 *   post:
 *     tags: [Verification]
 *     summary: Export a test case or test plan with a DOCX template
 *     description: >-
 *       Render a verification test case or test plan into a DOCX document
 *       using a corporate template.
 *     parameters:
 *       - $ref: '#/components/parameters/VerProjectId'
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [entityType, entityId, templateId]
 *             properties:
 *               entityType: { type: string, enum: [TEST_CASE, TEST_PLAN] }
 *               entityId: { type: string }
 *               templateId: { type: string }
 *           example: { entityType: 'TEST_CASE', entityId: tc_1, templateId: tmpl_1 }
 *     responses:
 *       '200':
 *         description: The rendered DOCX document (streamed download).
 *         content:
 *           application/vnd.openxmlformats-officedocument.wordprocessingml.document:
 *             schema: { type: string, format: binary }
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
router.post('/export-with-template/:projectId', async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { entityType, entityId, templateId } = req.body as {
      entityType?: 'TEST_CASE' | 'TEST_PLAN'
      entityId?: string
      templateId?: string
    }
    if (!entityType || !entityId || !templateId) {
      return res.status(400).json({
        success: false,
        error: 'entityType, entityId, and templateId are required',
      })
    }
    if (entityType !== 'TEST_CASE' && entityType !== 'TEST_PLAN') {
      return res.status(400).json({
        success: false,
        error: 'entityType must be TEST_CASE or TEST_PLAN',
      })
    }
    const buffer = await exportTemplateService.exportWithTemplate(
      projectId,
      entityType,
      entityId,
      templateId
    )
    const name = entityType === 'TEST_CASE' ? 'TestCase' : 'TestPlan'
    res
      .setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      .setHeader('Content-Disposition', `attachment; filename="${name}-export.docx"`)
      .send(buffer)
  } catch (error: any) {
    console.error('Export with template error:', error)
    if (error?.message === 'Template not found' || error?.message === 'Project not found') {
      return res.status(404).json({ success: false, error: error.message })
    }
    if (error?.message?.includes('does not match')) {
      return res.status(400).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
})

export default router
