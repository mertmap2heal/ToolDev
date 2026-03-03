# Requirement

## Overview

A Requirement is a formal statement of a capability, constraint, or condition that the system or product SHALL satisfy. Requirements are the primary traceability source for verification (test cases) and for derivation (parent/child requirements). Each requirement is uniquely identified and versionable within the project scope.

---

## Attributes

| Attribute Name | Type | Required | Editable | Default | Description |
|----------------|------|----------|----------|---------|-------------|
| id | uuid | Yes | No | system | Primary key. |
| code | string(64) | Yes | Yes | — | Unique business identifier within project (e.g. REQ-SYS-001). |
| title | string(256) | Yes | Yes | — | Short descriptive title. |
| description | text | No | Yes | — | Full textual definition of the requirement. |
| type | enum RequirementType | Yes | Yes | functional | Requirement classification. |
| priority | enum RequirementPriority | No | Yes | medium | Priority for planning and verification order. |
| status | enum RequirementStatus | Yes | Yes | draft | Lifecycle status. |
| project_id | uuid | Yes | No | — | Project or PBS node this requirement belongs to. |
| created_at | datetime | Yes | No | system | Creation timestamp (UTC). |
| updated_at | datetime | Yes | No | system | Last modification timestamp (UTC). |
| created_by_id | uuid | No | No | — | User who created the record. |
| updated_by_id | uuid | No | No | — | User who last updated the record. |

---

## Enum Definitions

### RequirementType

| Value | Description |
|-------|-------------|
| functional | Describes what the system shall do. |
| performance | Describes quantitative performance criteria. |
| safety | Safety-related requirement (e.g. DO-178C, DO-254). |
| interface | Interface or integration requirement. |
| design | Design constraint or guideline. |
| other | Not classified above. |

### RequirementPriority

| Value | Description |
|-------|-------------|
| critical | Must be satisfied for release; highest verification priority. |
| high | Important for release; high verification priority. |
| medium | Standard priority. |
| low | Can be deferred or deprioritized. |

### RequirementStatus

| Value | Description |
|-------|-------------|
| draft | Work in progress; not yet approved. |
| under_review | Submitted for review. |
| approved | Approved for implementation and verification. |
| implemented | Implementation complete (design/development). |
| verified | Verification evidence linked and accepted. |
| obsolete | No longer applicable; retained for history. |

---

## Relationships

| Target Entity | Relation Type | Cardinality | Direction | Description |
|---------------|---------------|-------------|-----------|-------------|
| Project / PBS | part-of | 1..1 | Outbound | Requirement belongs to one project/PBS node. |
| User | created_by | 0..1 | Outbound | Creator (optional). |
| User | updated_by | 0..1 | Outbound | Last updater (optional). |
| Requirement | derives-from | 0..n | Outbound | Child requirements deriving from this requirement. |
| Requirement | derived-by | 0..1 | Inbound | Parent requirement this derives from. |
| Test Case | verifies | 0..n | Inbound | Test cases that verify this requirement. |
| Function | satisfies | 0..n | Inbound | Functions that satisfy this requirement. |

---

## Lifecycle

See `../lifecycle/lifecycle-model.md`. Requirement status transitions: draft → under_review → approved → implemented → verified. Transitions to obsolete allowed from any state. Reverse transitions (e.g. approved → draft) are configurable per enterprise policy.

---

## Validation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| code_unique_per_project | code SHALL be unique within project_id. | Duplicate requirement code. |
| title_non_empty | title SHALL have length ≥ 1 after trim. | Title is required. |
| code_format | code SHALL match pattern: alphanumeric, hyphen, underscore allowed. | Invalid requirement code format. |
| project_exists | project_id SHALL reference an existing project/PBS node. | Invalid project. |

---

## Deletion Behavior

- **Soft delete**: Preferred. Set status to obsolete or use a dedicated deleted flag if defined. Retain for audit and traceability.
- **Hard delete**: If allowed by policy, MUST break links first: remove all verifies (Test Case → Requirement) and derives-from (Requirement → Requirement) links. Then delete. Traceability matrix MUST be updated; orphaned test-case links SHALL NOT remain.

---

## Audit Behavior

- **Create**: Log entity type `requirement`, action `create`, id, code, project_id, created_by_id, timestamp.
- **Update**: Log entity type `requirement`, action `update`, id, list of changed attributes (old/new or delta), updated_by_id, timestamp.
- **Status change**: Log as update with previous_status and new_status.
- **Delete**: Log entity type `requirement`, action `delete` (soft or hard), id, code, performed_by_id, timestamp.

See `../audit/audit-log-spec.md`.

---

## UI Expectations

- List view: code, title, type, priority, status, project. Sortable by code, title, status, updated_at. Filter by type, priority, status, project.
- Detail view: All attributes editable per permissions; description in multi-line or rich text. Show linked test cases (verifies) and parent/child requirements (derives-from / derived-by).
- Create: code, title, type, priority, project_id required. Default status = draft.
- Traceability: Requirement SHALL appear as a row/column in traceability matrix with links to Test Cases and parent/child Requirements.

See `../ui/requirements-page.md`.

---

## Change Impact Notes

- `[ADD_ATTR]` Adding an attribute: add column (nullable or default), extend API and UI form.
- `[REMOVE_ATTR]` Removing an attribute: breaking; migration to drop column; remove from API and UI.
- `[CHANGE_TYPE]` Changing attribute type: breaking; migration and validation update.
- `[CHANGE_ENUM]` Adding enum value: additive. Removing enum value: breaking; migrate existing data and update constraints.
- `[CHANGE_CARDINALITY]` Changing relation cardinality: migration and cascade/validation update.
