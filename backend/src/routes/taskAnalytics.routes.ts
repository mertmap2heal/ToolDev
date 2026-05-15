import { Router } from 'express'
import {
  getTaskStatistics,
  getCompletionTrends,
  getTeamPerformance,
  getWorkloadAnalysis,
} from '../controllers/taskAnalytics.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireBodyProjectMember } from '../middleware/requireTaskProjectMember.middleware'

const router = Router()

router.use(authenticateToken)

// All analytics endpoints require project_id and membership on that project —
// an unscoped query would leak task data across tenants.
router.get(
  '/statistics',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'task-analytics' }),
  getTaskStatistics
)
router.get(
  '/completion-trends',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'task-analytics' }),
  getCompletionTrends
)
router.get(
  '/team-performance',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'task-analytics' }),
  getTeamPerformance
)
router.get(
  '/workload',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'task-analytics' }),
  getWorkloadAnalysis
)

export default router
