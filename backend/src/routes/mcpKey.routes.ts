import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { list, create, revoke } from '../controllers/mcpKey.controller'

/**
 * Admin key-management routes. Mounted at /api/v1/admin/projects.
 *
 *   GET    /:projectId/mcp-keys            - list
 *   POST   /:projectId/mcp-keys            - issue (plaintext returned once)
 *   DELETE /:projectId/mcp-keys/:keyId     - revoke
 */
const router = Router()

router.use(authenticateToken, requireAdmin)
router.get('/:projectId/mcp-keys', list)
router.post('/:projectId/mcp-keys', create)
router.delete('/:projectId/mcp-keys/:keyId', revoke)

export default router
