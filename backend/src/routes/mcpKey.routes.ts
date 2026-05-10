import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { list, create, revoke } from '../controllers/mcpKey.controller'

/**
 * Admin key-management routes. Mounted at /api/v1/admin/projects.
 *
 *   GET    /:projectId/mcp-keys            - list
 *   POST   /:projectId/mcp-keys            - issue (plaintext returned once)
 *   DELETE /:projectId/mcp-keys/:keyId     - revoke
 *
 * SECURITY (HIGH-2): requireAdmin admits SUPERIOR_ADMIN AND COMPANY_ADMIN.
 * Without projectIdParam (which calls userCanAccessProject), a COMPANY_ADMIN
 * of company A could mint MCP keys for projects in company B. The param
 * resolver enforces tenant scope: SUPERIOR_ADMIN passes platform-wide,
 * COMPANY_ADMIN only when project.companyName === user.company.
 */
const router = Router()

router.use(authenticateToken, requireAdmin)
router.param('projectId', projectIdParam)
router.get('/:projectId/mcp-keys', list)
router.post('/:projectId/mcp-keys', create)
router.delete('/:projectId/mcp-keys/:keyId', revoke)

export default router
