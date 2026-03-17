# Architecture & Code Patterns

## Repository layout

```
/
├── CLAUDE.md                        # AI agent entry point (imports .claude/)
├── start.ps1                        # Single-command launcher
├── docker-compose.yml               # postgres:15-alpine
├── backend/
│   ├── .env                         # gitignored — created by start.ps1
│   ├── .env.example                 # template
│   ├── prisma/
│   │   ├── schema.prisma            # 157 models — source of truth for DB
│   │   └── migrations/              # 13 migrations (apply: prisma migrate deploy)
│   └── src/
│       ├── server.ts                # Express + Socket.IO entry point
│       ├── controllers/             # Request handlers (44+ files)
│       │   ├── certification/       # Certification sub-controllers
│       │   ├── inventory/           # Inventory sub-controllers
│       │   └── verification/        # Verification sub-controllers
│       ├── routes/
│       │   └── index.ts             # Registers ALL routes under /api/v1/
│       ├── services/                # Business logic (57 files)
│       │   ├── inventory/           # Inventory services
│       │   └── verification/        # Verification execution services
│       ├── middleware/
│       │   └── auth.middleware.ts   # JWT verify + role; exports AuthRequest
│       ├── realtime/
│       │   └── realtime.ts          # Socket.IO events + metrics
│       ├── scripts/                 # 25 seed/maintenance scripts
│       └── lib/
│           └── prisma.ts            # Singleton PrismaClient (use THIS for imports)
├── frontend/
│   ├── vite.config.ts               # Port 3000; proxies /api, /uploads, /socket.io → :5000
│   └── src/
│       ├── App.tsx                  # All React Router route definitions
│       ├── main.tsx                 # React 18 entry + React Query client
│       ├── pages/                   # 40+ page directories (one dir per feature area)
│       ├── components/              # 150+ components across 29 categories
│       ├── services/                # 45 axios service files
│       │   └── api.ts               # Base axios instance — ALL requests go through here
│       ├── store/                   # 10 Zustand stores
│       ├── modules/                 # 4 large self-contained feature modules
│       ├── linkage/                 # 18 cross-module deep-link adapters
│       ├── features/                # Smaller feature slices (ai-guidance, traceability, etc.)
│       ├── config/                  # Feature flags, module config, tab configs
│       ├── contexts/                # BreadcrumbContext, VerificationDrawerContext
│       └── utils/                   # Export utils, glossary, cache invalidation, URL helpers
└── shared/
    └── types/                       # TypeScript type definitions — no runtime code
```

---

## Backend patterns

### Prisma import
```ts
import { prisma } from '../lib/prisma'   // always use the singleton
```
> `auth.middleware.ts` has its own `PrismaClient` instance — known duplication; do not remove it.

### Controller → Route → Service pattern
```
routes/index.ts  →  routes/feature.routes.ts  →  controllers/feature.controller.ts  →  services/feature.service.ts
```
All routes are mounted in `src/routes/index.ts` under `/api/v1/`.

### Response shape
```ts
// Success
res.json({ success: true, data: T, message: string })
// Error
res.status(4xx|5xx).json({ success: false, error: string })
```

### Auth middleware
```ts
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
router.get('/protected', authenticateToken, handler)
router.post('/admin-only', authenticateToken, requireAdmin, handler)
```
`authenticateToken` attaches `req.user: { userId, email, role }` (type: `AuthRequest`).

### Soft deletes
Requirements and ExportTemplates use `deletedAt: DateTime?`. Always filter `deletedAt: null` in queries unless explicitly working with archived items.

---

## Frontend patterns

### API calls
All calls go through `src/services/api.ts` (axios, base: `/api/v1`).
Vite proxies `/api` → `localhost:5000` — **never hardcode `localhost:5000`**.

```ts
// Example service
import api from './api'
export const getProjects = () => api.get('/projects').then(r => r.data)
```

### Auth token
- Stored in `localStorage` (key: `token`)
- Managed by `src/store/authStore.ts`
- Axios interceptor in `api.ts` attaches `Authorization: Bearer <token>`
- 401 → clear token + redirect `/login`

### State management split
| Library | When to use |
|---------|-------------|
| React Query | Server data — fetching, caching, invalidation, mutations |
| Zustand | Client UI state — auth, active project, theme, drawer open/closed |

**Zustand stores:** `authStore`, `projectStore`, `workflowStore`, `mbseStore`, `lifecycleStore`, `statusDefinitionsStore`, `themeStore`, `platformAdminStore`, `parameterDisplayStore`, `aiGuideStore`

### Shared types
```ts
import type { SomeType } from 'shared/types/api.types'
```
Vite alias `shared` → `../shared` (configured in `vite.config.ts` and `tsconfig.json` paths).

### Deep-link system
`src/linkage/` — 18 entity adapters for cross-module navigation.
Entry point: `buildDeepLink.ts`. Adapters: archive, certification, changeRequest, cm, compliance, document, function, hazard, interface, issue, parameter, pbs, requirement, risk, stakeholder, task, verification.

---

## Feature modules (`frontend/src/modules/`)
| Module | Purpose |
|--------|---------|
| `certification/` | Certification lifecycle — objectives, compliance matrix, evidence, findings, reviews, sign-offs |
| `configuration-management/` | CM workflows — CIs, baselines, releases, deviations, waivers |
| `pbs/` | Product Breakdown Structure — tree editor, import/export, node editor |
| `stakeholders/` | Stakeholder management — RACI matrix, committees, communication timeline, approval rules |

## Feature slices (`frontend/src/features/`)
`ai-guidance/`, `documentation/`, `issues/`, `traceability/`, `workflow/`

---

## Common tasks
| Task | Action |
|------|--------|
| Add API route | New file in `backend/src/routes/` + register in `routes/index.ts` |
| Add controller | `backend/src/controllers/` |
| Add service | `backend/src/services/` |
| Add page | `frontend/src/pages/<FeatureName>/index.tsx` + route in `App.tsx` |
| Add API service | `frontend/src/services/<feature>.service.ts` using `api.ts` client |
| DB schema change | Edit `schema.prisma` → `npx prisma generate` → `npx prisma db push` (dev) |
| New migration | `npx prisma migrate dev --name <description>` |
| Real-time event | `backend/src/realtime/realtime.ts` |
| New Zustand store | `frontend/src/store/<name>Store.ts` |
