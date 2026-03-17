# Verification Page — UI Specification

## Overview

This document defines the UI behavior for verification-related views: Test Cases, Test Plans, Test Runs, and the Requirement–Test Case traceability matrix. Conform to the existing design system.

---

## Scope

- Test case list and detail
- Test plan list and detail
- Test run list and create (and detail if needed)
- Traceability / verification matrix (Requirement ↔ Test Case)

---

## Page: Test Case List

### URL / Route

- Path: `/test-cases` or `/projects/:projectId/test-cases`.
- Query params: `project`, `type`, `status`, `sort`, `order`, `page`, `pageSize`.

### Layout

- **Header**: Page title "Test Cases", project selector, "Create test case" primary action.
- **Toolbar**: Filters (project, type, status), sort, optional search (code, title).
- **Content**: Table. Pagination.

### Table Columns

| Column Key | Label | Sortable | Filterable | Notes |
|------------|-------|----------|------------|-------|
| code | Code | Yes | No | Link to detail. |
| title | Title | Yes | No | Link to detail. |
| type | Type | Yes | Yes | Enum label. |
| status | Status | Yes | Yes | Enum label. |
| project | Project | No | Yes | PBS code/name. |
| requirement_count | Requirements | No | No | Count of verifies links. |
| updated_at | Updated | Yes | No | Formatted datetime. |

Default sort: `updated_at` descending.

### Actions

- Row: Open (code/title). Optional context menu: Edit, Duplicate, Add to test plan.
- Create test case: Navigate to create form.

---

## Page: Test Case Detail

### URL / Route

- Path: `/test-cases/:id`.

### Layout

- **Header**: Code, status, actions: Save, Execute (create test run), optional Delete.
- **Body**: Form sections: Identity (code, title, type, status, project), Description, Preconditions, Steps, Expected result, Verified requirements (verifies links), Test runs (list of runs with result, executed_at, executed_by).

### Fields

| Field | Widget | Required | Notes |
|-------|--------|----------|-------|
| code | Text input | Yes | Unique per project. |
| title | Text input | Yes | — |
| type | Dropdown | Yes | TestCaseType. |
| status | Dropdown | Yes | TestCaseStatus. |
| project_id | Dropdown | Yes | PBS. |
| description | Textarea | No | — |
| preconditions | Textarea | No | — |
| steps | Textarea | No | — |
| expected_result | Textarea | No | — |

### Verified Requirements (verifies)

- List of Requirement (code, title). Add/remove links. Each test case SHALL verify at least one requirement (enforced at save or at approval per policy).

### Test Runs

- Table: executed_at, result, executed_by, environment, link to run detail if needed. Button "Record run" → open Test Run create (pre-fill test_case_id, optional test_plan_id).

---

## Page: Test Plan List

### URL / Route

- Path: `/test-plans` or `/projects/:projectId/test-plans`.

### Layout

- **Header**: "Test Plans", project selector, "Create test plan".
- **Toolbar**: Filters (project, status), sort.
- **Content**: Table.

### Table Columns

| Column Key | Label | Sortable | Filterable |
|------------|-------|----------|------------|
| code | Code | Yes | No |
| title | Title | Yes | No |
| status | Status | Yes | Yes |
| project | Project | No | Yes |
| test_case_count | Test cases | No | No |
| updated_at | Updated | Yes | No |

---

## Page: Test Plan Detail

### URL / Route

- Path: `/test-plans/:id`.

### Layout

- **Header**: Code, status, Save, optional "Execute plan" (create runs for selected cases).
- **Body**: Identity (code, title, status, project), Included test cases (list with add/remove). When status = locked or closed, add/remove MAY be disabled.

### Included Test Cases

- List/table: Test case code, title, type. Actions: Remove from plan (when allowed). Add: modal or dropdown to select test cases (same project). Order optional (order_index in junction).

---

## Page: Test Run Create / Record

### URL / Route

- Path: `/test-runs/create` or `/test-cases/:id/runs/create`, optional `?testPlan=:planId`.

### Layout

- Form: test_case_id (pre-filled or required select), test_plan_id (optional, from context), result (dropdown: pass, fail, blocked, skipped, not_run), executed_at (datetime, default now), executed_by_id (optional, default current user), environment, notes.
- Submit: POST test run. On success: redirect to test case detail or test run list.

---

## Page: Test Run List

### URL / Route

- Path: `/test-runs` or `/test-cases/:id/runs` or `/test-plans/:planId/runs`.
- Query: `testCase`, `testPlan`, `result`, `from`, `to`, `page`, `pageSize`.

### Table Columns

| Column Key | Label | Sortable | Filterable |
|------------|-------|----------|------------|
| test_case_code | Test case | Yes | Yes |
| result | Result | Yes | Yes |
| executed_at | Executed | Yes | No |
| executed_by | Executed by | No | Yes |
| environment | Environment | No | No |
| test_plan | Plan | No | Yes |

Default sort: executed_at descending.

---

## Page: Verification / Traceability Matrix

### URL / Route

- Path: `/traceability` or `/projects/:projectId/traceability` or `/verification-matrix`.
- Query: `project`, optional view (requirements-rows vs test-cases-rows).

### Layout

- **Header**: "Verification matrix" or "Traceability", project selector.
- **Content**: Matrix view.
  - **Rows**: Requirements (or Test Cases, depending on view).
  - **Columns**: Test Cases (or Requirements).
  - **Cells**: Link indicator (e.g. checkmark, icon) if verifies relation exists between row and column. Click: add/remove link or navigate to link management.

### Behavior

- Data: Load requirements and test cases for project; load verifies (requirement_test_case) links. Render matrix.
- Add link: Select cell (Req, TC) → POST link. Remove: DELETE link. Conform to traceability-model (Test Case 1..n Requirement).
- Export: Optional export to CSV/Excel per enterprise need.

### Permissions

- Read: requirement.read, test_case.read. Edit links: requirement.update and/or test_case.update per policy.

---

## Data Loading

- Test cases: GET `/api/test-cases?...`.
- Test case detail: GET `/api/test-cases/:id` (include verifies and runs).
- Test plans: GET `/api/test-plans?...`, GET `/api/test-plans/:id` with contains.
- Test runs: GET `/api/test-runs?...`, POST `/api/test-runs`.
- Matrix: GET `/api/requirements?project=...`, GET `/api/test-cases?project=...`, GET `/api/traceability/verifies?project=...` or equivalent.

---

## Change Impact Notes

- New attribute on Test Case/Test Plan/Test Run: add column or form field and API mapping. `[ADD_ATTR]`.
- New enum value: update dropdowns and filters. `[CHANGE_ENUM]`.
- New relation or cardinality change: update matrix and link UI. `[CHANGE_CARDINALITY]`.
