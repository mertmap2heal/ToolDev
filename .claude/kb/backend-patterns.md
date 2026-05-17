# Backend Patterns & Pitfalls

Express + Prisma + TypeScript patterns for this project's backend.
Read alongside `architecture.md` and `database.md`.

---

## Prisma Import — Always Use the Singleton

There is ONE correct import for the Prisma client:

```ts
import { prisma } from '../lib/prisma'
```

**Never** instantiate your own `PrismaClient`:
```ts
// WRONG — creates a second connection pool; leaks connections in development
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
```

No exceptions — every module imports the singleton, including middleware. The previous duplicate in `auth.middleware.ts` was removed in #147 (the singleton is always ready at import time; the startup-ordering concern that motivated the original duplication never applied).

---

## Controller → Service Layer Boundary

**Controllers** handle HTTP concerns: parsing request, sending response, catching errors.
**Services** handle business logic: queries, transformations, domain rules.

```ts
// controller — thin, always try/catch
export async function createParameter(req: AuthRequest, res: Response) {
  try {
    const data = await parameterService.create(req.params.projectId, req.body)
    res.status(201).json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

// service — business logic, throws on error
export async function create(projectId: string, body: CreateParameterDto) {
  if (!body.name) throw new Error('Name is required')
  return prisma.parameter.create({
    data: { projectId, name: body.name, ... }
  })
}
```

Rules:
- Services **throw** — never call `res.json()` inside a service
- Controllers **catch** — never call Prisma directly in a controller
- Never import controllers from services (one-way dependency)

---

## Standard Response Shape

Every endpoint must return this shape:

```ts
// Success
res.json({ success: true, data: T, message?: string })
// 201 for creates
res.status(201).json({ success: true, data: T })

// Error
res.status(400).json({ success: false, error: 'Validation message' })
res.status(404).json({ success: false, error: 'Parameter not found' })
res.status(500).json({ success: false, error: (e as Error).message })
```

**Never** return raw data without the `success` wrapper — the frontend
services all expect this shape.

---

## Authentication Middleware

Every protected route must go through `authenticateToken`:

```ts
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'

// User must be authenticated
router.get('/parameters', authenticateToken, ctrl.list)

// User must be admin
router.delete('/users/:id', authenticateToken, requireAdmin, ctrl.deleteUser)
```

After `authenticateToken`, the request type becomes `AuthRequest`:
```ts
import { AuthRequest } from '../middleware/auth.middleware'

export async function list(req: AuthRequest, res: Response) {
  const userId = req.user!.userId   // guaranteed to exist after auth middleware
  const email = req.user!.email
  const role = req.user!.role
}
```

Do not skip `authenticateToken` on any route that accesses project or user data.
Only intentionally public routes (health check, invite accept, password reset)
should be unprotected.

### Project-scoped routes — `projectIdParam` + `requireProjectMember`

Any route file whose paths carry a `:projectId` segment must, after
`authenticateToken`, apply **both** of these in order:

1. `router.param('projectId', projectIdParam)` — resolves slug/UUID **and**
   access-checks the caller (returns 403 for non-members; #281 tenant-scopes
   the `COMPANY_ADMIN` bypass). This is the load-bearing gate.
2. `router.use('/:projectId', requireProjectMember)` — explicit
   defence-in-depth gate, so the protection survives a future edit that
   removes the param handler or adds a non-`:projectId` route.

```ts
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/:projectId', requireProjectMember)
```

`changeRequests.routes.ts` is the canonical reference. The two lines are
deliberately redundant — do not "tidy up" by deleting either; the
`tenantScope.test.ts` smoke suite asserts a real 403 for a non-member against
each project-scoped route file and would fail if a gate is removed.
`requireProjectMember` is not a tenant *filter* — it admits accepted members,
the legacy owner, and (tenant-scoped) platform admins; the controller must
still scope its own queries by the resolved `projectId`.

### Reauthentication for sign-off endpoints (`requireReauth`)

CFR 21 Part 11 signing events require the user to re-enter their password at
sign time. R-2 landed the primitive:

- `POST /api/v1/auth/reauth` — the caller (already authenticated) posts
  `{ password }`; on success it returns `{ reauthToken, expiresAt }`. The
  `reauthToken` is a 60-second JWT carrying `purpose: 'reauth'`.
- `requireReauth` middleware — attach it **after** `authenticateToken` on any
  sign-off / signature endpoint. It validates the `X-Reauth-Token` header
  against `req.user` (signature, expiry, `purpose`, and `userId` match).

```ts
import { authenticateToken, requireReauth } from '../middleware/auth.middleware'
router.post('/:id/sign-off', authenticateToken, requireReauth, ctrl.signOff)
```

A reauth token cannot be used as a session token, nor a session token as a
reauth token — the `purpose` claim is enforced in both `authenticateToken`
and `requireReauth`. The 60-second token is not single-use; an endpoint that
needs one reauth per signing event must enforce that itself.

### Recording a signature (`SignatureEvent`)

The CFR 21 Part 11 sign-off path is `authenticateToken` -> `requireReauth`
-> `signature.service.ts`. R-3 landed the primitive:

- `SignatureEvent` is the one signature table for every module — polymorphic
  via `linkedEntityType` / `linkedEntityId`. It is **append-only**: a
  `prisma.$use` middleware rejects `update` / `delete` on it. A row is never
  mutated.
- `createSignature(...)` records a signature — it validates `meaningCode`
  against the Part 11 vocabulary (`review` / `approval` / `responsibility` /
  `authorship`) and computes the `contentHash` (sha256) server-side.
- Revocation is `supersedeSignature(...)` — it appends a new row carrying
  `supersededById`; the superseded row stays intact.

A sign-off endpoint derives the signer from `req.user` (never the body), runs
`requireReauth`, then calls `createSignature`. Do not write a per-module
sign-off table — consume `SignatureEvent` via `linkedEntityType`.

### Discipline-gated sign-off authorisation (`requireEngineeringRole`)

`EngineeringRole` (the project-scoped discipline catalogue — Verification
Engineer, Configuration Manager, CCB Member, ...) gates **who may sign an
artefact**. `AdminRole` gates **whether the endpoint can be called at all**.
Different primitives — do not conflate them. R-7 landed the discipline gate:

- `requireEngineeringRole(roleNames: string[], opts?: { projectIdParam?: string })`
  is a middleware **factory**. Attach it after `authenticateToken` (and after
  `requireReauth` on a signing endpoint). It resolves the project id from the
  route (`opts.projectIdParam`, else `:projectId`, else `:id`) and admits the
  caller only if they hold one of `roleNames` via `ProjectUserEngineeringRole`
  on that project.
- A platform admin (`SUPERIOR_ADMIN` / `COMPANY_ADMIN` / `ADMIN_EMAILS`)
  bypasses — break-glass. A project **owner** does **not** bypass: ownership
  is a management capability, not an engineering discipline.
- Fails closed — DB error returns 500, empty `roleNames` returns 403, a
  missing project id returns 500. No path reaches `next()` without a positive
  decision.
- It is a *discipline* gate, not a *membership* gate. A consumer must compose
  a current-membership check ahead of it — a stale `ProjectUserEngineeringRole`
  row could otherwise authorise a signature after the user left the project.

The role catalogue is one shared constant — `PREDEFINED_ENGINEERING_ROLES` in
`lib/engineeringRoles.ts` — seeded by `npm run seed:engineering-roles`
(idempotent, upsert-by-name; wired into `start.ps1`). The full signing chain
is `authenticateToken` -> `requireReauth` -> `requireEngineeringRole([...])`
-> `createSignature`.

---

## Tenant Scope — `requireAdmin` Is Not a Tenant Filter

`requireAdmin` admits **both** `SUPERIOR_ADMIN` (platform-wide) and
`COMPANY_ADMIN` (single-tenant). It is a capability gate, not a tenant filter.
A route gated only by `requireAdmin` that reads data spanning multiple
customers leaks every customer's rows to the first `COMPANY_ADMIN` who calls
it. This was the SEC-1 finding on the AI invocation ledger (issue #374).

**Rule.** Any endpoint exposing data that could span multiple tenants must
declare its tenant scope at the route level. The controller must either:

1. Restrict to `SUPERIOR_ADMIN` explicitly via `requireSuperiorAdmin`, or
2. Apply a `companyName` or `projectId` filter derived from `req.user`
   (never from `req.body` or `req.query`).

```ts
// WRONG — admits COMPANY_ADMIN with no tenant filter; leaks cross-tenant
router.get('/admin/ai/invocations', authenticateToken, requireAdmin, list)

// CORRECT — split the surface
router.get('/admin/ai/invocations', authenticateToken, requireSuperiorAdmin, list)
router.get('/admin/ai/invocations/company', authenticateToken, requireAdmin, listForCompany)
//   listForCompany derives caller.company from req.userId and forces
//   `where: { projectId: { in: <projects whose companyName matches> } }`.
```

The correctly-protected sibling pattern is in `mcpKey.routes.ts:13-18` — its
`projectIdParam` resolver scopes a project-id URL parameter against the
caller's company before the controller runs. Reach for that pattern any time
the URL carries a `:projectId`. When the URL has no project parameter (admin
ledger views, cross-tenant exports), use the SUPERIOR_ADMIN / company-split
pattern above.

Every access attempt - success or 403 - should write one row to the central
`AuditLog` using the `<module>:<kebab-verb>` action convention
(`admin:ai-invocations-read`, `admin:ai-invocations-company-read`, etc.) so
SUPERIOR_ADMIN can audit the audit endpoints themselves.

---

## Soft Deletes — Always Filter `deletedAt`

`Requirement` and `RequirementExportTemplate` use soft deletes.
**Always** filter in Prisma queries or you will return deleted records:

```ts
// WRONG — returns deleted requirements
await prisma.requirement.findMany({ where: { projectId } })

// CORRECT
await prisma.requirement.findMany({
  where: { projectId, deletedAt: null }
})
```

The daily cleanup job in `cleanup.service.ts` permanently purges records where
`deletedAt < 30 days ago`. Until then, soft-deleted records still exist in the DB.

---

## Route Registration

All routes are registered in `backend/src/routes/index.ts`. Pattern:

```ts
// 1. Create the route file
// backend/src/routes/myFeature.routes.ts
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import * as ctrl from '../controllers/myFeature.controller'

const router = Router()
router.get('/:projectId/my-feature', authenticateToken, ctrl.list)
router.post('/:projectId/my-feature', authenticateToken, ctrl.create)
export default router

// 2. Register in index.ts
import myFeatureRoutes from './myFeature.routes'
router.use('/', myFeatureRoutes)
```

All routes are mounted under `/api/v1/` by `server.ts`.

---

## File Uploads

Express is configured with a 50MB body parsing limit in `server.ts`.
For file upload routes, use `multer` (already installed):

```ts
import multer from 'multer'
const upload = multer({ storage: multer.memoryStorage() })

router.post('/import', authenticateToken, upload.single('file'), ctrl.import)
```

Uploaded files are served statically from `/uploads` via Express.
The directory is gitignored — it is created at runtime.

---

## Prisma Schema Changes

Order of operations — **never deviate from this**:

```bash
# 1. Edit backend/prisma/schema.prisma

# 2. Regenerate the Prisma client
npx prisma generate

# 3. Sync schema to the dev database (no migration file created)
npx prisma db push --skip-generate

# 4. Restart the backend (tsx watch will restart automatically)
```

For production/tracked migrations:
```bash
npx prisma migrate dev --name add-parameter-folder
# This is interactive — only run in a real terminal
```

**Never run `prisma db push` without `prisma generate` first.** The Prisma client
will be stale and TypeScript types will not reflect the new schema.

---

## AI-Provenance Lattice

Cert-relevant models carry an 8-field AI-provenance lattice — the audit spine
of the AI-native claim (`ai-ready-vision.md` §6.1). R-1 applied it to 22
models; `Parameter` is the original pilot.

Copy this block verbatim into any **new** cert-relevant model:

```prisma
authorType             String    @default("human")
authorAiModel          String?
authorAiVersion        String?
authorAiPromptId       String?
authorAiContextHash    String?
provenanceReviewStatus String    @default("drafted")
reviewerUserId         String?
reviewTimestamp        DateTime?
```

- **Human writes need no code** — `authorType` defaults to `"human"`, so an
  ordinary `create()` records correct provenance with zero controller code.
- **AI write paths must stamp** — a path where an AI agent authors the row
  sets `authorType` to `ai_suggestion` / `ai_accepted` / `ai_applied` and
  fills the `authorAi*` fields (model, version, prompt id, context hash).
- **Review transitions** set `provenanceReviewStatus`, `reviewerUserId`, and
  `reviewTimestamp` when a human reviews the row.
- `Parameter` (the pilot) names its review field `reviewStatus`, not
  `provenanceReviewStatus` — a known naming inconsistency; use
  `provenanceReviewStatus` for every new model.

---

## Baselines (`BaselineRoot`)

`BaselineRoot` is the unified baseline primitive (R-4). A baseline is a
content-hashed snapshot of a set of artefacts at a point in time.

- `BaselineRoot` — `(projectId, kind, name, status, createdByUserId)`.
  `kind` is `VER` / `CERT` / `PARAM` / `VALIDATION` / `CM`; `status`
  transitions `draft -> frozen`.
- `BaselineRootItem` — one polymorphic, content-hashed row per snapshotted
  artefact (`linkedEntityType` / `linkedEntityId` / `contentHash`).
- `baseline.service.ts` — `createBaselineRoot` / `addBaselineItem` (rejects
  a frozen root) / `freezeBaselineRoot` / `getBaselineRoot` /
  `listBaselineRoots` / `compareBaselineRoots` (the kind-agnostic
  added / removed / changed diff).

A baseline is signed by reusing `SignatureEvent` with
`linkedEntityType='BaselineRoot'` — there is no separate baseline-signature
table. A consuming endpoint must scope `projectId` from `req.user` and write
a `baseline:root-create` / `baseline:root-freeze` `AuditLog` row — the
service writes none.

---

## AI Invocation -> Artefact Join (`AiInvocationLink`)

`AiInvocation` is the AI call ledger. `AiInvocationLink` (R-5) joins an
invocation to the artefact(s) it produced, so the audit can answer "which
prompt produced REQ-1024" (`ai-ready-vision.md` §6.2).

- When an AI write path creates or modifies an artefact, call
  `linkInvocationToArtefact(invocationId, artefactType, artefactId)` —
  `artefactType` is a free string (`Requirement`, `Parameter`, ...), the
  `TraceLink` polymorphic convention.
- Query both directions via `getArtefactsForInvocation` /
  `getInvocationsForArtefact` in `aiInvocationLink.service.ts`.
- `AiInvocation.credentialId` is the nullable BYOK `UserAiCredential` that
  carried the outbound call (null for default-tier hosted calls).
- The join carries no `projectId` — tenant is reached transitively through
  `invocationId -> AiInvocation.projectId`. A consuming endpoint must scope.

---

## Regulated Mode (`Project.strictMode`)

`Project.strictMode` (R-6) is the project-wide regulated-mode flag. When
`true`, regulated modules (CM, Verification, Validation, Certification,
Safety) enforce audit-grade behaviour — CIs locked by a baseline are
immutable, baseline approval needs two signers, deviation / waiver
transitions are append-only, and so on (`kb/configuration-management.md`
lists the full set). When `false` those constraints degrade to warnings so
unregulated customers can iterate fast.

- It is **distinct from `strictLifecycleGates`** — that older flag gates only
  lifecycle-status transitions. `strictMode` is the broad posture switch.
- The flag has exactly one write path: `PATCH /projects/:id/strict-mode`,
  guarded by `authenticateToken -> resolveProjectParam ->
  requireProjectOwnerOrAdmin` and audited (`project:strict-mode-set`). It is
  deliberately NOT settable via the general `PUT /:id` — one controlled,
  audited mutation.

A module that **enforces** `strictMode` must:

- **Re-read it server-side** from `Project` — never trust a client-supplied
  value.
- **Fail closed** — if the flag cannot be read, treat the project as strict.
- Read it **in the same transaction** as the gated write, so a concurrent
  toggle cannot race the enforcement check.

R-6 ships the flag UNUSED — no module enforces it yet; each regulated module
wires its enforcement in its own ticket.

---

## Parameterised Queries — No Raw String Interpolation

Always use Prisma's parameterised API. When `$queryRaw` is unavoidable,
use the tagged template literal form:

```ts
// WRONG — SQL injection vulnerability
await prisma.$queryRaw(`SELECT * FROM "Parameter" WHERE name = '${name}'`)

// CORRECT — Prisma tagged template (auto-parameterised)
await prisma.$queryRaw`SELECT * FROM "Parameter" WHERE name = ${name}`

// Or use the standard Prisma API
await prisma.parameter.findMany({ where: { name } })
```

---

## Real-Time Events (Socket.IO)

Socket.IO events are defined in `backend/src/realtime/realtime.ts`.
To emit an event from a service:

```ts
import { getIO } from '../realtime/realtime'

const io = getIO()
io.emit('parameter:updated', { projectId, parameterId })
```

Do not import `io` directly from `server.ts` — use the `getIO()` getter which
handles the case where Socket.IO is not yet initialised.

---

## Audit Logging — central table + action-string convention

The central `AuditLog` table is the canonical audit sink. Do **not** add a
private per-module audit table — the codebase already carries 11 outliers
(`VerAuditEvent`, `TaskAuditLog`, `InventoryAuditLog`, `CertActivityLogEntry`,
…) being collapsed onto `AuditLog` under R-8. A new module writes here.

### Write structured detail to `detailsJson`

`AuditLog` has two detail columns:

- `detailsJson Json?` — **the column every new write targets.** Pass the
  object directly, never `JSON.stringify`. Prisma stores it as JSONB and
  returns it already parsed on read — no `JSON.parse` on the reader side.
- `details String?` — **LEGACY, frozen.** Historical rows only; no new
  writes. A future cleanup ticket drops the column once `detailsJson` is
  proven. Do not write to it.

### Action-string convention — `<module>:<kebab-verb>`

Every new `action` string is `<module>:<kebab-verb>` — lowercase module, a
colon, then a kebab-case verb. One namespace per module; the verb names the
act.

```
validation:sign-off
validation:bulk-update
baseline:create
tasks:tenant-scope-denied
project:strict-mode-set
```

Existing historical action strings (e.g. `BASELINE_CREATED`,
`ISSUE_HARD_DELETED_VIA_FUNCTION_CASCADE`, `PROJECT_OWNER_REASSIGNED`) are
**NOT rewritten** — the convention binds new writes only. A separate
follow-up may migrate the legacy strings.

### Canonical writer shape

```ts
import { prisma } from '../lib/prisma'

await prisma.auditLog.create({
  data: {
    projectId,
    userId,
    action: 'module:kebab-verb',
    detailsJson: { /* structured detail — object, not a string */ },
  },
})
```

When the detail is genuinely absent, write `Prisma.DbNull` (not JS `null`,
not `Prisma.JsonNull`) so the nullable-JSON column is set to SQL `NULL`,
uniform with the rows the R-8 backfill left as SQL `NULL`. Note the
distinction: `Prisma.DbNull` sets the column to SQL `NULL`, whereas
`Prisma.JsonNull` writes a JSON `null` literal *into* the JSONB column — a
different value. The full 11-table unification and a unified `GET /audit`
read endpoint are deferred "Next" work (ROADMAP §3).

---

## Background Jobs

The scheduled cleanup job runs via `cleanup.service.ts`. If you need to add
a new scheduled task:
- Add it to the same service (do not create a new scheduler)
- Use `node-cron` or the existing job runner pattern
- Log the job start/end with timestamps

---

## Error Handling Conventions

```ts
// 400 — validation / bad request
if (!body.name) {
  return res.status(400).json({ success: false, error: 'name is required' })
}

// 401 — handled by authenticateToken middleware
// 403 — handled by requireAdmin middleware

// 404 — resource not found
if (!parameter) {
  return res.status(404).json({ success: false, error: 'Parameter not found' })
}

// 409 — conflict (e.g. duplicate name)
// 500 — unexpected error (catch block)
```

Always return early on error — do not nest happy-path logic inside `if (!error)`.

---

## Testing Backend Endpoints

Every new endpoint needs Vitest + Supertest tests in `backend/src/__tests__/`.
The most important pattern is test isolation:

```ts
beforeAll(async () => {
  // Create ISOLATED test data with unique timestamps
  const ts = Date.now()
  testUser = await prisma.user.create({
    data: { email: `test-${ts}@example.com`, name: 'Test', passwordHash: '...' }
  })
  token = jwt.sign({ userId: testUser.id }, process.env.JWT_SECRET || 'secret')
})

afterAll(async () => {
  // Clean up in reverse dependency order
  await prisma.parameter.deleteMany({ where: { projectId: testProject.id } })
  await prisma.project.delete({ where: { id: testProject.id } })
  await prisma.user.delete({ where: { id: testUser.id } })
})
```

**Never mock Prisma.** Tests must hit the real database (Docker must be running).
Mocked tests have masked real bugs in the past — see `learnings.md`.
