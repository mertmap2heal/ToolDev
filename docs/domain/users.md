# User

## Overview

A User represents an identity that can authenticate and perform actions within the system. Users are assigned roles for access control (RBAC). User records are used for created_by, updated_by, executed_by, and audit actor attribution. This entity is typically backed by an identity provider or local auth store; the schema below defines the minimal attributes required for the lifecycle management tool.

---

## Attributes

| Attribute Name | Type | Required | Editable | Default | Description |
|----------------|------|----------|----------|---------|-------------|
| id | uuid | Yes | No | system | Primary key. |
| username | string(128) | Yes | Yes | — | Unique login identifier. |
| email | string(256) | No | Yes | — | Email address. |
| display_name | string(256) | No | Yes | — | Display name for UI and audit. |
| active | boolean | Yes | Yes | true | If false, user cannot log in. |
| created_at | datetime | Yes | No | system | Creation timestamp (UTC). |
| updated_at | datetime | Yes | No | system | Last modification timestamp (UTC). |

---

## Enum Definitions

None. Role assignment is via a separate User-Role relation (see `../security/access-control-model.md`).

---

## Relationships

| Target Entity | Relation Type | Cardinality | Direction | Description |
|---------------|---------------|-------------|-----------|-------------|
| Role | has_role | 0..n | Outbound | Roles assigned to this user (many-to-many). |
| Requirement | created_by / updated_by | 0..n | Inbound | Requirements created/updated by user. |
| Test Case | created_by / updated_by | 0..n | Inbound | Test cases created/updated by user. |
| Test Plan | created_by / updated_by | 0..n | Inbound | Test plans created/updated by user. |
| Test Run | executed_by | 0..n | Inbound | Test runs executed by user. |
| Function | created_by / updated_by | 0..n | Inbound | Functions created/updated by user. |
| PBS | created_by / updated_by | 0..n | Inbound | PBS nodes created/updated by user. |

---

## Lifecycle

No formal status lifecycle. active = false disables login and MAY hide user from assignee lists per policy. No deletion of user if audit or traceability requires stable actor reference; use active = false instead.

---

## Validation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| username_unique | username SHALL be unique. | Duplicate username. |
| username_non_empty | username SHALL have length ≥ 1 after trim. | Username is required. |
| email_format | If email present, SHALL be valid format. | Invalid email. |

---

## Deletion Behavior

- **Hard delete**: NOT recommended. Audit and created_by/updated_by references SHALL retain a stable identifier. If deletion is required by policy, retain id and username in audit as historical actor; or use soft delete (active = false and optionally anonymize display_name/email).
- **Cascade**: Deleting a user SHALL NOT cascade-delete requirements, test cases, or other domain entities. Foreign keys SHALL allow null (created_by_id, updated_by_id) or retain user id with "deleted user" display.

---

## Audit Behavior

- **Create**: Log entity type `user`, action `create`, id, username, created_at (sensitive fields per policy).
- **Update**: Log entity type `user`, action `update`, id, changed attributes (e.g. active, display_name). Password changes SHALL NOT be logged in detail; log only that password was changed.
- **Delete**: Log entity type `user`, action `delete`, id, username, performed_by_id, timestamp.
- **Login**: Log entity type `user`, action `login`, id, timestamp (see audit-log-spec).

See `../audit/audit-log-spec.md`.

---

## UI Expectations

- List view: username, display_name, email, active. Sortable by username, display_name, created_at. Filter by active. Role names MAY be shown as summary.
- Detail view: Attributes editable per permissions (e.g. only admin). Role assignment UI per access-control-model. No password in entity form if auth is external.
- Create: username required; email, display_name optional. Role assignment after create or on create per policy.

See `../security/access-control-model.md` for role and permission UI.

---

## Change Impact Notes

- `[ADD_ATTR]` Adding an attribute: add column (nullable or default), extend API and UI.
- `[REMOVE_ATTR]` Removing an attribute: breaking; migration and API/UI update.
- `[CHANGE_TYPE]` Changing attribute type: breaking; migration and validation.
- User entity is referenced by many domain entities; any change to id or username may require migration of foreign keys and audit logs.
