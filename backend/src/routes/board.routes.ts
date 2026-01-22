import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { getColumns, updateColumn, moveTask } from '../controllers/board.controller'

const router = Router()

router.use(authenticateToken)

router.get('/columns', getColumns)
router.patch('/columns/:id', updateColumn)
router.post('/move-task', moveTask)

export default router
