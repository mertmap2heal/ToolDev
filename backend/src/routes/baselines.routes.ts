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

// Get all baselines for a project
router.get('/:projectId', getBaselines)

// Compare two baselines
router.get('/:projectId/compare', compareBaselines)

// Get a specific baseline
router.get('/:projectId/:baselineId', getBaseline)

// Create a new baseline
router.post('/:projectId', createBaseline)

// Lock a baseline
router.put('/:projectId/:baselineId/lock', lockBaseline)

// Delete a baseline
router.delete('/:projectId/:baselineId', deleteBaseline)

export default router
