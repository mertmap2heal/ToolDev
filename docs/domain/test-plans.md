# Test Plan

## Overview

A Test Plan is a collection of test cases grouped for a specific verification scope, milestone, or release. It references test cases and may be associated with a project or PBS node. Test plans do not execute tests; execution is recorded in Test Runs.

---

## Attributes

| Attribute Name | Type | Required | Editable | Default | Description |
|----------------|------|----------|----------|---------|-------------|
| id | uuid | Yes | No | system | Primary key. |
| code | string(64) | Yes | Yes | — | Unique business identifier within project (e.g. TP-REL-1.0). |
| title | string(256) | Yes | Yes | — | Short descriptive title. |
| description | text | No | Yes | — | Purpose and scope of the test plan. |
| status | enum TestPlanStatus | Yes | Yes | draft | Lifecycle status. |
| project_id | uuid | Yes | No | — | Project or PBS node this test plan belongs to. |
| created_at | datetime | Yes | No | system | Creation timestamp (UTC). |
| updated_at | datetime | Yes | No | system | Last modification timestamp (UTC). |
| created_by_id | uuid | No | No | — | User who created the record. |
| updated_by_id | uuid | No | No | — | User who last updated the record. |

---

## Enum Definitions

### TestPlanStatus

| Value | Description |
|-------|-------------|
| draft | Test cases can be added/removed. |
| locked | Content frozen; ready for execution. |
| closed | Test plan no longer active; historical. |

---

## Relationships

| Target Entity | Relation Type | Cardinality | Direction | Description |
|---------------|---------------|-------------|-----------|-------------|
| Project / PBS | part-of | 1..1 | Outbound | Test plan belongs to one project/PBS node. |
| User | created_by | 0..1 | Outbound | Creator (optional). |
| User | updated_by | 0..1 | Outbound | Last updater (optional). |
| Test Case | contains | 0..n | Outbound | Test cases included in this plan (many-to-many). |
| Test Run | executes_plan | 0..n | Inbound | Test runs that execute this plan. |

---

## Lifecycle

See `../lifecycle/lifecycle-model.md`. Status transitions: draft → locked → closed. No reverse transition from closed. When status = locked or closed, add/remove of test cases MAY be forbidden (configurable).

---

## Validation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| code_unique_per_project | code SHALL be unique within project_id. | Duplicate test plan code. |
| title_non_empty | title SHALL have length ≥ 1 after trim. | Title is required. |
| project_exists | project_id SHALL reference an existing project/PBS node. | Invalid project. |

---

## Deletion Behavior

- **Soft delete**: Preferred. Set status to closed or use a dedicated deleted flag if defined.
- **Hard delete**: If allowed, MUST remove all contains links (Test Plan ↔ Test Case). Test Run records that reference this plan SHALL either retain plan_id for history (nullable allowed) or be updated per policy. No orphaned contains links.

---

## Audit Behavior

- **Create**: Log entity type `test_plan`, action `create`, id, code, project_id, created_by_id, timestamp.
- **Update**: Log entity type `test_plan`, action `update`, id, changed attributes, updated_by_id, timestamp.
- **Status change**: Log previous_status and new_status.
- **Delete**: Log entity type `test_plan`, action `delete`, id, code, performed_by_id, timestamp.
- **Link change**: Log when test cases are added to or removed from plan (entity `test_plan_test_case`, action `link` / `unlink`).

See `../audit/audit-log-spec.md`.

---

## UI Expectations

- List view: code, title, status, project, test case count. Sortable by code, title, status, updated_at. Filter by status, project.
- Detail view: All attributes editable per permissions when status = draft. Show list of included test cases with add/remove when allowed. Read-only or limited edit when locked/closed per policy.
- Create: code, title, project_id required. Default status = draft. Option to add test cases on create or after.

See `../ui/verification-page.md` for integration with verification matrix.

---

## Change Impact Notes

- `[ADD_ATTR]` Adding an attribute: add column (nullable or default), extend API and UI.
- `[REMOVE_ATTR]` Removing an attribute: breaking; migration and API/UI update.
- `[CHANGE_TYPE]` Changing attribute type: breaking; migration and validation.
- `[CHANGE_ENUM]` Add enum value: additive. Remove enum value: breaking; migrate data.
- `[CHANGE_CARDINALITY]` Changing relation to Test Case or Test Run: migration and cascade update.
