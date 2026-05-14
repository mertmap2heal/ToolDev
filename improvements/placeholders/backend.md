# Backend — Placeholders

## `backend/src/routes/architecture.routes.ts` — orphan endpoint

14 lines. The entire file:

```ts
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId', (req, res) => {
  res.json({ message: 'Architecture routes - to be implemented' })
})

export default router
```

Mounted in `backend/src/routes/index.ts` at lines 8 and 85:

```ts
import architectureRoutes from './architecture.routes'
// ...
router.use('/architecture', architectureRoutes)
```

A single `GET /api/v1/architecture/:projectId` handler returns the literal string `{"message":"Architecture routes - to be implemented"}` and an HTTP 200. No service, no controller, no Prisma read or write.

Per `inventory.md` "Backend endpoints with no frontend consumer (orphans candidate list)", `architecture.routes.ts` is named as a confirmed orphan. Grep confirms no frontend service file imports it (`frontend/src/services/` has no `architecture.service.ts` and no axios calls to `/api/v1/architecture`). The endpoint exists and is reachable, but nothing in the application consumes it.

The endpoint is mounted **behind** `authenticateToken`, so an anonymous user gets a 401. A signed-in user gets the stub message. This is the worst kind of API surface for a buyer audit: documented in the route table, callable, useless, no schema, no OpenAPI contract.

## `Architecture` Prisma model — used as a lifecycle marker, not as a real entity

`backend/prisma/schema.prisma:621-630`:

```prisma
model Architecture {
  id          String   @id @default(uuid())
  projectId   String
  name        String
  description String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
}
```

Five user-visible columns and a project FK. No relations into Components, Functions, Interfaces, Diagrams, or anything else the word "architecture" usually implies in a SysML / ARP4754A context. **Not the data model `kb/interface-management.md` would expect for a real Architecture module.**

The model is referenced by `backend/src/controllers/project.controller.ts:321` (`architectures: true` in a project include) and by `backend/src/services/workflow.service.ts:9,20,41,79` as one of the lifecycle stages a project advances through (`requirements → system-functions → architecture → verification`). Both usages count rows to determine "has this project entered the architecture stage" — they do **not** read the columns.

Net: the Prisma model is currently a counter, not an entity. Deleting `architecture.routes.ts` does not require schema changes — but the model itself is misnamed for what it actually does (a lifecycle stage signal) and should be reconsidered the next time the lifecycle workflow is touched.

## Reports — no backend at all

There is no `reports.routes.ts`, no `report.controller.ts`, no `reports.service.ts`. Per `inventory.md` row 68 (Reports), the page is annotated "(uses platformAdmin)" — meaning the only behaviour the page could surface (the `SafetyLinkPanel`) routes to the Safety Analysis page, which itself ships mock data per `inventory.md` row 65.

Reports is therefore not a backend cleanup task — it is purely a frontend route deletion plus migration of the one `SafetyLinkPanel` CTA elsewhere.

## Recommended backend action

Delete `backend/src/routes/architecture.routes.ts` and remove the import + `router.use` from `backend/src/routes/index.ts`. The `Architecture` Prisma model stays (lifecycle workflow depends on it) but its naming should be flagged for the next lifecycle / project-workflow refactor as a candidate rename (`ProjectArchitectureStageMarker` or similar) so its limited purpose is obvious from the schema.
