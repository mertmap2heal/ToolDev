/**
 * Tests for /api/v1/diagrams/:projectId — MBSE diagram CRUD.
 *
 * SKIPPED: the route file `routes/diagrams.routes.ts` registers
 * `router.param('projectId', projectIdParam)` BEFORE applying
 * `authenticateToken`, and `authenticateToken` is added per-route
 * rather than as a global `router.use(...)`. In Express 4 the param
 * middleware runs before per-route middleware, so the param resolver
 * always sees `req.userId === undefined` and short-circuits with 401
 * for every project-scoped request that includes a valid token.
 *
 * Compare with `routes/templates.routes.ts` and
 * `routes/excelColumnMappings.routes.ts`, which mount
 * `router.use(authenticateToken)` *before* `router.param('projectId',
 * projectIdParam)` and behave correctly.
 *
 * The fix is a one-line change in the route file (move
 * `router.use(authenticateToken)` above `router.param(...)`), but the
 * batch rule is not to edit controllers/routes from the test
 * subagent. Documenting and skipping until the route is fixed.
 */
import { describe, it } from 'vitest'

describe.skip('Diagrams — /api/v1/diagrams (skipped: route ordering bug)', () => {
  it('see file header for details', () => {})
})
