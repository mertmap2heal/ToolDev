# Product Breakdown Structure (PBS)

## Overview

The PBS (Product Breakdown Structure) is a hierarchical decomposition of the product or project into nodes. Each node represents a work package, subsystem, or configuration item. Requirements, test cases, test plans, and functions are scoped to a PBS node (project_id). The part-of relation between PBS nodes is strictly hierarchical (tree); no cycles allowed.

---

## Attributes

| Attribute Name | Type | Required | Editable | Default | Description |
|----------------|------|----------|----------|---------|-------------|
| id | uuid | Yes | No | system | Primary key. |
| code | string(64) | Yes | Yes | — | Unique business identifier (e.g. PBS-A1, SYS-01). |
| name | string(256) | Yes | Yes | — | Short name of the node. |
| description | text | No | Yes | — | Description of the node scope. |
| type | enum PBSNodeType | Yes | Yes | work_package | Node classification. |
| parent_id | uuid | No | Yes | — | Parent PBS node; null for root. |
| order_index | integer | No | Yes | 0 | Display/sort order among siblings. |
| created_at | datetime | Yes | No | system | Creation timestamp (UTC). |
| updated_at | datetime | Yes | No | system | Last modification timestamp (UTC). |
| created_by_id | uuid | No | No | — | User who created the record. |
| updated_by_id | uuid | No | No | — | User who last updated the record. |

---

## Enum Definitions

### PBSNodeType

| Value | Description |
|-------|-------------|
| project | Top-level project. |
| subsystem | Subsystem or major component. |
| configuration_item | Configuration item (CI). |
| work_package | Work package or deliverable. |
| other | Not classified above. |

---

## Relationships

| Target Entity | Relation Type | Cardinality | Direction | Description |
|---------------|---------------|-------------|-----------|-------------|
| PBS | parent | 0..1 | Outbound | Parent node (part-of hierarchy). |
| PBS | children | 0..n | Inbound | Child nodes. |
| User | created_by | 0..1 | Outbound | Creator (optional). |
| User | updated_by | 0..1 | Outbound | Last updater (optional). |
| Requirement | part-of (project_id) | 0..n | Inbound | Requirements scoped to this node. |
| Test Case | part-of (project_id) | 0..n | Inbound | Test cases scoped to this node. |
| Test Plan | part-of (project_id) | 0..n | Inbound | Test plans scoped to this node. |
| Function | part-of (project_id) | 0..n | Inbound | Functions scoped to this node. |

---

## Lifecycle

PBS nodes do not have a formal status lifecycle in this specification. Add/remove/reorder of children is allowed per permissions. Deletion of a node that has children or that is referenced by requirements/test cases/functions SHALL be blocked or cascade per policy (see Deletion Behavior).

---

## Validation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| code_unique | code SHALL be unique across all PBS nodes (global or per root project per policy). | Duplicate PBS code. |
| name_non_empty | name SHALL have length ≥ 1 after trim. | Name is required. |
| no_circular_parent | parent_id SHALL not form a cycle (self or ancestor). | Circular PBS hierarchy. |
| parent_exists | If parent_id is set, it SHALL reference an existing PBS node. | Invalid parent. |

---

## Deletion Behavior

- **Soft delete**: Preferred. Use a dedicated deleted or inactive flag; retain for audit and referential integrity of historical data.
- **Hard delete**: If allowed, MUST enforce: (1) Node SHALL have no children, or children SHALL be moved or deleted first. (2) Requirements, test cases, test plans, and functions with project_id = this node SHALL be reassigned to another node or blocked from deletion. No cascade delete of requirements/test cases/functions without explicit policy. Root node deletion MAY be forbidden.

---

## Audit Behavior

- **Create**: Log entity type `pbs`, action `create`, id, code, parent_id, created_by_id, timestamp.
- **Update**: Log entity type `pbs`, action `update`, id, changed attributes, updated_by_id, timestamp.
- **Delete**: Log entity type `pbs`, action `delete`, id, code, performed_by_id, timestamp.
- **Reorder**: Log when order_index or parent_id changes (move node).

See `../audit/audit-log-spec.md`.

---

## UI Expectations

- Tree view: Hierarchy by parent_id; expand/collapse. Display code, name, type. Sort siblings by order_index then code. Filter by type.
- Detail view: All attributes editable per permissions. Show children list and count of linked entities (requirements, test cases, test plans, functions). Option to move node (change parent_id).
- Create: code, name, type required. parent_id optional (root if null). order_index optional.
- Navigation: PBS SHALL be used as project/project selector for requirements, test cases, test plans, functions.

See `../ui/requirements-page.md` and `../ui/verification-page.md` for project_id usage.

---

## Change Impact Notes

- `[ADD_ATTR]` Adding an attribute: add column (nullable or default), extend API and UI.
- `[REMOVE_ATTR]` Removing an attribute: breaking; migration and API/UI update.
- `[CHANGE_TYPE]` Changing attribute type: breaking; migration and validation.
- `[CHANGE_ENUM]` Add enum value: additive. Remove enum value: breaking; migrate data.
- `[CHANGE_CARDINALITY]` Changing hierarchy (e.g. allow multiple parents) would be a fundamental model change; migration and all project_id usages must be reviewed.
