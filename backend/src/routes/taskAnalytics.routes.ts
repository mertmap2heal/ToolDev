import { Router } from 'express'
import {
  getTaskStatistics,
  getCompletionTrends,
  getTeamPerformance,
  getWorkloadAnalysis,
} from '../controllers/taskAnalytics.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

router.get('/statistics', getTaskStatistics)
router.get('/completion-trends', getCompletionTrends)
router.get('/team-performance', getTeamPerformance)
router.get('/workload', getWorkloadAnalysis)

export default router
