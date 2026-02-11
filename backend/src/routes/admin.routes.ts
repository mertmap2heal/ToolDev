import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { getRoles, createRole, updateRole, getAuditLog } from '../controllers/admin.controller'

const router = Router()

router.use(authenticateToken, requireAdmin)

router.get('/roles', getRoles)
router.post('/roles', createRole)
router.put('/roles/:id', updateRole)
router.get('/audit-log', getAuditLog)

export default router
