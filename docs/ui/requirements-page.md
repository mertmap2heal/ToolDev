# Requirements Page — UI Specification

## Overview

This document defines the UI behavior, layout, and interactions for the Requirements management page(s). The specification is deterministic and supports REST API + modern frontend implementation. Conform to the existing design system.

---

## Scope

- Requirements list (table/grid)
- Requirement detail (view/edit)
- Requirement create
- Filtering and sorting
- Project (PBS) selector

---

## Page: Requirements List

### URL / Route

- Path: `/requirements` or `/projects/:projectId/requirements`.
- Query params: `project`, `type`, `priority`, `status`, `sort`, `order`, `page`, `pageSize`.

### Layout

- **Header**: Page title "Requirements", project (PBS) selector dropdown, "Create requirement" primary action.
- **Toolbar**: Filters (project, type, priority, status), sort (field + asc/desc), optional search (code, title).
- **Content**: Table with columns as specified below. Pagination at bottom (page size options: 10, 25, 50, 100).

### Table Columns

| Column Key | Label | Sortable | Filterable | Width / Behavior |
|------------|-------|----------|------------|-------------------|
| code | Code | Yes | No (use search) | Fixed or min width; link to detail. |
| title | Title | Yes | No (use search) | Truncate with tooltip; link to detail. |
| type | Type | Yes | Yes (multi-select) | Enum label. |
| priority | Priority | Yes | Yes (multi-select) | Enum label. |
| status | Status | Yes | Yes (multi-select) | Enum label. |
| project | Project | No | Yes (single select) | PBS code or name. |
| updated_at | Updated | Yes | No | Formatted datetime. |

Default sort: `updated_at` descending. Secondary sort: `code` ascending.

### Actions (per row)

- **Open**: Click on code or title → navigate to requirement detail.
- **Context menu** (optional): Edit, Duplicate, Change status (if permitted by role and lifecycle). No delete in list unless policy allows; prefer soft delete from detail.

### Empty State

- When no requirements match filters: Message "No requirements found." and optional "Clear filters" or "Create requirement".

### Permissions

- Visibility of "Create requirement" and row actions SHALL follow `../security/access-control-model.md` (e.g. requirement.create, requirement.update).
- Filter by project SHALL respect project-level access if applicable.

---

## Page: Requirement Detail

### URL / Route

- Path: `/requirements/:id`.

### Layout

- **Header**: Requirement code (read-only or editable per permissions), status badge, primary actions: Save, optional Change status, optional Delete (soft/hard per policy).
- **Body**: Form sections: Identity (code, title, type, priority, status, project), Description (description), Traceability (derives-from, derived-by, verifies, satisfies), Audit (created_at, updated_at, created_by, updated_by if shown).

### Fields (editable per permissions)

| Field | Widget | Required | Notes |
|-------|--------|----------|-------|
| code | Text input | Yes | Unique per project; validated on blur or save. |
| title | Text input | Yes | Max length 256. |
| type | Dropdown | Yes | Values from RequirementType enum. |
| priority | Dropdown | No | Values from RequirementPriority enum. |
| status | Dropdown or state widget | Yes | Values from RequirementStatus; transitions per lifecycle-model. |
| project_id | Dropdown (PBS) | Yes | Read-only after create if policy forbids move. |
| description | Textarea or rich text | No | Multi-line. |

### Traceability Section

- **Parent requirement (derived-by)**: Single select or link. Display parent code/title; link to parent. Edit: select another requirement or clear. Allowed targets: Requirement in same project or configurable scope.
- **Child requirements (derives-from)**: List of links (code, title). Link to each. Add/remove child links per traceability-model (derives-from is stored on child; UI may show "Add child requirement" and set child.derived_by = this).
- **Verified by (verifies)**: List of Test Cases (code, title). Link to test case. Add/remove links (many-to-many). Test case entity owns verifies relation; this page shows inverse.
- **Satisfied by (satisfies)**: List of Functions (code, title). Link to function. Add/remove links (Function → Requirement; this page shows inverse).

### Validation Feedback

- Inline errors per field (e.g. duplicate code, empty title). Server validation errors SHALL be displayed (e.g. toast or inline).
- Save SHALL be disabled or trigger validation if required fields are empty.

### Permissions

- Edit vs read-only per requirement.update. Status change per lifecycle and role. Delete per requirement.delete.

---

## Page: Create Requirement

### URL / Route

- Path: `/requirements/create` or `/projects/:projectId/requirements/create`.
- Pre-fill project_id from route or context if present.

### Layout

- Same form as Requirement Detail. Sections: Identity, Description. Traceability (parent, verifies, satisfies) MAY be editable after create or in same form per policy.

### Defaults

- status = draft.
- type = functional.
- priority = medium.
- project_id = from route or current project context.

### Submit

- POST to API. On success: redirect to `/requirements/:id` or show success and link. On validation error: display errors, keep form state.

---

## Data Loading

- List: GET `/api/requirements?project=...&type=...&status=...&sort=...&order=...&page=...&pageSize=...`.
- Detail: GET `/api/requirements/:id` (include optional expanded links for traceability).
- Create: POST `/api/requirements` with body per domain attributes.
- Update: PATCH or PUT `/api/requirements/:id`.
- Traceability links: Use endpoints per traceability-model (e.g. GET/POST/DELETE for verifies, derives-from, satisfies).

---

## Change Impact Notes

- Adding a column to the list: extend table definition and API response mapping. `[ADD_ATTR]` on Requirement.
- Adding a field to detail form: extend form and API. `[ADD_ATTR]`.
- Changing enum values: update dropdowns and filters. `[CHANGE_ENUM]`.
- New relation type: add section and link management UI. `[ADD_RELATION]`.
