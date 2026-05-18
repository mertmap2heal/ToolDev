// NX-8 (#463) — Stakeholders backend build-out: governance routes.
//
// Mounted at /api/v1/projects. Every route is tenant-scoped:
// `authenticateToken` (global) -> `projectIdParam` (UUID resolution +
// membership check, #144) -> `requireProjectMember` (N-3 tenant-scope rule).
//
// `requireEngineeringRole` is deliberately NOT wired — committee membership,
// RACI assignments, and default-reviewer wiring are governance DATA, not
// sign-off events. The R-7 discipline gate guards signing an artefact; CRUD on
// the org structure is correctly guarded by project membership only.
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import * as ctrl from '../controllers/stakeholders.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

// --- Committees -------------------------------------------------------------
router.get('/:projectId/committees', ctrl.listCommittees)
router.post('/:projectId/committees', ctrl.createCommittee)
router.get('/:projectId/committees/:committeeId', ctrl.getCommittee)
router.put('/:projectId/committees/:committeeId', ctrl.updateCommittee)
router.delete('/:projectId/committees/:committeeId', ctrl.deleteCommittee)

// --- Committee members ------------------------------------------------------
router.post('/:projectId/committees/:committeeId/members', ctrl.addCommitteeMember)
router.put('/:projectId/committees/:committeeId/members/:memberId', ctrl.updateCommitteeMember)
router.delete('/:projectId/committees/:committeeId/members/:memberId', ctrl.removeCommitteeMember)

// --- Committee default reviewers --------------------------------------------
router.post('/:projectId/committees/:committeeId/default-reviewers', ctrl.setDefaultReviewer)
router.delete(
  '/:projectId/committees/:committeeId/default-reviewers/:reviewerId',
  ctrl.unsetDefaultReviewer,
)

// --- RACI entries -----------------------------------------------------------
router.get('/:projectId/raci', ctrl.listRaciEntries)
router.post('/:projectId/raci', ctrl.createRaciEntry)
router.get('/:projectId/raci/:raciId', ctrl.getRaciEntry)
router.put('/:projectId/raci/:raciId', ctrl.updateRaciEntry)
router.delete('/:projectId/raci/:raciId', ctrl.deleteRaciEntry)

// --- RACI assignments -------------------------------------------------------
router.put('/:projectId/raci/:raciId/assignments', ctrl.setRaciAssignments)

export default router
