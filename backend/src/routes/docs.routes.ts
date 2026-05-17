/**
 * API documentation router — NX-5 (#451).
 *
 * Serves the interactive Swagger UI at `/api/v1/docs` and the raw OpenAPI
 * 3.1 document at `/api/v1/docs/openapi.json`.
 *
 * PUBLIC — this router carries NO `authenticateToken` middleware and is
 * mounted in `server.ts` AHEAD of the `authenticateToken`-gated `/api/v1`
 * aggregate router. The spec describes endpoint *shapes*, not data; every
 * documented endpoint remains protected by its own middleware chain, so
 * publishing the contract leaks no tenant data. This matches the access
 * posture of every named competitor's REST docs (`competitor-matrix.md`
 * §7) and the existing unauthenticated `GET /api/v1` API index.
 *
 * The spec is built once at module load (`buildOpenApiSpec()`); rebuilding
 * per request would re-scan every route file on every hit.
 */
import { Router } from 'express'
import swaggerUi from 'swagger-ui-express'
import { buildOpenApiSpec } from '../openapi/openapi.js'

const router = Router()

// Built once at boot — the route-file annotations do not change at runtime.
const openApiSpec = buildOpenApiSpec()

/**
 * Raw OpenAPI 3.1 document. Declared before the `swaggerUi.serve` mount so
 * the `/openapi.json` path is not shadowed by the UI asset middleware.
 *
 * @openapi
 * /docs/openapi.json:
 *   get:
 *     tags: [Documentation]
 *     summary: Raw OpenAPI 3.1 specification
 *     description: >-
 *       The machine-readable OpenAPI 3.1 document for this API. Public — no
 *       authentication required. The same document the Swagger UI at
 *       `/api/v1/docs` renders.
 *     security: []
 *     responses:
 *       '200':
 *         description: The OpenAPI 3.1 document.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               description: An OpenAPI 3.1 document object.
 *             example:
 *               openapi: '3.1.0'
 *               info:
 *                 title: Engineering Project Development Tool — REST API
 *                 version: '1.0.0'
 *               paths: {}
 */
router.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec)
})

/**
 * Interactive Swagger UI. `swaggerUi.serve` serves the static UI assets;
 * `swaggerUi.setup` renders the explorer for the built spec.
 */
router.use('/', swaggerUi.serve)
router.get('/', swaggerUi.setup(openApiSpec, {
  customSiteTitle: 'Engineering Tool API — v1 docs',
  swaggerOptions: {
    // Sort tags and operations alphabetically for a stable UI.
    tagsSorter: 'alpha',
    operationsSorter: 'alpha',
  },
}))

export default router
