import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { list, assign, revoke } from '../controllers/adminUserRole.controller'

const router = Router()

router.use(authenticateToken, requireAdmin)

router.get('/user-roles', list)
router.post('/user-roles', assign)
router.delete('/user-roles', revoke)

export default router
