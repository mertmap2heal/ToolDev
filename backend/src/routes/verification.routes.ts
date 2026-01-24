import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
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
import { reportService } from '../services/verification/report.service'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

// A) MoC Endpoints
router.get('/moc', mocController.getMocs)
router.get('/moc/:code', mocController.getMocByCode)
router.post('/moc', mocController.createMoc)
router.patch('/moc/:code', mocController.updateMoc)

// B) Methods
router.get('/methods/:projectId', methodController.getMethods)
router.post('/methods/:projectId', methodController.createMethod)
router.get('/methods/:projectId/:id', methodController.getMethod)
router.patch('/methods/:projectId/:id', methodController.updateMethod)
router.post('/methods/:projectId/:id/approve', methodController.approveMethod)
router.post('/methods/:projectId/:id/deprecate', methodController.deprecateMethod)

// C) Test Setups
router.get('/setups/:projectId', setupController.getSetups)
router.post('/setups/:projectId', setupController.createSetup)
router.get('/setups/:projectId/:id', setupController.getSetup)
router.patch('/setups/:projectId/:id', setupController.updateSetup)
router.post('/setups/:projectId/:id/approve', setupController.approveSetup)
router.post('/setups/:projectId/:id/deprecate', setupController.deprecateSetup)
router.post('/setups/:projectId/:id/diagram/export', setupController.exportSetupDiagram)
router.post('/setups/:projectId/:setupId/components/:componentId/manual', setupController.uploadComponentManual)

// C.1) Custom Options
router.get('/custom-options/:projectId/:optionType', customOptionController.getCustomOptions)
router.post('/custom-options/:projectId', customOptionController.addCustomOption)
router.delete('/custom-options/:projectId/:id', customOptionController.removeCustomOption)

// D) Test Cases
router.get('/test-cases/:projectId', testCaseController.getTestCases)
router.post('/test-cases/:projectId', testCaseController.createTestCase)
router.get('/test-cases/:projectId/:id', testCaseController.getTestCase)
router.patch('/test-cases/:projectId/:id', testCaseController.updateTestCase)
router.post('/test-cases/:projectId/:id/review', testCaseController.reviewTestCase)
router.post('/test-cases/:projectId/:id/approve', testCaseController.approveTestCase)
router.post('/test-cases/:projectId/:id/version', testCaseController.createTestCaseVersion)
router.post('/test-cases/:projectId/:id/link-setup', testCaseController.linkSetup)
router.post('/test-cases/:projectId/:id/unlink-setup', testCaseController.unlinkSetup)
router.get('/test-cases/:projectId/:id/verification-links', testCaseController.getVerificationLinks)
router.post('/test-cases/:projectId/:id/verification-links', testCaseController.linkVerificationElement)
router.delete('/test-cases/:projectId/:id/verification-links/:linkId', testCaseController.unlinkVerificationElement)

// E) Test Plans
router.get('/test-plans/:projectId', testPlanController.getTestPlans)
router.post('/test-plans/:projectId', testPlanController.createTestPlan)
router.get('/test-plans/:projectId/:id', testPlanController.getTestPlan)
router.patch('/test-plans/:projectId/:id', testPlanController.updateTestPlan)
router.post('/test-plans/:projectId/:id/add-case', testPlanController.addCaseToPlan)
router.post('/test-plans/:projectId/:id/remove-case', testPlanController.removeCaseFromPlan)
router.post('/test-plans/:projectId/:id/reorder-cases', testPlanController.reorderCases)
router.post('/test-plans/:projectId/:id/approve', testPlanController.approveTestPlan)
router.post('/test-plans/:projectId/:id/close', testPlanController.closeTestPlan)
router.get('/test-plans/:projectId/:id/verification-links', testPlanController.getVerificationLinks)
router.post('/test-plans/:projectId/:id/verification-links', testPlanController.linkVerificationElement)
router.delete('/test-plans/:projectId/:id/verification-links/:linkId', testPlanController.unlinkVerificationElement)

// F) Evidence
router.get('/evidence/:projectId', evidenceController.getEvidence)
router.post('/evidence/:projectId', evidenceController.createEvidence)
router.get('/evidence/:projectId/:id', evidenceController.getEvidenceById)
router.post('/evidence/:projectId/:id/link', evidenceController.linkEvidence)
router.post('/evidence/:projectId/:id/unlink', evidenceController.unlinkEvidence)

// H) Coverage
router.get('/coverage/:projectId/moc-summary', coverageController.getMocSummary)
router.get('/coverage/:projectId/plan/:planId', coverageController.getPlanCoverage)

// I) Reviews
router.get('/reviews/:projectId', reviewController.getReviews)
router.post('/reviews/:projectId', reviewController.createReview)
router.get('/reviews/:projectId/:id', reviewController.getReview)
router.patch('/reviews/:projectId/:id', reviewController.updateReview)
router.post('/reviews/:projectId/:id/items', reviewController.addReviewItem)
router.patch('/reviews/:projectId/:id/items/:itemId', reviewController.updateReviewItem)
router.post('/reviews/:projectId/:id/close', reviewController.closeReview)

// J) Nonconformities
router.get('/nonconformities/:projectId', nonconformityController.getNonconformities)
router.post('/nonconformities/:projectId', nonconformityController.createNonconformity)
router.get('/nonconformities/:projectId/:id', nonconformityController.getNonconformity)
router.patch('/nonconformities/:projectId/:id', nonconformityController.updateNonconformity)
router.post('/nonconformities/:projectId/:id/create-reverify-task', nonconformityController.createReverifyTask)
router.post('/nonconformities/:projectId/:id/mark-reverified', nonconformityController.markReverified)

// K) Baselines
router.get('/baselines/:projectId', baselineController.getBaselines)
router.post('/baselines/:projectId', baselineController.createBaseline)
router.get('/baselines/:projectId/:id', baselineController.getBaseline)
router.post('/baselines/:projectId/:id/compare/:otherId', baselineController.compareBaselines)

// L) Settings
router.get('/settings/:projectId', settingsController.getSettings)
router.patch('/settings/:projectId', settingsController.updateSettings)
router.post('/settings/:projectId/validate', settingsController.validateSettings)

// M) Overview
router.get('/overview/:projectId', overviewController.getOverview)

// N) Test Results
router.get('/test-results/:projectId', testResultController.getTestResults)
router.post('/test-results/:projectId', testResultController.createTestResult)
router.get('/test-results/:projectId/:id', testResultController.getTestResult)
router.patch('/test-results/:projectId/:id', testResultController.updateTestResult)
router.delete('/test-results/:projectId/:id', testResultController.deleteTestResult)
router.post('/test-results/:projectId/:id/link', testResultController.linkTestResult)
router.post('/test-results/:projectId/:id/unlink', testResultController.unlinkTestResult)
router.get('/test-results/:projectId/:id/download', testResultController.downloadTestResult)

// Reports
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

export default router
