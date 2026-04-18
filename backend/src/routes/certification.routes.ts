import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import * as ctrl from '../controllers/certification'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Full state (for frontend hydration)
router.get('/:projectId/state', ctrl.getFullState)

// Exports (must be before other :projectId routes that might conflict)
router.get('/:projectId/export/compliance-matrix', ctrl.exportComplianceMatrix)
router.get('/:projectId/export/evidence-index', ctrl.exportEvidenceIndex)
router.get('/:projectId/export/summary', ctrl.exportSummary)
router.get('/:projectId/export/review-log', ctrl.exportReviewLog)
router.get('/:projectId/export/activity-log', ctrl.exportActivityLog)
router.post('/:projectId/packages/:packageId/generate-bundle', ctrl.generatePackageBundleRoute)

// Context
router.get('/:projectId/context', ctrl.getContext)
router.patch('/:projectId/context', ctrl.updateContext)

// Baselines
router.get('/:projectId/baselines', ctrl.getBaselines)
router.post('/:projectId/baselines', ctrl.createBaseline)

// Releases
router.get('/:projectId/releases', ctrl.getReleases)
router.post('/:projectId/releases', ctrl.createRelease)

// Objectives
router.get('/:projectId/objectives', ctrl.getObjectives)
router.post('/:projectId/objectives', ctrl.createObjective)
router.patch('/:projectId/objectives/:id', ctrl.updateObjective)
// Objective–Requirement traceability
router.get('/:projectId/objectives/:objectiveId/requirement-links', ctrl.getObjectiveRequirementLinks)
router.post('/:projectId/objectives/:objectiveId/requirement-links', ctrl.addObjectiveRequirementLink)
router.delete('/:projectId/objectives/:objectiveId/requirement-links/:linkId', ctrl.removeObjectiveRequirementLink)

// Compliance matrix
router.get('/:projectId/compliance-matrix', ctrl.getComplianceMatrix)
router.put('/:projectId/compliance-matrix/rows', ctrl.upsertComplianceMatrixRow)

// Findings
router.get('/:projectId/findings', ctrl.getFindings)
router.post('/:projectId/findings', ctrl.createFinding)
router.patch('/:projectId/findings/:id', ctrl.updateFinding)

// Review log
router.get('/:projectId/review-log', ctrl.getReviewLog)
router.post('/:projectId/review-log', ctrl.createReviewLogEntry)
router.patch('/:projectId/review-log/:id', ctrl.updateReviewLogEntry)

// Activity log
router.get('/:projectId/activity-log', ctrl.getActivityLog)
router.post('/:projectId/activity-log', ctrl.appendActivity)

// Readiness gates
router.get('/:projectId/readiness-gates', ctrl.getReadinessGates)
router.patch('/:projectId/readiness-gates/:id', ctrl.updateReadinessGate)

// Packages
router.get('/:projectId/packages', ctrl.getPackages)
router.post('/:projectId/packages', ctrl.createPackage)

// Authority: Correspondence
router.get('/:projectId/correspondence', ctrl.getCorrespondence)
router.post('/:projectId/correspondence', ctrl.createCorrespondence)
router.patch('/:projectId/correspondence/:id', ctrl.updateCorrespondence)
router.delete('/:projectId/correspondence/:id', ctrl.deleteCorrespondence)

// Authority: Meetings & Action items
router.get('/:projectId/meetings', ctrl.getMeetings)
router.post('/:projectId/meetings', ctrl.createMeeting)
router.patch('/:projectId/meetings/:id', ctrl.updateMeeting)
router.post('/:projectId/meetings/:meetingId/action-items', ctrl.createActionItem)
router.patch('/:projectId/meetings/:meetingId/action-items/:id', ctrl.updateActionItem)
router.delete('/:projectId/meetings/:meetingId/action-items/:id', ctrl.deleteActionItem)

// Certification plan & milestones
router.get('/:projectId/plan', ctrl.getPlan)
router.put('/:projectId/plan', ctrl.upsertPlan)
router.get('/:projectId/milestones', ctrl.getMilestones)
router.post('/:projectId/milestones', ctrl.createMilestone)
router.patch('/:projectId/milestones/:id', ctrl.updateMilestone)

// Dashboard metrics
router.get('/:projectId/metrics', ctrl.getCertificationMetrics)

// Checklists & sign-offs
router.get('/:projectId/checklists', ctrl.getChecklists)
router.post('/:projectId/checklists', ctrl.createChecklist)
router.patch('/:projectId/checklists/:checklistId/items/:id', ctrl.updateChecklistItem)
// Sign-off routes enforce project membership inside the controller (issue #163)
router.post('/:projectId/checklists/:checklistId/sign-offs', ctrl.addSignOff)
router.patch('/:projectId/sign-offs/:id', ctrl.updateSignOff)

export default router
