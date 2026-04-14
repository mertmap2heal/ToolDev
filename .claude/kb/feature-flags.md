---
name: Feature Flag & Subscription Package System
description: Design decisions and patterns for the config-driven module visibility system (Core/Advanced/Complete packages)
type: project
---

# Feature Flag & Subscription Package System

## Architecture: Feature Registry + JSON Package Configs

**Do not use flat boolean env vars per module.** That approach doesn't scale (21 modules × 3 booleans = 63 env vars).

**The pattern that works:**
- Each package has one JSON file listing enabled module IDs
- One context (`FeaturePackageContext`) loads the active JSON based on `VITE_PACKAGE` env var
- All consumers call `isEnabled(moduleId)` — no other flag checks

**Files:**
- `frontend/src/config/packages/core.json` — module ID array for Core tier
- `frontend/src/config/packages/advanced.json` — Advanced tier
- `frontend/src/config/packages/complete.json` — Complete (all modules)
- `frontend/src/config/packageConfig.ts` — `PackageId` type (`'core' | 'advanced' | 'complete'`), `PACKAGE_CONFIGS` map, `getMinPackageForModule` helper
- `frontend/src/contexts/FeaturePackageContext.tsx` — provider + `useFeaturePackage()` hook
- `frontend/src/components/access/FeatureGuard.tsx` — route-level guard; redirects silently to project home, no upgrade screen
- `frontend/src/components/dev/PackageSwitcher.tsx` — dev-only runtime switcher (rendered only when `import.meta.env.DEV`)

**Why:** Adding a new package = add one JSON file. Adding a new module = add its ID to the right JSON files. Zero component changes.

---

## The Existing Foundation

`frontend/src/config/ModuleConfiguration.ts` already contains `MODULES[]` — 21 modules with id, label, icon, route, category. **This is the single source of truth for module metadata.** Do not create a parallel list anywhere.

The sidebar, header mega-menu, module launcher, module drawer, quick access bar, and project landing page all import `MODULES`. Filtering through `isEnabled()` in those places is all that's needed — no route removal required.

**Why:** Removing routes from `App.tsx` breaks direct URL navigation and deep links. Always keep routes registered; use `FeatureGuard` inside the route element to redirect instead.

---

## Package Selection

**Build time:** `VITE_PACKAGE` env var (e.g. `VITE_PACKAGE=advanced npm run build`)  
**Dev override:** `localStorage.get('devPackage')` checked first — set by `PackageSwitcher` component  
**Default:** `'complete'` in development so engineers always see everything

**Why localStorage for dev:** Allows switching packages without restarting the dev server.

---

## Route Protection — FeatureGuard Pattern

```tsx
// App.tsx — wrap only module routes, not auth/admin routes
<Route
  path="verification"
  element={
    <FeatureGuard moduleId="verification">
      <VerificationPage />
    </FeatureGuard>
  }
/>
```

`FeatureGuard` redirects silently to `/projects/:projectId` when the module is disabled — no upgrade screen, no locked icon.

**Why inside the element, not the route definition:** React Router always matches routes regardless. Keeping the route registered means `useNavigate`, deep links, and breadcrumbs still resolve. The guard intercepts at render time.

---

## Package Tier Assignments (as of first release)

| Tier | Modules |
|------|---------|
| Core | requirements, change-requests, issues, lifecycle-status, archive, stakeholder, product-breakdown-structure, functions, interface-management, parameters, risk-management, audit |
| Advanced | Core + tasks, documentation, verification |
| Complete | Advanced + configuration-management, mbse-models, validation, safety-analysis, compliance-check, certification |

---

## Dev Tools

`PackageSwitcher` component (renders only when `import.meta.env.DEV`):
- Floating panel, bottom-right corner
- Three buttons: Core | Advanced | Complete
- Calls `setDevPackage(id)` which writes to localStorage and triggers context re-render
- **Do not render in production builds** — the `import.meta.env.DEV` guard strips it entirely from production bundles

---

## What NOT to do

- Do not gate routes by removing them from `App.tsx` per package — breaks deep links
- Do not use one boolean env var per module — doesn't scale
- Do not add package logic to `featureFlags.ts` — that file is for internal dev flags (linkage, lifecycle); keep them separate
- Do not enforce packages on the backend for first release — frontend-only gating is sufficient initially
- Do NOT show "upgrade" prompts, locked icons, or any hint that hidden modules exist — disabled features are completely invisible

---

## Key Design Principle: Hidden = Non-Existent

When a module is disabled, it must not appear anywhere:
- Not in the sidebar
- Not in the header mega-menu, module launcher, module drawer, or quick access bar
- Not on the project landing page
- Direct URL access silently redirects to project home (no locked/upgrade screen)
- Not referenced in dropdowns, panels, or cross-link sections inside **other** visible pages

The user experience should be indistinguishable from those features never having existed.

---

## Auditing Core-Visible Pages for Hidden Module References

When adding a new module or changing tier assignments, search for hard-coded module IDs
in components that live inside always-visible pages (e.g. Requirements, Risk Management).

**Components already audited and fixed:**

| File | Issue | Fix |
|------|-------|-----|
| `frontend/src/pages/RiskManagement/RiskDetailDrawer.tsx` | `linkedArtifactKeys` statically included 'Verification Activities' and 'Configuration Baseline' | Wrapped in `useMemo` filtered by `isEnabled(ARTIFACT_MODULE_IDS[key])` |
| `frontend/src/components/requirements/ExportBuilder.tsx` | `<option value="verification">` hard-coded in traceability matrix row/column selects; default `colType: 'verification'` | Conditionally render with `{isEnabled('verification') && <option ...>}`; fall back default to `'function'` |

**Pattern for fixing — inline panel with cross-module links:**
```tsx
import { useFeaturePackage } from '../../contexts/FeaturePackageContext'
import { useMemo } from 'react'

const MODULE_ID_MAP: Record<string, string> = {
  'Verification Activities': 'verification',
  'Configuration Baseline':  'configuration-management',
}

const { isEnabled } = useFeaturePackage()

const visibleKeys = useMemo(() =>
  ALL_KEYS.filter(key => {
    const moduleId = MODULE_ID_MAP[key]
    return moduleId ? isEnabled(moduleId) : true  // keys without a mapped module always show
  }),
[isEnabled])
```

**Components determined safe (no action needed):**
- `HazardDetailDrawer`, `ArtifactPickerModal`, `DocumentEditorView` — these components are inside modules that are hidden in Core, so they are unreachable when those modules are off.
- `TopMegaNav DEFAULT_PINNED_IDS` — contains `'verification'` in default pins, but `QuickAccessBar` filters by `isEnabled()` before rendering, so stale pin entries are silently ignored.

**Grep pattern to find future violations:**
```bash
# Find hard-coded module route strings in Core-visible tsx files
grep -rn "'verification'\|'configuration-management'\|'mbse-models'\|'safety-analysis'\|'compliance-check'\|'certification'\|'validation'\|'tasks'\|'documentation'" \
  frontend/src/pages/Requirements/ \
  frontend/src/pages/RiskManagement/ \
  frontend/src/pages/Parameters/ \
  frontend/src/components/requirements/
```
