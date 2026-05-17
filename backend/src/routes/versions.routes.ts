import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  getRequirementVersions,
  getRequirementVersion,
  createRequirementVersion,
  compareVersions,
} from '../controllers/version.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Get all versions for a requirement
router.get('/:projectId/requirements/:requirementId', getRequirementVersions)

// Get a specific version
router.get('/:projectId/requirements/:requirementId/version/:versionNumber', getRequirementVersion)

// Create a version snapshot
router.post('/:projectId/requirements/:requirementId', createRequirementVersion)

// Compare two versions — structured field/line diff (NX-2 #440).
// `/diff` is the canonical NX-2 path; `/compare` is kept as an alias so any
// existing caller is not broken.
router.get('/:projectId/requirements/:requirementId/compare', compareVersions)
router.get('/:projectId/requirements/:requirementId/diff', compareVersions)

export default router
