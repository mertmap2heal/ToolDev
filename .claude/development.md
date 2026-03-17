# Development Guide

## Adding a new backend feature

### 1. Schema (if needed)
```bash
# Edit backend/prisma/schema.prisma
npx prisma generate          # regenerate client
npx prisma db push           # sync to dev DB (no migration file)
# — or for a tracked migration —
npx prisma migrate dev --name add-my-model
```

### 2. Service
Create `backend/src/services/myFeature.service.ts`:
```ts
import { prisma } from '../lib/prisma'

export async function listMyFeature(projectId: string) {
  return prisma.myModel.findMany({ where: { projectId, deletedAt: null } })
}
```

### 3. Controller
Create `backend/src/controllers/myFeature.controller.ts`:
```ts
import { Request, Response } from 'express'
import * as service from '../services/myFeature.service'

export async function list(req: Request, res: Response) {
  try {
    const data = await service.listMyFeature(req.params.projectId)
    res.json({ success: true, data })
  } catch (e) {
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
```

### 4. Route
Create `backend/src/routes/myFeature.routes.ts`:
```ts
import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import * as ctrl from '../controllers/myFeature.controller'

const router = Router()
router.get('/:projectId/my-feature', authenticateToken, ctrl.list)
export default router
```

Register in `backend/src/routes/index.ts`:
```ts
import myFeatureRoutes from './myFeature.routes'
router.use('/', myFeatureRoutes)
```

---

## Adding a new frontend page

### 1. Page component
```
frontend/src/pages/MyFeature/index.tsx
```

### 2. Route
In `frontend/src/App.tsx`, inside the `<MainLayout>` route group:
```tsx
<Route path="/projects/:projectId/my-feature" element={<MyFeaturePage />} />
```

### 3. API service
```ts
// frontend/src/services/myFeature.service.ts
import api from './api'

export const getMyFeature = (projectId: string) =>
  api.get(`/projects/${projectId}/my-feature`).then(r => r.data)
```

### 4. React Query hook (inside the page or a custom hook)
```ts
const { data, isLoading } = useQuery({
  queryKey: ['my-feature', projectId],
  queryFn: () => getMyFeature(projectId),
})
```

### 5. Navigation (sidebar)
Add a link in `frontend/src/components/layout/Sidebar.tsx` (or equivalent nav file).

---

## Code conventions

### TypeScript
- Strict mode is on — no `any` unless unavoidable (and comment why)
- Prefer `interface` for object shapes, `type` for unions/aliases
- Import order: external → internal (`@/` or `shared/`) → relative

### React
- Functional components only, hooks for all state
- Co-locate component-specific hooks with the component, not in `store/`
- Use React Query for all server state — no `useEffect` + `fetch` patterns
- Tailwind for all styling — no inline styles, no CSS modules

### Backend
- All routes must go through `authenticateToken` middleware unless intentionally public
- Services must not import from controllers or routes
- Prisma queries in services only — never in controllers or routes directly
- Always handle `try/catch` in controllers; let services throw
- Body parsing limit is 50MB (configured in `server.ts`) — respect it for file uploads

### Naming
| Thing | Convention |
|-------|-----------|
| Files | `camelCase.ts` / `PascalCase.tsx` for React components |
| Variables/functions | `camelCase` |
| Classes/components | `PascalCase` |
| Constants | `UPPER_SNAKE_CASE` |
| DB models | `PascalCase` (Prisma convention) |
| API routes | `kebab-case` (e.g. `/change-requests`) |
| Branch names | `kebab-case` after the type prefix |

---

## Testing

Run from `backend/`:
```bash
npm test                     # Vitest — runs __tests__/ suites
```

Tests live in `backend/src/__tests__/`. Current coverage: auth, verification.
Frontend has no test suite yet — add under `frontend/src/__tests__/` when implementing.

---

## Linting & type checking

```bash
# Frontend
cd frontend && npm run lint
cd frontend && npx tsc --noEmit

# Backend
cd backend && npx tsc --noEmit
```

CI (`/.github/workflows/ci.yml`) runs `npm run lint` (frontend) and `npm run build` (backend) on every push to `main`/`master` and on PRs.

---

## Environment-specific notes

### Development
- `NODE_ENV=development` enables detailed error messages in 500 responses
- Vite HMR active on frontend — changes reload without full page refresh
- `tsx watch` on backend — restarts on any `src/` file change

### Production
- Build frontend: `cd frontend && npm run build` (outputs to `frontend/dist/`)
- Build backend: `cd backend && npm run build` (outputs to `backend/dist/`)
- Use `prisma migrate deploy` (not `db push`) before starting
- Set strong `JWT_SECRET`, real `DATABASE_URL`, and SMTP credentials in env

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| White screen on frontend | Check browser console; likely a JS error in a route component |
| `prisma generate` fails | Ensure `backend/.env` exists with valid `DATABASE_URL` |
| 401 on all API calls | Token expired or missing — clear `localStorage.token` and re-login |
| Docker port 5432 in use | `docker-compose down` then `docker-compose up -d`, or kill the conflicting process |
| `npx prisma db push` fails | Is postgres container healthy? Run `docker ps` and check `STATUS` |
| Frontend can't reach API | Check Vite proxy in `vite.config.ts`; backend must be on port 5000 |
| `npm install` fails in CI | Use `npm ci` — it requires a valid `package-lock.json` |

For more: see `TROUBLESHOOTING_WHITE_SCREEN.md` and `TROUBLESHOOTING_NETWORK_ERRORS.md` in the project root.
