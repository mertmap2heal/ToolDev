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

// Compare two versions
router.get('/:projectId/requirements/:requirementId/compare', compareVersions)

export default router
