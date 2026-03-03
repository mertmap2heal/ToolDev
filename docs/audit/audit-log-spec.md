# Audit Log Specification

## Overview

This document defines the audit log expectations for the aerospace lifecycle management tool: what events are logged, payload structure, retention, and access. The audit log supports compliance and change tracking. Assume database-backed storage.

---

## Principles

- **Immutable**: Audit records SHALL NOT be updated or deleted by normal application flow (except per retention policy).
- **Attribution**: Every record SHALL include actor (user id or system), timestamp (UTC), and entity/action.
- **Deterministic**: Event types and payload keys are fixed; no free-form payload without schema.

---

## Event Types

| Event Type | Entity | Action | When |
|------------|--------|--------|------|
| entity.create | requirement, test_case, test_plan, test_run, function, pbs, user | create | After successful insert. |
| entity.update | (same) | update | After successful update. Include changed attributes (old/new or delta). |
| entity.delete | (same) | delete | After soft or hard delete. |
| lifecycle.transition | requirement, test_case, test_plan, function | transition | On status change. previous_status, new_status. |
| link.create | requirement_test_case, test_plan_test_case, function_requirement, requirement_derives | link | When traceability link is added. |
| link.delete | (same) | unlink | When traceability link is removed. |
| user.login | user | login | On successful login (optional; may be security-only). |
| user.logout | user | logout | On logout (optional). |
| role.assign | user | role_assign | When role is assigned to user. |
| role.revoke | user | role_revoke | When role is removed from user. |

---

## Payload Structure

Each audit record SHALL contain at least:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | uuid | Yes | Primary key of audit record. |
| timestamp | datetime | Yes | When the event occurred (UTC). |
| actor_id | uuid | No | User who performed the action; null for system. |
| actor_username | string | No | Snapshot of username for display; optional. |
| event_type | string | Yes | One of entity.create, entity.update, etc. |
| entity_type | string | Yes | requirement, test_case, test_plan, test_run, function, pbs, user, or link type. |
| entity_id | uuid | No | Id of the affected entity; null for login. |
| action | string | Yes | create, update, delete, transition, link, unlink, login, etc. |
| payload | json | No | Action-specific payload (see below). |

---

## Payload by Event Type

### entity.create

```json
{
  "code": "REQ-001",
  "title": "...",
  "project_id": "uuid"
}
```

Include key identifying attributes (code, project_id) for traceability. Full body optional.

### entity.update

```json
{
  "changed": ["title", "status"],
  "old": { "title": "...", "status": "draft" },
  "new": { "title": "...", "status": "approved" }
}
```

Or delta only. Sensitive fields (e.g. password) SHALL NOT be logged in old/new.

### entity.delete

```json
{
  "code": "REQ-001",
  "soft": true
}
```

### lifecycle.transition

```json
{
  "previous_status": "draft",
  "new_status": "approved"
}
```

### link.create / link.delete

```json
{
  "source_entity": "test_case",
  "source_id": "uuid",
  "target_entity": "requirement",
  "target_id": "uuid"
}
```

### user.login / user.logout

```json
{
  "user_id": "uuid",
  "ip": "optional",
  "user_agent": "optional"
}
```

### role.assign / role.revoke

```json
{
  "user_id": "uuid",
  "role": "contributor",
  "project_id": "uuid or null"
}
```

---

## Storage and Retention

- **Backend**: Dedicated audit_log table or equivalent. Index on timestamp, entity_type, entity_id, actor_id.
- **Retention**: Configurable (e.g. 7 years). Deletion or archive SHALL be policy-driven and logged outside application audit if required.
- **No update/delete**: Application SHALL NOT provide API to update or delete audit records except retention job with separate authorization.

---

## Access and API

- **Read**: Only users with permission audit_log.read (e.g. audit_viewer, admin) SHALL access audit log.
- **Endpoints**: GET /api/audit?from=...&to=...&entity_type=...&entity_id=...&actor_id=...&page=...&pageSize=....
- **Response**: List of audit records; payload as JSON. No write endpoint for application users.

---

## UI Expectations

- **Audit log page**: Table with columns: timestamp, actor, event_type, entity_type, entity_id, action. Filter by date range, entity type, entity id, actor. Click row to expand payload.
- **Entity-level audit**: On requirement/test case/etc. detail, optional "History" tab showing audit records where entity_id = current entity.

---

## Change Impact Notes

- Adding event type: Add new event_type value and payload schema; update backend logger. `[ADD_ATTR]`-like for event taxonomy.
- Adding payload field: Extend payload schema; backward compatible if additive. `[ADD_ATTR]`.
- Removing event type or payload field: Breaking for consumers; retention and export may be affected. `[REMOVE_ATTR]`.
