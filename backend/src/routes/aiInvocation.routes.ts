import { Router } from 'express'
import { authenticateToken, requireAdmin, requireSuperiorAdmin } from '../middleware/auth.middleware'
import { list, exportNdjson, listForCompany } from '../controllers/aiInvocation.controller'

/**
 * Admin-only AI invocation audit endpoints. Every AI/MCP call writes one
 * AiInvocation row; these endpoints serve them for the admin UI and for
 * ISO/IEC 42001 Annex B audits.
 *
 * SECURITY (SEC-1, issue #374): requireAdmin admits both SUPERIOR_ADMIN
 * and COMPANY_ADMIN. The list/export endpoints have no projectId
 * argument, so admitting COMPANY_ADMIN at the route level without an
 * explicit tenant filter let one company admin read every other
 * tenant's AI ledger. The fix splits the surface:
 *
 *   - /ai/invocations         (list)   - SUPERIOR_ADMIN only, platform-wide
 *   - /ai/invocations/export  (export) - SUPERIOR_ADMIN only, platform-wide
 *   - /ai/invocations/company (list)   - admin (any tier), forced filter
 *                                        on AiInvocation.projectId ->
 *                                        Project.companyName == req.user.company
 *
 * Mirrors the correctly-protected sibling pattern in mcpKey.routes.ts.
 * Codified in .claude/kb/backend-patterns.md "Tenant Scope".
 */
const router = Router()

router.get('/ai/invocations', authenticateToken, requireSuperiorAdmin, list)
router.get('/ai/invocations/export', authenticateToken, requireSuperiorAdmin, exportNdjson)
router.get('/ai/invocations/company', authenticateToken, requireAdmin, listForCompany)

export default router
