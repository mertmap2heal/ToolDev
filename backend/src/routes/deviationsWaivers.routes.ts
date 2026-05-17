// NX-3 (#443) — Configuration Management: Deviation / Waiver routes.
//
// Mounted at /api/v1/deviations-waivers. Tenant-scoped:
// `authenticateToken` -> `projectIdParam` -> `requireProjectMember` (N-3).
//
// The `sign` endpoint is a CFR 21 Part 11 signing event, so it carries the
// full R-Wave sign-off chain: authenticateToken -> requireProjectMember ->
// requireReauth (R-2) -> requireEngineeringRole (R-7) -> controller -> service
// (which calls createSignature, R-3).
import { Router } from 'express'
import { authenticateToken, requireReauth, requireEngineeringRole } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import * as ctrl from '../controllers/deviationWaiver.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)

router.get('/:projectId', ctrl.list)
router.post('/:projectId', ctrl.create)
router.get('/:projectId/:id', ctrl.get)
router.put('/:projectId/:id', ctrl.update)

// Sign-off — a deviation / waiver authorisation under CFR 21 Part 11. Only a
// Configuration Manager, CCB Member, or Safety Engineer may sign.
router.post(
  '/:projectId/:id/sign',
  requireReauth,
  requireEngineeringRole(['Configuration Manager', 'CCB Member', 'Safety Engineer']),
  ctrl.sign,
)

router.post('/:projectId/:id/close', ctrl.close)
router.post('/:projectId/:id/reject', ctrl.reject)

export default router
