import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { list, assign, revoke } from '../controllers/adminUserRole.controller'

/**
 * #284: mounted at `/admin/user-roles` by routes/index.ts. Path suffixes
 * here are relative to that disjoint prefix so they cannot shadow other
 * routes defined under `/admin` (e.g. /admin/audit-log in admin.routes.ts).
 */
const router = Router()

router.use(authenticateToken, requireAdmin)

router.get('/', list)
router.post('/', assign)
router.delete('/', revoke)

export default router
