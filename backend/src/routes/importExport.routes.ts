import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { exportTasks, importTasks } from '../controllers/importExport.controller'

const router = Router()

router.use(authenticateToken)

router.post('/export', exportTasks)
router.post('/import', importTasks)

export default router
