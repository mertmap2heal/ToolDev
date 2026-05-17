/**
 * OpenAPI 3.1 specification builder — NX-5 (#451).
 *
 * `swagger-jsdoc` scans the `@openapi` JSDoc annotation blocks on the route
 * files (`backend/src/routes/*.routes.ts`) and assembles a single OpenAPI
 * 3.1.0 document. One builder, two consumers:
 *
 *   1. The runtime docs endpoint (`routes/docs.routes.ts`) calls
 *      `buildOpenApiSpec()` once at boot to feed `swagger-ui-express`.
 *   2. The generation script (`scripts/generate-openapi.ts`) calls it to
 *      write the committed, source-controlled `backend/openapi.json`.
 *
 * Convention for annotating endpoints is codified in
 * `.claude/kb/backend-patterns.md` ("OpenAPI annotation convention").
 */
import path from 'path'
import { fileURLToPath } from 'url'
import swaggerJSDoc from 'swagger-jsdoc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * The committed spec records this version. Kept in step with
 * `backend/package.json` `version`.
 */
export const OPENAPI_DOC_VERSION = '1.0.0'

/**
 * Glob patterns swagger-jsdoc scans for `@openapi` blocks.
 *
 * `__dirname` is `.../src/openapi` under `tsx`/Vitest and `.../dist/openapi`
 * under a compiled `node dist` run. The route files keep their `@openapi`
 * comments in BOTH trees: under `tsx` the `.ts` sources carry them; a
 * `tsc` build copies comments into the emitted `.js`. Scanning both
 * extensions makes the builder runtime-agnostic. The standalone generation
 * script overrides this with an explicit absolute path (see below).
 */
function defaultApiGlobs(): string[] {
  const routesDir = path.resolve(__dirname, '..', 'routes')
  return [
    path.join(routesDir, '*.routes.ts'),
    path.join(routesDir, '*.routes.js'),
  ]
}

/**
 * The OpenAPI document's static head — everything that is not derived from
 * a route-file annotation. swagger-jsdoc merges the scanned `paths` and
 * `components` into this object.
 */
function baseDefinition(): swaggerJSDoc.SwaggerDefinition {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Engineering Project Development Tool — REST API',
      version: OPENAPI_DOC_VERSION,
      description:
        'REST API for the Engineering Project Development Tool — an ' +
        'AI-powered, certification-native platform for the engineering ' +
        'lifecycle (Requirements -> System Functions -> Architecture -> ' +
        'Verification -> Certification).\n\n' +
        'All endpoints are mounted under `/api/v1`. Every endpoint returns ' +
        'the standard response envelope: `{ success: true, data, message? }` ' +
        'on success, `{ success: false, error }` on failure. Most endpoints ' +
        'require a JWT bearer token (`Authorization: Bearer <token>`); the ' +
        'MCP Streamable HTTP surface (`/mcp`) authenticates with a scoped ' +
        'API key instead.\n\n' +
        'This document is generated from `@openapi` JSDoc annotations on ' +
        'the route files. The first tranche (auth, requirements, baselines, ' +
        'verification, certification) is fully annotated; the remaining ' +
        'route files are back-filled in follow-on work.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'API v1 (relative — same origin as this docs page)',
      },
    ],
    tags: [
      { name: 'Auth', description: 'Authentication, session, and user-account management.' },
      { name: 'Requirements', description: 'Requirements authoring, traceability, audit, and ReqIF import.' },
      { name: 'Baselines', description: 'Project baselines — snapshot, lock, compare.' },
      { name: 'Verification', description: 'Verification — methods, test cases, plans, runs, evidence, coverage, baselines.' },
      { name: 'Certification', description: 'Certification lifecycle — objectives, compliance matrix, evidence, findings, reviews, sign-offs, audit packages.' },
    ],
    components: {
      securitySchemes: {
        /**
         * The session JWT carried by `Authorization: Bearer <token>`.
         * Issued by `POST /auth/login` and `POST /auth/register`; verified
         * by the `authenticateToken` middleware.
         */
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description:
            'Session JWT. Obtain via `POST /auth/login` or ' +
            '`POST /auth/register`; send as `Authorization: Bearer <token>`.',
        },
        /**
         * The scoped API key used by the MCP Streamable HTTP surface
         * (`/mcp`). NOT the session JWT — a distinct credential family.
         */
        mcpKey: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Scoped MCP API key for the `/mcp` Streamable HTTP endpoint. ' +
            'Managed under `/admin/projects/.../mcp-keys`. Distinct from ' +
            'the session JWT.',
        },
      },
      schemas: {
        /**
         * The success envelope from `kb/backend-patterns.md`
         * ("Standard Response Shape"). `data` is operation-specific —
         * individual operations narrow it with `allOf`.
         */
        SuccessEnvelope: {
          type: 'object',
          required: ['success'],
          properties: {
            success: { type: 'boolean', enum: [true], description: 'Always `true` for a successful response.' },
            data: { description: 'The operation-specific payload.' },
            message: { type: 'string', description: 'Optional human-readable note.' },
          },
        },
        /**
         * The error envelope from `kb/backend-patterns.md`. Returned with
         * a 4xx/5xx status.
         */
        ErrorEnvelope: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: { type: 'boolean', enum: [false], description: 'Always `false` for an error response.' },
            error: { type: 'string', description: 'Human-readable error message.' },
          },
        },
      },
      parameters: {
        /**
         * The `:projectId` route parameter. Resolved + membership-checked by
         * the `projectIdParam` / `requireProjectMember` middleware on every
         * project-scoped router. Referenced by name from route annotations.
         */
        RequirementsProjectId: {
          in: 'path',
          name: 'projectId',
          required: true,
          schema: { type: 'string' },
          description: 'The project id. Membership-checked by the route middleware.',
        },
        /** The `:requirementId` route parameter. */
        RequirementId: {
          in: 'path',
          name: 'requirementId',
          required: true,
          schema: { type: 'string' },
          description: 'The requirement id.',
        },
        /**
         * The `:projectId` route parameter on certification routes. Same
         * shape as `RequirementsProjectId`; named separately so each tagged
         * surface owns its parameter component.
         */
        CertProjectId: {
          in: 'path',
          name: 'projectId',
          required: true,
          schema: { type: 'string' },
          description: 'The project id. Membership-checked by the route middleware.',
        },
        /**
         * The `:projectId` route parameter on verification routes.
         */
        VerProjectId: {
          in: 'path',
          name: 'projectId',
          required: true,
          schema: { type: 'string' },
          description: 'The project id. Membership-checked by the route middleware.',
        },
        /**
         * The generic `:id` route parameter on verification routes — the id
         * of the entity named by the path segment before it.
         */
        VerEntityId: {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string' },
          description: 'The id of the verification entity.',
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Missing, malformed, or expired JWT bearer token.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: { success: false, error: 'Unauthorized' },
            },
          },
        },
        ForbiddenError: {
          description: 'Authenticated but not permitted (not a project member, insufficient role, or failed re-auth gate).',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: { success: false, error: 'Forbidden' },
            },
          },
        },
        NotFoundError: {
          description: 'The requested resource does not exist.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: { success: false, error: 'Not found' },
            },
          },
        },
        ValidationError: {
          description: 'The request body or parameters failed validation.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: { success: false, error: 'name is required' },
            },
          },
        },
        ServerError: {
          description: 'Unexpected server error.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorEnvelope' },
              example: { success: false, error: 'Internal server error' },
            },
          },
        },
      },
    },
    /**
     * Default security: every operation requires the JWT bearer token
     * unless it overrides this with `security: []` (public — e.g.
     * `/auth/login`) or `security: [{ mcpKey: [] }]` (MCP surface).
     */
    security: [{ bearerAuth: [] }],
  }
}

/**
 * Build the full OpenAPI 3.1 document by scanning the route-file `@openapi`
 * annotations and merging them into `baseDefinition()`.
 *
 * @param apiGlobs - override the scan globs. The generation script passes
 *   absolute `.ts` paths so it works regardless of the process CWD.
 */
export function buildOpenApiSpec(apiGlobs?: string[]): Record<string, unknown> {
  const spec = swaggerJSDoc({
    definition: baseDefinition(),
    apis: apiGlobs && apiGlobs.length > 0 ? apiGlobs : defaultApiGlobs(),
  }) as Record<string, unknown>
  return spec
}
