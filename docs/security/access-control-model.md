# Access Control Model

## Overview

This document defines the Role-Based Access Control (RBAC) model for the aerospace lifecycle management tool. It is designed to be machine-readable and RBAC-ready. Permissions are scoped to entity types and actions; roles aggregate permissions.

---

## Concepts

| Concept | Definition |
|---------|------------|
| User | Identity (see domain/users.md). |
| Role | Named set of permissions. |
| Permission | (resource, action) or (entity_type, action). |
| Assignment | User ↔ Role many-to-many. |

---

## Entity Types (Resources)

| Resource | Description |
|----------|-------------|
| requirement | Requirement entity. |
| test_case | Test case entity. |
| test_plan | Test plan entity. |
| test_run | Test run entity. |
| function | Function entity. |
| pbs | PBS node. |
| user | User entity. |
| traceability | Link management (verifies, derives-from, satisfies). |
| audit_log | Audit log (read). |

---

## Actions

| Action | Description |
|--------|-------------|
| create | Create a new entity. |
| read | View entity and list. |
| update | Edit entity attributes. |
| delete | Soft or hard delete per policy. |
| transition | Change lifecycle status (where applicable). |
| link | Add/remove traceability links (verifies, derives-from, satisfies). |

---

## Permission Format

- **Format**: `resource.action` (e.g. `requirement.create`, `test_case.read`, `requirement.transition`).
- **Wildcard**: `*` for all resources or all actions is optional (e.g. `requirement.*`, `*.read`). If not supported, list each permission explicitly.

---

## Standard Roles (Recommended)

| Role Name | Permissions | Description |
|-----------|-------------|-------------|
| viewer | requirement.read, test_case.read, test_plan.read, test_run.read, function.read, pbs.read | Read-only access to all domain entities. |
| contributor | viewer + requirement.create, requirement.update, test_case.create, test_case.update, test_plan.create, test_plan.update, function.create, function.update, test_run.create, pbs.read, traceability.link | Create and edit requirements, test cases, test plans, functions; record test runs; manage links. No delete, no transition to approved. |
| reviewer | contributor + requirement.transition, test_case.transition, test_plan.transition, function.transition | Can move entities to under_review and approved. |
| approver | reviewer + requirement.transition (to verified), test_case.transition, test_plan.transition, function.transition | Can perform all transitions including verified where applicable. |
| admin | *.create, *.read, *.update, *.delete, *.transition, traceability.link, user.read, user.update | Full access; user management. |
| audit_viewer | audit_log.read | Read audit log only. |

---

## Assignment Rules

- A user SHALL have zero or more roles.
- Effective permissions = union of permissions from all assigned roles.
- Deny overrides: Not used in this model; only allow. If a role is removed, user loses those permissions immediately.
- Default role for new users: viewer or none; configurable.

---

## Project / PBS Scoping (Optional)

- **Model**: Permissions MAY be scoped by project (PBS). Example: user has role "contributor" for project P1 only.
- **Implementation**: (user, role, project_id) or (user, permission, project_id). If project_id is null, permission applies to all projects.
- **UI**: Filter lists and actions by projects the user has access to. Hide or disable actions for projects without permission.

---

## UI Expectations

- **Visibility**: Buttons and menu items (Create, Edit, Delete, Transition, Link) SHALL be visible only if user has the corresponding permission for the resource (and project if scoped).
- **Disable**: If action is visible but not permitted (e.g. insufficient role), disable with tooltip "Insufficient permissions" or hide.
- **List/detail**: Read permission required to see entity list and open detail. Update permission for edit form.
- **Role management**: Admin only. Page: list users, assign/remove roles per user. Optional: list roles and their permissions.

---

## API Expectations

- **Authorization**: Every API endpoint SHALL check permission (resource, action) for the current user (and project if scoped) before performing the operation. Return 403 Forbidden if not permitted.
- **Filtering**: List endpoints (e.g. GET /api/requirements) SHALL return only entities the user has read access to (e.g. by project scope).

---

## Audit

- Permission denial (403) MAY be logged: user_id, resource, action, timestamp. See audit-log-spec.md.
- Role assignment changes SHALL be audited: user_id, role, action (assign/remove), performed_by_id, timestamp.

---

## Change Impact Notes

- Adding a resource: Add new permissions (resource.create, resource.read, etc.) and assign to roles. `[ADD_ENTITY]`.
- Adding an action: Add new permission (e.g. resource.export); assign to roles. No schema change if roles are stored as permission sets.
- Removing a permission or role: Breaking for existing assignments; migration to reassign. `[REMOVE_ATTR]`-like.
- Adding project scoping: Schema change (role_assignment + project_id); migration and UI for scope selection.
