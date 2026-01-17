import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getBaselines,
  getBaseline,
  createBaseline,
  lockBaseline,
  deleteBaseline,
  compareBaselines,
} from '../controllers/baseline.controller'

const router = Router()

router.use(authenticateToken)

// Compare two baselines (must come before /:projectId/:baselineId to avoid route conflicts)
router.get('/:projectId/compare', compareBaselines)

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
