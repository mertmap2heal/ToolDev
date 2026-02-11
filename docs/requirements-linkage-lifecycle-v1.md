# Requirements Lifecycle Integration (LIFECYCLE_V1)

This document describes the Lifecycle Management integration with Requirements, including status-driven flows, transitions, gates, and API contracts.

## Enabling LIFECYCLE_V1

1. Add to your frontend `.env` file:
   ```
   VITE_LIFECYCLE_V1=true
   ```

2. Restart the frontend dev server.

**Requires:** `LINKAGE_V1=true` for full functionality. When LIFECYCLE_V1 is disabled, Requirements use the legacy `status` string field only.

## Overview

When LIFECYCLE_V1 is enabled:

- **Lifecycle-driven status** — Requirements use lifecycle status definitions and transition rules from Lifecycle Management (Zustand store).
- **Status pills** — Requirements list displays status with colored pills from Status Definitions.
- **Change Status** — Quick action popover per row with allowed transitions only.
- **Create Requirement Modal** — Fetches applicable lifecycle and default status; status is read-only.
- **Edit Requirement Modal** — Status dropdown shows only allowed transitions.
- **Requirement Detail Drawer** — Lifecycle & Approvals tab with lifecycle name, status history, allowed transitions, and gates checklist.
- **Lifecycle gates** — Backend validates gates on status transitions (owner, MoC, acceptance criteria, allocation, etc.). When `strictLifecycleGates` is enabled on the project, missing gates block transitions.
- **Audit** — Status changes are logged as `REQUIREMENT_STATUS_CHANGED` in the linkage audit trail.
- **Suspect Links** — When clearing suspect on baselined requirements, a comment is required. Banner shown when any suspect link involves baselined requirements.
- **Quality Analysis** — Lifecycle-aware: Draft/Proposed shows warnings only for gates; In Review+ with strictLifecycleGates shows missing gates as errors.

## Architecture

### Data Flow

- **Lifecycle & Status Definitions** — Stored in Zustand (`lifecycleStore`, `statusDefinitionsStore`), persisted to localStorage. No backend lifecycle APIs by default.
- **lifecycle.service** — Frontend adapter that fetches applicable lifecycle and allowed transitions. When backend `/lifecycle/*` APIs exist, uses them; otherwise resolves from Zustand.
- **Requirement model** — Adds optional `lifecycleId`, `statusId`, `statusChangedAt`, `statusChangedBy`. When LIFECYCLE_V1=OFF, `status` remains the source of truth.

### API Contracts (Future Backend)

| Endpoint | Purpose |
|----------|---------|
| `GET /lifecycle/applicable?projectId=&itemType=` | Returns `{ lifecycleId, defaultStatusId }` |
| `GET /lifecycle/transitions?lifecycleId=&fromStatusId=&userId=` | Returns `{ transitions: [{ toStatusId, toStatusName, allowedUserGroups }] }` |
| `GET /lifecycle/user-roles?userId=` | Returns `{ roles: string[] }` for transition rule filtering |
| `GET /requirements/:projectId/audit?entityType=REQUIREMENT&entityId=` | Audit events for status history |

### Baseline API (Existing)

- `POST /baselines` — Create baseline
- `POST /baselines/:id/snapshot` — Snapshot requirements and links
- Requirements in a baseline become eligible for "Baselined" status per lifecycle rules.

## Lifecycle Gates

Gates are checked when transitioning to specific statuses:

| Target Status | Gates |
|---------------|-------|
| In Review | Owner, MoC (warnings if missing; blockers when strictLifecycleGates) |
| Approved | Acceptance Criteria, Verification Method (required when MoC=Test), allocation to PBS or waiver |
| Baselined | Must be Approved |
| Verified | verified_by link or evidence (soft) |

**Project setting:** `strictLifecycleGates` (Boolean on Project). When `true`, missing gates block transitions. Default: `false` (warnings only).

## User Groups (Placeholder)

User Groups are defined in Lifecycle Management (local state). The `lifecyclePermissionService` adapter provides:

- `getUserRoles(userId)` — Returns roles (from backend when available; mock `["Requirements Engineer"]` otherwise)
- `canTransition(userId, allowedUserGroups)` — Checks if user has any allowed role

When no backend, transitions are allowed (fail-open for dev).

## Entity Types (Extended)

Added to `EntityType` in `shared/types/linkage.types.ts`: `user_group`, `lifecycle`, `lifecycle_status`.

## Acceptance Criteria

- **LIFECYCLE_V1=false:** Requirements behave exactly as before; `status` string only.
- **LIFECYCLE_V1=true, no lifecycle configured:** Fallback to default status; transitions may be empty.
- **LIFECYCLE_V1=true, lifecycle configured:** Status from lifecycle, transitions enforced, status changes audited, gates shown in drawer, baselines integrated.
