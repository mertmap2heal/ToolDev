import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { list, exportNdjson } from '../controllers/aiInvocation.controller'

const router = Router()

router.get('/ai/invocations', authenticateToken, requireAdmin, list)
router.get('/ai/invocations/export', authenticateToken, requireAdmin, exportNdjson)

export default router
