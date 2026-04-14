# React & TypeScript Patterns

Patterns, conventions, and pitfalls specific to this codebase's frontend.
Read alongside `architecture.md` (structure) and `development.md` (how to add features).

---

## Component Architecture

### Page vs Component boundary
Pages live in `frontend/src/pages/<FeatureName>/index.tsx`. They own:
- React Query hooks for data fetching
- Top-level state (selected row, open modals)
- Route params (`useParams`)

Components in `frontend/src/components/` are dumb or semi-smart:
- Receive data via props
- May have their own local UI state (accordion open, tab index)
- Should NOT own their own React Query fetches unless they are self-contained panels

### Drawer / detail panel pattern
Detail drawers follow this structure:
```
ParentPage
  └── DetailDrawer (receives id, isOpen, onClose as props)
        └── fetches its own data via useQuery(id) when isOpen=true
```

The drawer owns its own data fetch (re-fetches when id changes). The parent page
only manages `selectedId` and `isOpen`.

---

## React Query Patterns

### Query keys
All query keys follow `[entityType, scopeId, ...filters]`:
```ts
['parameters', projectId]               // list
['parameters', projectId, parameterId]  // single item
['parameters', projectId, 'versions', parameterId]  // sub-resource
```

Never use bare strings like `['params']` — they will collide across projects.

### Cache invalidation after mutations
After a create/update/delete mutation, invalidate at the list level so all
derived queries (counts, versions, etc.) refresh:
```ts
await queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
```

Avoid invalidating the entire cache (`queryClient.clear()`) — it causes
unnecessary re-fetches on every other page.

### Optimistic updates vs refetch
This codebase uses **refetch-on-invalidate** (not optimistic updates). Mutations
call the API, await the response, then invalidate. Do not introduce optimistic
updates without thorough consideration of error rollback.

---

## State Management Split

| What | Where |
|------|-------|
| Server data (lists, items, counts) | React Query |
| UI state that resets on page leave (modal open, selected row) | `useState` in the page |
| UI state that persists across pages (theme, active project) | Zustand store |
| Auth state | `authStore` (Zustand) |

Do not put server data into Zustand. Do not put ephemeral UI state into React Query.

---

## Conditional Attributes That Disappear After Interaction

Some components conditionally add HTML attributes based on state. This affects
test selectors and should inform how you write interactive components.

**Real example — inline value cell in ParametersPage:**
```tsx
// isInlineEditing = false → renders this
<td
  title="Click to edit value"
  onClick={() => setIsInlineEditing(true)}
>
  {value}
</td>

// isInlineEditing = true → renders this (title is gone)
<td>
  <input value={editValue} onChange={...} />
</td>
```

The `title` attribute only exists when NOT editing. Playwright locators
built on that attribute become stale after the click. See `playwright-e2e.md`
for the test fix; for the component itself, this pattern is intentional and
should be preserved.

---

## Drawer Styling Conventions

Since the parameter-improvements branch, all detail drawers must match this visual
pattern (established in `ParameterDetailDrawer` and `RequirementDetailDrawer`):

```tsx
// Outer panel: floating rounded card
<div className="rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full">

  {/* Frosted/tinted header bar */}
  <div className="bg-[color]/20 backdrop-blur-sm border-b border-[color]/30 px-6 py-4 flex-shrink-0">
    <h2>Title</h2>
  </div>

  {/* Scrollable body */}
  <div className="flex-1 overflow-y-auto p-6">
    {/* content */}
  </div>

  {/* Optional sticky footer */}
  <div className="border-t px-6 py-4 flex-shrink-0">
    {/* action buttons */}
  </div>
</div>
```

Drawers that were updated to this pattern:
`TaskDetailDrawer`, `ItemDetailDrawer`, `PurchaseOrderDetailDrawer`,
`ReceiptDetailDrawer`, `SalesOrderDetailDrawer`, `ShipmentDetailDrawer`,
`WarehouseDetailDrawer`, `UserEditDrawer`, `ParameterDetailDrawer`

When adding a NEW detail drawer, always follow this pattern — do not invent
a new layout.

---

## TipTap Rich Text Editor

This codebase uses TipTap for rich text fields (requirement descriptions, etc.).
Key notes:

- The editor is in `frontend/src/components/common/RichTextEditor.tsx`
- `ParameterRefNode.ts` is a custom TipTap extension for `[[param_name]]` syntax
- To insert an inline parameter reference, use the extension's `addAttributes` hook
- TipTap content is stored as HTML strings in the database
- When displaying TipTap content outside the editor, use the `parseHTML` result,
  not raw `dangerouslySetInnerHTML` — the extension handles sanitisation

---

## ReactFlow Diagrams

Architecture diagrams use ReactFlow (`react-flow-renderer`):
- Diagram data stored as `{ nodes: [], edges: [] }` JSON in the database
- Custom node types registered in the flow component
- Do not use the deprecated `react-flow-renderer` import path — use `reactflow`

---

## Zustand Store Patterns

All stores live in `frontend/src/store/`. Pattern:

```ts
interface MyState {
  value: string
  setValue: (v: string) => void
}

const useMyStore = create<MyState>((set) => ({
  value: '',
  setValue: (v) => set({ value: v }),
}))
```

- Use `set` for updates — never mutate state directly
- Derived values should be computed in selectors, not stored:
  ```ts
  // BAD — derived state in store
  const fullName = `${firstName} ${lastName}`
  // GOOD — compute in component
  const fullName = useMyStore(s => `${s.firstName} ${s.lastName}`)
  ```
- Avoid subscribing to large store slices in frequently-re-rendering components

---

## TypeScript: Avoid `any`

Strict mode is on. When you encounter a typing challenge, resolve it properly:

```ts
// BAD
const data = response.data as any

// GOOD — import or define the correct type
import type { Parameter } from 'shared/types/api.types'
const data = response.data as Parameter
```

Use `shared/types/api.types.ts` for types shared between frontend and backend.
Only add `// eslint-disable-next-line @typescript-eslint/no-explicit-any` with
a comment explaining why it's unavoidable.

---

## Import Order Convention

```ts
// 1. External packages
import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

// 2. Internal absolute (shared types, Vite aliases)
import type { Parameter } from 'shared/types/api.types'
import { api } from '@/services/api'

// 3. Relative imports
import { ParameterDetailDrawer } from './ParameterDetailDrawer'
import styles from './styles.module.css'
```

---

## Deep-Link System

When linking to a specific entity from another module, use the deep-link adapters
in `frontend/src/linkage/` — never construct URLs manually.

```ts
import { buildDeepLink } from '../linkage/buildDeepLink'

const url = buildDeepLink({ type: 'parameter', id: param.id, projectId })
```

Available types: `archive`, `certification`, `changeRequest`, `cm`, `compliance`,
`document`, `function`, `hazard`, `interface`, `issue`, `parameter`, `pbs`,
`requirement`, `risk`, `stakeholder`, `task`, `verification`.

---

## Form Patterns

Forms use uncontrolled inputs with `react-hook-form` in some places and
controlled `useState` in others. Before adding a new form:
1. Check if the modal already uses a form library
2. Match the existing pattern in that component
3. Do not mix controlled and uncontrolled inputs in the same form

---

## Error Boundaries and Loading States

Standard loading/error pattern:

```tsx
const { data, isLoading, error } = useQuery(...)

if (isLoading) return <LoadingSpinner />
if (error) return <ErrorMessage message={error.message} />
if (!data) return null

return <MyComponent data={data} />
```

Use the existing `LoadingSpinner` and `ErrorMessage` components from
`frontend/src/components/common/` — do not roll custom loading UIs.

---

## Shared Types (`shared/types/`)

Types in `shared/` are the contract between frontend and backend.
- `api.types.ts` — response shapes from the API
- `index.ts` — re-exports all shared types

When adding a new entity:
1. Define its API response type in `shared/types/api.types.ts`
2. Import in both backend (for Prisma ↔ type mapping) and frontend
3. Do not duplicate type definitions — always import from `shared/`

---

## Vite Proxy — Never Hardcode Ports

All API calls go through the Vite dev-server proxy. Never reference `localhost:5000`:

```ts
// WRONG
const res = await fetch('http://localhost:5000/api/v1/parameters')

// CORRECT — Vite proxies /api → localhost:5000
const res = await api.get('/parameters')
```

In production, the Express server serves the built Vite assets directly, so
relative paths work without any proxy.
