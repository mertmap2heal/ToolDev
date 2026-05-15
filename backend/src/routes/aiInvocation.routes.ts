import { Router, RequestHandler } from 'express'
import { AuthRequest, authenticateToken, requireAdmin, requireSuperiorAdmin } from '../middleware/auth.middleware'
import {
  list,
  exportNdjson,
  listForCompany,
  writeAccessAudit,
  AiInvocationAuditAction,
} from '../controllers/aiInvocation.controller'

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
 *
 * Every gate denial - 403 from requireSuperiorAdmin / requireAdmin -
 * writes one row to the central AuditLog so SUPERIOR_ADMIN can audit
 * the audit endpoints themselves (AC #5 of issue #374 requires audit on
 * success AND failure). The wrapper below intercepts res.status(403)
 * after the underlying gate rejects so the controller never has to
 * run; 401 from authenticateToken is intentionally not audited because
 * an unauthenticated caller has no req.userId to attribute.
 */
function withDenyAudit(
  gate: RequestHandler,
  deniedAction: AiInvocationAuditAction,
): RequestHandler {
  return (req, res, next) => {
    const authReq = req as AuthRequest
    // Override res.status / res.json so that when the gate writes the
    // 403 response, we await the audit write before forwarding the
    // actual response body. supertest awaits the response body, so this
    // pattern guarantees the AuditLog row is committed before the
    // caller observes the 403 - matching the regulatory expectation
    // that every gate denial leaves an audit trail.
    //
    // NOTE on outer middleware: routes/index.ts mounts adminRoutes at
    // /admin before this router. adminRoutes calls
    // `router.use(authenticateToken, requireAdmin)` so any non-admin
    // caller is rejected by adminRoutes before this wrapper runs. For
    // /ai/invocations and /ai/invocations/export, a COMPANY_ADMIN
    // passes adminRoutes but is denied by this wrapper's
    // requireSuperiorAdmin - that path is fully audited here. For
    // /ai/invocations/company, non-admin denial is owned by adminRoutes
    // (out of scope for SEC-1); controller-level deny paths (400
    // no-company, 403 scope-forbidden) are audited inside the
    // controller. See _shared/cross-cutting.md "AiInvocation ledger
    // leaks cross-tenant via requireAdmin" and the linked admin-platform
    // tickets for the long-term consolidation.
    const originalStatus = res.status.bind(res)
    const originalJson = res.json.bind(res)
    let lastStatus = 200
    res.status = ((code: number) => {
      lastStatus = code
      return originalStatus(code)
    }) as typeof res.status
    res.json = ((body: unknown) => {
      if (lastStatus === 403 && authReq.userId) {
        ;(async () => {
          try {
            await writeAccessAudit(authReq.userId as string, deniedAction, {
              path: req.originalUrl ?? req.path,
              reason: 'auth-gate-denied',
            })
          } catch {
            /* never block the response on audit failure */
          }
          originalJson(body)
        })()
        return res
      }
      return originalJson(body)
    }) as typeof res.json
    gate(req, res, next)
  }
}

const router = Router()

router.get(
  '/ai/invocations',
  authenticateToken,
  withDenyAudit(requireSuperiorAdmin, 'admin:ai-invocations-read-denied'),
  list,
)
router.get(
  '/ai/invocations/export',
  authenticateToken,
  withDenyAudit(requireSuperiorAdmin, 'admin:ai-invocations-export-denied'),
  exportNdjson,
)
router.get(
  '/ai/invocations/company',
  authenticateToken,
  withDenyAudit(requireAdmin, 'admin:ai-invocations-company-read-denied'),
  listForCompany,
)

export default router
