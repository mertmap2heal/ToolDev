# Links Page — UI Specification

## Overview

This document defines the UI behavior for managing traceability links between entities: Requirement ↔ Requirement (derives-from), Function ↔ Requirement (satisfies), and any dedicated "links" or "traceability" management view. Conform to the existing design system.

---

## Scope

- Derives-from (Requirement → Requirement) management
- Satisfies (Function → Requirement) management
- Optional: centralized link management view

---

## Context

Links are also editable from entity detail pages (see requirements-page.md and verification-page.md). This spec covers:
- Explicit "Links" or "Traceability" page(s) if provided.
- In-context link widgets (e.g. on Requirement detail, Function detail).

---

## Requirement Detail: Derives-From (Parent/Child)

### Parent Requirement (derived-by)

- **Location**: Requirement detail page, Traceability section.
- **Widget**: Single select or autocomplete. Display: parent requirement code and title. Value: requirement_id (stored as derived_by or equivalent on this requirement).
- **Actions**: Select parent, Clear parent. Allowed set: Requirements in same project (or configurable scope). Validation: No circular reference (this requirement SHALL NOT be ancestor of selected parent).
- **API**: PATCH `/api/requirements/:id` with `parent_requirement_id` or `derived_by_requirement_id`. Or dedicated PUT `/api/requirements/:id/derives-from` with body `{ "parent_id": "uuid" }`.

### Child Requirements (derives-from)

- **Location**: Requirement detail page, Traceability section.
- **Widget**: List of requirements that have derived_by = this requirement. Display: code, title, status. Link to each.
- **Actions**: "Add child" → select requirement R, then set R.derived_by = this requirement (PATCH requirement R). "Remove" → set R.derived_by = null. Validation: Child must be in same project; no cycle.
- **API**: List children via GET `/api/requirements?derived_by=:id`. Update via PATCH child requirement.

---

## Function Detail: Satisfies (Function → Requirement)

### Satisfied Requirements

- **Location**: Function detail page, Traceability section.
- **Widget**: List of requirements linked by satisfies. Display: requirement code, title, type. Link to requirement.
- **Actions**: Add requirement (multi-select or autocomplete), Remove link. Constraint: Function 1..n Requirement; at least one required at save or at approval per policy.
- **API**: GET `/api/functions/:id` with expanded requirements. POST `/api/functions/:id/requirements` with body `{ "requirement_ids": ["uuid", ...] }`. DELETE `/api/functions/:id/requirements/:reqId`. Or junction CRUD.

---

## Requirement Detail: Verified By (Test Cases)

- **Location**: Requirement detail page, Traceability section (see requirements-page.md).
- **Widget**: List of test cases that verify this requirement (inverse of verifies). Add/remove links. Test case owns the relation; from requirement side, add = create verifies link with this requirement and selected test case.
- **API**: GET test cases linked to this requirement. POST/DELETE verifies link (e.g. POST `/api/test-cases/:tcId/requirements` with `requirement_id`, or POST `/api/traceability/verifies` with test_case_id, requirement_id).

---

## Optional: Centralized Links / Traceability Page

### URL / Route

- Path: `/traceability/links` or `/projects/:projectId/links`.
- Purpose: Single place to view and edit all link types for a project.

### Layout

- **Tabs or sections**: Derives-from (Requirement tree or table), Verifies (matrix or list), Satisfies (Function–Requirement table).
- **Derives-from**: Tree of requirements with parent/child. Inline edit parent or "Manage" opens requirement detail.
- **Verifies**: Same matrix as verification-page.md (Requirement × Test Case).
- **Satisfies**: Table: Function code, Requirement code(s). Edit: click row to open Function detail or inline add/remove requirement.

Data loading and permissions as in requirements-page, verification-page, and domain/security specs.

---

## Validation and Errors

- **Cycle**: On set derives-from or parent (PBS, Function), if cycle detected return 400 with message "Circular reference not allowed." Display in UI.
- **Duplicate link**: If verifies or satisfies link already exists, POST is idempotent or return 409. Do not duplicate junction row.
- **Cardinality**: Test case must have at least one requirement (verifies) per policy; enforce on save with clear error.

---

## Change Impact Notes

- New relation type: add section and API; add to centralized page if present. `[ADD_RELATION]`.
- Cardinality change (e.g. optional verifies): update validation and UI (allow zero requirements). `[CHANGE_CARDINALITY]`.
