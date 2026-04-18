import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireTaskProjectMember,
  requireBodyProjectMember,
  requireBodyTaskProjectMember,
} from '../middleware/requireTaskProjectMember.middleware'
import { getColumns, updateColumn, moveTask } from '../controllers/board.controller'

const router = Router()

router.use(authenticateToken)

// GET /board/columns?project_id=... — must be a member of that project.
router.get('/columns', requireBodyProjectMember('query'), getColumns)

// PATCH /board/columns/:id — resolve column's project, enforce membership.
router.patch('/columns/:id', requireTaskProjectMember('column'), updateColumn)

// POST /board/move-task — task_id in body; resolve task's project then membership.
router.post('/move-task', requireBodyTaskProjectMember(), moveTask)

export default router
