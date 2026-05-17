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

// Compare two baselines (must come before /:projectId/:baselineId to avoid route conflicts)
router.get('/:projectId/compare', compareBaselines)

// Diff two R-4 BaselineRoot snapshots — structured field/line diff (NX-2 #440).
// Static segment, declared before the /:projectId/:baselineId param route.
router.get('/:projectId/roots/diff', compareBaselineRootsDiff)

// Get a specific baseline (must come before /:projectId to avoid route conflicts)
router.get('/:projectId/:baselineId', getBaseline)

// Get all baselines for a project
router.get('/:projectId', getBaselines)

// Create a new baseline
router.post('/:projectId', createBaseline)

// Lock a baseline
router.put('/:projectId/:baselineId/lock', lockBaseline)

// Delete a baseline
router.delete('/:projectId/:baselineId', deleteBaseline)

export default router
