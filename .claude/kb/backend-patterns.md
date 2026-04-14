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

**Exception:** `auth.middleware.ts` has its own `PrismaClient` instance. This is a
known legacy duplication — do not remove it (auth middleware runs at startup before
the singleton is guaranteed to be ready), but also do not copy the pattern.

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
