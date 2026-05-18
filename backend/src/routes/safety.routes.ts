// NX-9 (#466) — Safety Analysis: Hazard + FMEA routes.
//
// Mounted at /api/v1/safety-analysis. Every route is tenant-scoped, following
// the validation.routes.ts pattern verbatim:
//   authenticateToken (global)
//     -> projectIdParam (slug/UUID resolution + IDOR check)
//     -> requireProjectMember (N-3 tenant-scope rule).
// Final path: /api/v1/safety-analysis/projects/:projectId/...
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import * as ctrl from '../controllers/safety.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/projects/:projectId', requireProjectMember)

// --- Hazards ----------------------------------------------------------------
router.get('/projects/:projectId/hazards', ctrl.listHazards)
router.post('/projects/:projectId/hazards', ctrl.createHazard)
router.get('/projects/:projectId/hazards/:id', ctrl.getHazard)
router.patch('/projects/:projectId/hazards/:id', ctrl.updateHazard)
router.delete('/projects/:projectId/hazards/:id', ctrl.deleteHazard)

// --- Failure conditions (child of a hazard) ---------------------------------
router.get(
  '/projects/:projectId/hazards/:hazardId/failure-conditions',
  ctrl.listFailureConditions,
)
router.post(
  '/projects/:projectId/hazards/:hazardId/failure-conditions',
  ctrl.createFailureCondition,
)
router.get(
  '/projects/:projectId/hazards/:hazardId/failure-conditions/:id',
  ctrl.getFailureCondition,
)
router.patch(
  '/projects/:projectId/hazards/:hazardId/failure-conditions/:id',
  ctrl.updateFailureCondition,
)
router.delete(
  '/projects/:projectId/hazards/:hazardId/failure-conditions/:id',
  ctrl.deleteFailureCondition,
)

// --- FMEA worksheets --------------------------------------------------------
router.get('/projects/:projectId/fmea', ctrl.listFmeas)
router.post('/projects/:projectId/fmea', ctrl.createFmea)
router.get('/projects/:projectId/fmea/:id', ctrl.getFmea)
router.patch('/projects/:projectId/fmea/:id', ctrl.updateFmea)
router.delete('/projects/:projectId/fmea/:id', ctrl.deleteFmea)

// --- FMEA rows (RPN server-computed) ----------------------------------------
router.get('/projects/:projectId/fmea/:fmeaId/rows', ctrl.listFmeaRows)
router.post('/projects/:projectId/fmea/:fmeaId/rows', ctrl.createFmeaRow)
router.get('/projects/:projectId/fmea/:fmeaId/rows/:id', ctrl.getFmeaRow)
router.patch('/projects/:projectId/fmea/:fmeaId/rows/:id', ctrl.updateFmeaRow)
router.delete('/projects/:projectId/fmea/:fmeaId/rows/:id', ctrl.deleteFmeaRow)

export default router
