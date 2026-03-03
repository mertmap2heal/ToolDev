# Test Case

## Overview

A Test Case is a specification of inputs, preconditions, steps, and expected results used to verify one or more requirements. Each test case is uniquely identified within the project and is linked to requirements via the verifies relation. Test cases are executed as part of Test Runs.

---

## Attributes

| Attribute Name | Type | Required | Editable | Default | Description |
|----------------|------|----------|----------|---------|-------------|
| id | uuid | Yes | No | system | Primary key. |
| code | string(64) | Yes | Yes | — | Unique business identifier within project (e.g. TC-SYS-001). |
| title | string(256) | Yes | Yes | — | Short descriptive title. |
| description | text | No | Yes | — | Purpose and scope of the test. |
| preconditions | text | No | Yes | — | Preconditions before execution. |
| steps | text | No | Yes | — | Test steps (structured or free text). |
| expected_result | text | No | Yes | — | Expected outcome. |
| type | enum TestCaseType | Yes | Yes | functional | Test case classification. |
| status | enum TestCaseStatus | Yes | Yes | draft | Lifecycle status. |
| project_id | uuid | Yes | No | — | Project or PBS node this test case belongs to. |
| created_at | datetime | Yes | No | system | Creation timestamp (UTC). |
| updated_at | datetime | Yes | No | system | Last modification timestamp (UTC). |
| created_by_id | uuid | No | No | — | User who created the record. |
| updated_by_id | uuid | No | No | — | User who last updated the record. |

---

## Enum Definitions

### TestCaseType

| Value | Description |
|-------|-------------|
| functional | Verifies functional behavior. |
| performance | Verifies performance criteria. |
| safety | Safety-related test (e.g. DO-178C). |
| integration | Integration or interface test. |
| regression | Regression test. |
| other | Not classified above. |

### TestCaseStatus

| Value | Description |
|-------|-------------|
| draft | Work in progress. |
| under_review | Submitted for review. |
| approved | Approved for execution. |
| deprecated | No longer executed; retained for history. |

---

## Relationships

| Target Entity | Relation Type | Cardinality | Direction | Description |
|---------------|---------------|-------------|-----------|-------------|
| Project / PBS | part-of | 1..1 | Outbound | Test case belongs to one project/PBS node. |
| User | created_by | 0..1 | Outbound | Creator (optional). |
| User | updated_by | 0..1 | Outbound | Last updater (optional). |
| Requirement | verifies | 1..n | Outbound | Requirements this test case verifies. |
| Test Run | executed-in | 0..n | Inbound | Test runs that execute this test case. |
| Test Plan | part-of | 0..n | Inbound | Test plans that include this test case. |

---

## Lifecycle

See `../lifecycle/lifecycle-model.md`. Status transitions: draft → under_review → approved. Transition to deprecated allowed from any state. No reverse transitions from deprecated.

---

## Validation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| code_unique_per_project | code SHALL be unique within project_id. | Duplicate test case code. |
| title_non_empty | title SHALL have length ≥ 1 after trim. | Title is required. |
| code_format | code SHALL match pattern: alphanumeric, hyphen, underscore allowed. | Invalid test case code format. |
| project_exists | project_id SHALL reference an existing project/PBS node. | Invalid project. |
| at_least_one_requirement | Each test case SHALL verify at least one requirement (enforced at save or at approval per policy). | Test case must verify at least one requirement. |

---

## Deletion Behavior

- **Soft delete**: Preferred. Set status to deprecated or use a dedicated deleted flag if defined.
- **Hard delete**: If allowed, MUST remove all verifies links (Test Case → Requirement) and remove test case from all Test Plans. Test Run history MAY be retained with test_case_id nullable or preserved for audit. Orphaned verifies links SHALL NOT remain.

---

## Audit Behavior

- **Create**: Log entity type `test_case`, action `create`, id, code, project_id, created_by_id, timestamp.
- **Update**: Log entity type `test_case`, action `update`, id, changed attributes, updated_by_id, timestamp.
- **Status change**: Log previous_status and new_status.
- **Delete**: Log entity type `test_case`, action `delete`, id, code, performed_by_id, timestamp.
- **Link change**: Log when verifies links are added or removed (entity `test_case_requirement`, action `link` / `unlink`).

See `../audit/audit-log-spec.md`.

---

## UI Expectations

- List view: code, title, type, status, project. Sortable by code, title, status, updated_at. Filter by type, status, project. Show count of linked requirements.
- Detail view: All attributes editable per permissions. Show linked requirements (verifies) and test runs (executed-in). Edit verifies links (add/remove requirements).
- Create: code, title, type, project_id required. Default status = draft. Option to add requirement links on create.
- Traceability: Test case SHALL appear in verification matrix (rows or columns) with requirement links.

See `../ui/verification-page.md`.

---

## Change Impact Notes

- `[ADD_ATTR]` Adding an attribute: add column (nullable or default), extend API and UI.
- `[REMOVE_ATTR]` Removing an attribute: breaking; migration and API/UI update.
- `[CHANGE_TYPE]` Changing attribute type: breaking; migration and validation.
- `[CHANGE_ENUM]` Add enum value: additive. Remove enum value: breaking; migrate data.
- `[CHANGE_CARDINALITY]` Changing relation cardinality: migration and cascade/validation update.
