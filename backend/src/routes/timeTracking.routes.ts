import { Router } from 'express'
import {
  logTime,
  getTimeLogs,
  getTimeSummary,
  deleteTimeLog,
  updateTimeLog,
} from '../controllers/timeTracking.controller'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

router.post('/', logTime)
router.get('/', getTimeLogs)
router.get('/summary', getTimeSummary)
router.patch('/:id', updateTimeLog)
router.delete('/:id', deleteTimeLog)

export default router
