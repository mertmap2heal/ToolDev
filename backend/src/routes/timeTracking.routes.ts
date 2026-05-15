import { Router } from 'express'
import {
  logTime,
  getTimeLogs,
  getTimeSummary,
  deleteTimeLog,
  updateTimeLog,
} from '../controllers/timeTracking.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireBodyTaskProjectMember,
  requireBodyProjectMember,
  requireTimeLogProjectMember,
} from '../middleware/requireTaskProjectMember.middleware'

const router = Router()

router.use(authenticateToken)

// #286: every write/read now passes a membership gate.
// logTime verifies the body's taskId belongs to a project the caller is in.
router.post('/', requireBodyTaskProjectMember(['taskId', 'task_id']), logTime)

// getTimeLogs / getTimeSummary demand a project_id query and verify membership.
router.get(
  '/',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'time-log' }),
  getTimeLogs
)
router.get(
  '/summary',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'time-log' }),
  getTimeSummary
)

// updateTimeLog / deleteTimeLog resolve the TimeLog -> task -> projectId
// and enforce membership. Controller further restricts to the log's owner
// unless the caller is a project owner/admin.
router.patch('/:id', requireTimeLogProjectMember(), updateTimeLog)
router.delete('/:id', requireTimeLogProjectMember(), deleteTimeLog)

export default router
