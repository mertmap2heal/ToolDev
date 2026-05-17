// NX-3 (#443) — Configuration Management: CCB decision routes.
//
// Mounted at /api/v1/ccb-decisions. Tenant-scoped:
// `authenticateToken` -> `projectIdParam` -> `requireProjectMember` (N-3).
//
// The `sign` endpoint is a CFR 21 Part 11 signing ceremony (CM-N3): the full
// R-Wave chain — authenticateToken -> requireProjectMember -> requireReauth
// (R-2) -> requireEngineeringRole (R-7) -> controller -> service (which calls
// createSignature, R-3, and bumps impacted-CI versions in one transaction).
import { Router } from 'express'
import { authenticateToken, requireReauth, requireEngineeringRole } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import * as ctrl from '../controllers/ccbDecision.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

// Static / param-prefixed segments before the bare /:projectId routes.
router.get('/:projectId/by-change-request/:changeRequestId', ctrl.listByChangeRequest)

router.get('/:projectId', ctrl.list)

// `create` and `reject` are intentionally gated by `requireProjectMember`
// only — no `requireEngineeringRole`. Recording an unsigned CCB decision row
// (a draft / deferral / rejection) is a board-administration act any project
// member may perform; it is NOT a CFR 21 Part 11 signature event. The
// discipline gate (`requireEngineeringRole`) and reauthentication
// (`requireReauth`) apply only to the signed `sign` ceremony below — that is
// the regulated act per kb/configuration-management.md §"CCB".
router.post('/:projectId', ctrl.create)
router.post('/:projectId/reject', ctrl.reject)

// The CCB signing ceremony. Only a Configuration Manager, CCB Member, or
// Safety Engineer may sign; a safety-impacting decision in a strict project
// is further narrowed to a Safety Engineer inside the service.
router.post(
  '/:projectId/sign',
  requireReauth,
  requireEngineeringRole(['Configuration Manager', 'CCB Member', 'Safety Engineer']),
  ctrl.sign,
)

export default router
