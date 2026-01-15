import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getRequirements,
  getRequirement,
  createRequirement,
  updateRequirement,
  deleteRequirement,
  getRequirementChildren,
} from '../controllers/requirement.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', getRequirements)
router.get('/:projectId/:requirementId', getRequirement)
router.get('/:projectId/:requirementId/children', getRequirementChildren)
router.post('/:projectId', createRequirement)
router.put('/:projectId/:requirementId', updateRequirement)
router.delete('/:projectId/:requirementId', deleteRequirement)

export default router
