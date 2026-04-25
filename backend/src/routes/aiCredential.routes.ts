import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { list, create, revoke } from '../controllers/aiCredential.controller'

/**
 * Mount point: /api/v1/ai/credentials
 *
 * User-scoped BYOK credentials. No project param - a credential belongs
 * to the user and can be used across every project they have AI access
 * to. The three-layer AI feature flag is enforced at call time
 * (draftParameter etc.), not at credential-management time, so a user
 * can stage a key before an admin enables the project's `aiEnabled`.
 */
const router = Router()

router.use(authenticateToken)
router.get('/credentials', list)
router.post('/credentials', create)
router.delete('/credentials/:id', revoke)

export default router
