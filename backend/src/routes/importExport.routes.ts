import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireBodyProjectMember } from '../middleware/requireTaskProjectMember.middleware'
import { exportTasks, importTasks } from '../controllers/importExport.controller'

const router = Router()

router.use(authenticateToken)

// #291: require project_id in the body and enforce membership before the
// controller runs. Matches the pattern used by every other task route.
router.post(
  '/export',
  requireBodyProjectMember('body', ['project_id', 'projectId']),
  exportTasks,
)
router.post(
  '/import',
  requireBodyProjectMember('body', ['project_id', 'projectId']),
  importTasks,
)

export default router
