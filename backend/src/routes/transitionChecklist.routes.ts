import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import * as ctrl from '../controllers/transitionChecklist.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', ctrl.listChecklists)
router.get('/:projectId/checklist/:checklistId', ctrl.getChecklist)
router.post('/:projectId', ctrl.createChecklist)
router.put('/:projectId/checklist/:checklistId', ctrl.updateChecklist)
router.delete('/:projectId/checklist/:checklistId', ctrl.deleteChecklist)

router.get('/:projectId/for-transition', ctrl.getChecklistsForTransition)

router.post('/:projectId/assignments', ctrl.createAssignment)
router.delete('/:projectId/assignments/:assignmentId', ctrl.deleteAssignment)

router.post('/:projectId/complete', ctrl.submitCompletion)
router.get('/:projectId/completions/:entityId', ctrl.getCompletionHistory)

router.post('/:projectId/evaluate', ctrl.evaluateChecklist)

export default router
