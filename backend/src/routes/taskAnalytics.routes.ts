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
router.get('/statistics', requireBodyProjectMember('query'), getTaskStatistics)
router.get('/completion-trends', requireBodyProjectMember('query'), getCompletionTrends)
router.get('/team-performance', requireBodyProjectMember('query'), getTeamPerformance)
router.get('/workload', requireBodyProjectMember('query'), getWorkloadAnalysis)

export default router
