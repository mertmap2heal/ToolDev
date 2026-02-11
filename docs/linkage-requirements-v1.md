# Requirements Enterprise Linkages (LINKAGE_V1)

This document describes the Requirements Page Enterprise Linkages feature, how to enable it, the adapter pattern, API contracts, and migration notes.

## Enabling LINKAGE_V1

The feature is controlled by a feature flag. To enable:

1. Add to your frontend `.env` file:
   ```
   VITE_LINKAGE_V1=true
   ```

2. Restart the frontend dev server.

**Default:** `false`. When disabled, the application uses legacy behavior (Functions in traceability, allocation to functions, etc.).

## Overview

When LINKAGE_V1 is enabled:

- **No Functions or Parameters** in linkage features. Requirements link to enterprise entities: PBS components, interfaces, issues, change requests, tasks, test cases, hazards, risks, documents, baselines, etc.
- **Link Service** wraps the traceability API and filters out function/parameter links.
- **Adapters** resolve entity labels and build deep links for navigation.
- **Traceability Matrix** shows selectable targets (PBS, Interfaces, Test Cases, Hazards, etc.) instead of Functions.
- **Allocation Table** uses PBS components (`allocated_to`) instead of functions.
- **Baseline Manager** snapshots links and shows link diff in comparisons.
- **Create Requirement Modal** adds Quick Links (PBS, Interfaces, Hazards, Risks) and creates `derived_from` link when parent is set.
- **Requirement Detail Drawer** shows links from the link graph, grouped by link type, with deep link buttons.
- **Deep linking** on target pages (Issues, Change Requests, PBS, Interfaces) via `?focusType=&focusId=`.

## Adapter Pattern

Each entity type has an adapter in `frontend/src/linkage/adapters/`:

| Adapter | Entity Types | Deep Link Path |
|---------|-------------|----------------|
| pbsAdapter | pbs_component | `/projects/:pid/product-breakdown-structure?focusType=pbs_component&focusId=:id` |
| interfaceAdapter | interface | `/projects/:pid/interface-management?focusType=interface&focusId=:id` |
| issueAdapter | issue | `/projects/:pid/issues/:id` |
| changeRequestAdapter | change_request | `/projects/:pid/change-requests?focusType=change_request&focusId=:id` |
| taskAdapter | task | `/projects/:pid/tasks?focusType=task&focusId=:id` |
| verificationAdapter | test_plan, test_case, test_result | `/projects/:pid/verification?focusType=test_case&focusId=:id` |
| hazardAdapter | hazard | `/projects/:pid/safety-analysis/hazards?focusType=hazard&focusId=:id` |
| riskAdapter | risk | `/projects/:pid/risk-management?focusType=risk&focusId=:id` |
| documentAdapter | document | `/projects/:pid/documentation?focusType=document&focusId=:id` |
| cmAdapter | ci, baseline, release | `/projects/:pid/configuration-management?focusType=ci&focusId=:id` |
| complianceAdapter | compliance_rule | `/projects/:pid/compliance-check?focusType=compliance_rule&focusId=:id` |
| certificationAdapter | cert_objective | `/projects/:pid/certification?focusType=cert_objective&focusId=:id` |
| stakeholderAdapter | stakeholder | `/projects/:pid/stakeholder?focusType=stakeholder&focusId=:id` |
| archiveAdapter | archive | `/projects/:pid/archive?focusType=archive&focusId=:id` |

Each adapter implements:

- `search(query: string, projectId: string): Promise<EntitySummary[]>`
- `getById(id: string, projectId: string): Promise<EntitySummary | null>`
- `buildDeepLink(projectId: string, ref: EntityRef): string`

`buildDeepLink` is centralized in `frontend/src/linkage/buildDeepLink.ts`, which delegates to adapters by entity type.

## API Contracts

### Link Service (frontend)

- `getLinks(projectId, filters?)` — returns links, excluding function/parameter when LINKAGE_V1
- `getSuspectLinks(projectId)` — suspect links, excluding function/parameter
- `createLink(projectId, dto)` — creates a trace link
- `clearSuspect(projectId, linkId)` — clears suspect status
- `deleteLink(projectId, linkId)` — removes link

### Traceability API (backend)

- `GET /traceability/:projectId` — all trace links (filtered client-side by link service)
- `POST /traceability/:projectId` — create link (body: sourceType, sourceId, targetType, targetId, linkType, rationale)
- `PUT /traceability/:projectId/links/:linkId/clear-suspect` — clear suspect
- `DELETE /traceability/:projectId/links/:linkId` — delete link

### Baseline API

- Baselines include `linksSnapshot` (JSON) when created — snapshot of links where source or target is a requirement
- Compare endpoint returns `linksAdded`, `linksRemoved`, `linksSuspectChanged` when both baselines have link snapshots

## Shared Types

`shared/types/linkage.types.ts`:

- `EntityType` — requirement, pbs_component, interface, issue, task, change_request, test_plan, test_case, hazard, risk, document, etc. (excludes function, parameter)
- `EntityRef` — `{ type: EntityType; id: string }`
- `LinkType` — derived_from, allocated_to, related_interface, verified_by, mitigates, documented_in, etc.
- `Link` — id, projectId, sourceType, sourceId, targetType, targetId, linkType, status, rationale, isSuspect
- `CreateLinkDto` — sourceType, sourceId, targetType, targetId, linkType, rationale?
- `LinkFilters` — sourceType?, targetType?, status?, sourceId?, targetId?

## Migration Notes

1. **Existing TraceLinks**: The Prisma `TraceLink` model is unchanged. Links with targetType `function` or `parameter` remain in the database but are filtered out by the link service when LINKAGE_V1 is enabled.

2. **No schema migration** for TraceLink. The `Baseline` model has an optional `linksSnapshot` JSON column added for link snapshots.

3. **Legacy behavior**: When `VITE_LINKAGE_V1` is not set or is `false`, the app uses the previous behavior (Functions in Traceability Matrix, Allocation to Functions, etc.).

4. **Adapters and mocks**: Some adapters (interfaces, hazards, risks, documents, stakeholders, PBS) use mock data or localStorage when backend APIs are not available. Integrate with real APIs as they become available.

5. **Baseline URL**: Use `?baselineId=<id>` on the Requirements page URL to view a baseline in read-only mode. Editing is disabled and a banner is shown.
