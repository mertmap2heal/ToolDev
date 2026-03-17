# Function

## Overview

A Function represents a logical or physical function (e.g. system function, software function) that satisfies one or more requirements. Functions support requirement-to-design traceability (satisfies) and may be organized under a PBS or project. Used in aerospace for DO-178C/DO-254 and similar lifecycle models.

---

## Attributes

| Attribute Name | Type | Required | Editable | Default | Description |
|----------------|------|----------|----------|---------|-------------|
| id | uuid | Yes | No | system | Primary key. |
| code | string(64) | Yes | Yes | — | Unique business identifier within project (e.g. FUNC-SYS-01). |
| title | string(256) | Yes | Yes | — | Short descriptive title. |
| description | text | No | Yes | — | Definition of the function. |
| type | enum FunctionType | Yes | Yes | software | Function classification. |
| status | enum FunctionStatus | Yes | Yes | draft | Lifecycle status. |
| project_id | uuid | Yes | No | — | Project or PBS node this function belongs to. |
| parent_function_id | uuid | No | Yes | — | Parent function for hierarchy (optional). |
| created_at | datetime | Yes | No | system | Creation timestamp (UTC). |
| updated_at | datetime | Yes | No | system | Last modification timestamp (UTC). |
| created_by_id | uuid | No | No | — | User who created the record. |
| updated_by_id | uuid | No | No | — | User who last updated the record. |

---

## Enum Definitions

### FunctionType

| Value | Description |
|-------|-------------|
| system | System-level function. |
| software | Software function. |
| hardware | Hardware function. |
| other | Not classified above. |

### FunctionStatus

| Value | Description |
|-------|-------------|
| draft | Work in progress. |
| under_review | Submitted for review. |
| approved | Approved; linked requirements satisfied. |
| obsolete | No longer applicable; retained for history. |

---

## Relationships

| Target Entity | Relation Type | Cardinality | Direction | Description |
|---------------|---------------|-------------|-----------|-------------|
| Project / PBS | part-of | 1..1 | Outbound | Function belongs to one project/PBS node. |
| Function | parent | 0..1 | Outbound | Parent function (hierarchy). |
| Function | children | 0..n | Inbound | Child functions. |
| User | created_by | 0..1 | Outbound | Creator (optional). |
| User | updated_by | 0..1 | Outbound | Last updater (optional). |
| Requirement | satisfies | 1..n | Outbound | Requirements this function satisfies. |

---

## Lifecycle

See `../lifecycle/lifecycle-model.md`. Status transitions: draft → under_review → approved. Transition to obsolete allowed from any state. No reverse from obsolete.

---

## Validation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| code_unique_per_project | code SHALL be unique within project_id. | Duplicate function code. |
| title_non_empty | title SHALL have length ≥ 1 after trim. | Title is required. |
| project_exists | project_id SHALL reference an existing project/PBS node. | Invalid project. |
| parent_same_project | If parent_function_id is set, parent SHALL belong to the same project_id. | Parent must be in same project. |
| no_circular_parent | parent_function_id SHALL not form a cycle (self or ancestor). | Circular function hierarchy. |

---

## Deletion Behavior

- **Soft delete**: Preferred. Set status to obsolete or use a dedicated deleted flag.
- **Hard delete**: If allowed, MUST remove all satisfies links (Function → Requirement). Child functions SHALL be reassigned (parent_function_id = null or another parent) or deleted per cascade policy. No orphaned satisfies links.

---

## Audit Behavior

- **Create**: Log entity type `function`, action `create`, id, code, project_id, created_by_id, timestamp.
- **Update**: Log entity type `function`, action `update`, id, changed attributes, updated_by_id, timestamp.
- **Status change**: Log previous_status and new_status.
- **Delete**: Log entity type `function`, action `delete`, id, code, performed_by_id, timestamp.
- **Link change**: Log when satisfies links are added or removed.

See `../audit/audit-log-spec.md`.

---

## UI Expectations

- List view: code, title, type, status, project. Sortable by code, title, status, updated_at. Filter by type, status, project. Optional tree view by parent/children.
- Detail view: All attributes editable per permissions. Show linked requirements (satisfies) and parent/child functions. Edit satisfies links.
- Create: code, title, type, project_id required. Default status = draft. Optional parent_function_id.
- Traceability: Function SHALL appear in requirement-to-function matrix (satisfies).

See `../ui/links-page.md` for link management.

---

## Change Impact Notes

- `[ADD_ATTR]` Adding an attribute: add column (nullable or default), extend API and UI.
- `[REMOVE_ATTR]` Removing an attribute: breaking; migration and API/UI update.
- `[CHANGE_TYPE]` Changing attribute type: breaking; migration and validation.
- `[CHANGE_ENUM]` Add enum value: additive. Remove enum value: breaking; migrate data.
- `[CHANGE_CARDINALITY]` Changing relation cardinality: migration and cascade/validation update.
