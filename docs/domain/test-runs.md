# Test Run

## Overview

A Test Run represents a single execution of a test case at a point in time. It records result (pass/fail/blocked/etc.), optional execution metadata (tester, environment, build), and optional link to a test plan. Test runs are immutable once finalized; corrections require a new run or a dedicated correction workflow per policy.

---

## Attributes

| Attribute Name | Type | Required | Editable | Default | Description |
|----------------|------|----------|----------|---------|-------------|
| id | uuid | Yes | No | system | Primary key. |
| test_case_id | uuid | Yes | No | — | Test case that was executed. |
| test_plan_id | uuid | No | No | — | Test plan this run belongs to (optional). |
| result | enum TestRunResult | Yes | Yes | — | Execution result. |
| executed_at | datetime | Yes | No | system | When the run was executed (UTC). |
| executed_by_id | uuid | No | No | — | User who executed the test. |
| environment | string(256) | No | Yes | — | Test environment or build identifier. |
| notes | text | No | Yes | — | Execution notes or comments. |
| created_at | datetime | Yes | No | system | Record creation timestamp (UTC). |
| updated_at | datetime | Yes | No | system | Last modification timestamp (UTC). |

---

## Enum Definitions

### TestRunResult

| Value | Description |
|-------|-------------|
| pass | Test passed. |
| fail | Test failed. |
| blocked | Test could not be executed (blocked). |
| skipped | Test was skipped. |
| not_run | Not executed (e.g. planned but not run). |

---

## Relationships

| Target Entity | Relation Type | Cardinality | Direction | Description |
|---------------|---------------|-------------|-----------|-------------|
| Test Case | executed-in | 1..1 | Outbound | This run executes one test case. |
| Test Plan | executes_plan | 0..1 | Outbound | Optional plan this run belongs to. |
| User | executed_by | 0..1 | Outbound | User who executed (optional). |

---

## Lifecycle

Test Run has no state machine. It is created with result and becomes part of history. Edits MAY be allowed until a cutoff (e.g. until run is "finalized") per policy. After cutoff, updates SHALL be forbidden or require a dedicated override/audit.

---

## Validation Rules

| Rule | Condition | Error |
|------|-----------|-------|
| test_case_exists | test_case_id SHALL reference an existing test case. | Invalid test case. |
| test_plan_exists | If test_plan_id present, it SHALL reference an existing test plan. | Invalid test plan. |
| result_required | result SHALL be one of TestRunResult. | Invalid result. |
| executed_at_present | executed_at SHALL be set on create. | Executed at is required. |

---

## Deletion Behavior

- **Soft delete**: Preferred. Use a dedicated deleted or voided flag; retain for audit and traceability.
- **Hard delete**: If allowed by policy, only before run is "finalized" or within a retention window. Deleting a test case SHALL NOT cascade-delete test runs; either retain runs with nullable test_case_id for history or block test case deletion while runs exist (configurable).

---

## Audit Behavior

- **Create**: Log entity type `test_run`, action `create`, id, test_case_id, test_plan_id, result, executed_at, executed_by_id, timestamp.
- **Update**: Log entity type `test_run`, action `update`, id, changed attributes (e.g. result, notes), updated_by_id, timestamp. Updates SHALL be rare if runs are immutable after finalization.
- **Delete**: Log entity type `test_run`, action `delete`, id, test_case_id, performed_by_id, timestamp.

See `../audit/audit-log-spec.md`.

---

## UI Expectations

- List view: test case code/title, result, executed_at, executed_by, environment, test_plan (if any). Filter by test_case_id, test_plan_id, result, date range, executed_by. Sort by executed_at (default descending).
- Detail view: All attributes visible; editing restricted per policy (e.g. only result and notes editable until finalized). Show link to parent test case and requirement(s) via test case.
- Create: test_case_id (or selected from plan), result, executed_at, executed_by_id, environment, notes. executed_at default = now. Option to select test_plan_id when creating from a plan.
- Reporting: Test runs SHALL support aggregation by requirement (via test case → verifies) for coverage and pass/fail status.

See `../ui/verification-page.md`.

---

## Change Impact Notes

- `[ADD_ATTR]` Adding an attribute: add column (nullable or default), extend API and UI.
- `[REMOVE_ATTR]` Removing an attribute: breaking; migration and API/UI update.
- `[CHANGE_TYPE]` Changing attribute type: breaking; migration and validation.
- `[CHANGE_ENUM]` Add enum value: additive. Remove enum value: breaking; migrate existing runs.
- `[CHANGE_CARDINALITY]` Changing relation to Test Case or Test Plan: migration and cascade policy update.
