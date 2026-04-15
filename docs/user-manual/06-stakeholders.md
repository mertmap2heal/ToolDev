---
title: "Stakeholders"
description: "Manage project stakeholders, roles, responsibilities, committees, and approval authorities"
status: "draft"
lastUpdated: "2026-04-14"
version: "1.0"
audience: "admin-only"
relatedPages:
  - "01-requirements.md"
---

# Stakeholders
> Define who is involved in the project, what they are responsible for, and what authority they hold over decisions and approvals.

---

## Overview

The Stakeholders page manages the human side of the engineering project: the people involved, their assigned roles, their responsibilities in the RACI matrix, the committees and review boards they sit on, and the approval authority rules that govern what requires sign-off. It provides a communication log for tracking stakeholder interactions and an audit trail of role assignments.

> **Admin only:** This page is only visible to project administrators.

---

## Who Uses This Page

| Role | How they use this page |
|------|----------------------|
| Project Admin | Configure roles, assign responsibilities, define approval rules |
| Project Lead | Review RACI matrix, manage committees |

---

## Navigation

**Project** → **Stakeholders** (left sidebar)

> **Note:** If you do not see Stakeholders in the sidebar, you do not have admin access to this project.

---

## Key Concepts

| Term | Definition |
|------|-----------|
| **Stakeholder** | Any person with an interest in or influence over the project |
| **Engineering role** | A named project-level role (e.g. Requirements Engineer, Systems Lead) distinct from the system RBAC role |
| **RACI** | Responsible, Accountable, Consulted, Informed — a responsibility assignment framework |
| **Committee** | A named group (e.g. Technical Review Board) with defined membership |
| **Approval authority** | A rule defining which decisions require sign-off from which roles |
| **Communication log** | A record of stakeholder interactions (meetings, emails, decisions) |

---

## Page Layout

The page is organised into tabs:

| Tab | Purpose |
|-----|---------|
| **Directory** | List of all project members with their assigned roles |
| **Roles & Assignments** | Assign engineering roles to project members |
| **RACI / Responsibilities** | Build and view the RACI responsibility matrix |
| **Committees & Boards** | Define review committees and their membership |
| **Approval Authority Rules** | Configure what decisions require which approvals |
| **Requests & Actions** | A board of pending approval requests and action items |
| **Communication Log** | Record and browse stakeholder communications |
| **Audit Trail** | History of role changes and assignment modifications |
| **Settings & Roles** | Configure available engineering roles for this project |

---

## Common Workflows

### How to assign an engineering role to a team member

1. Go to the **Roles & Assignments** tab.
2. Find the team member in the list.
3. Click **Assign Role**.
4. Select the engineering role from the dropdown.
5. Click **Save**.

---

### How to add a committee

1. Go to the **Committees & Boards** tab.
2. Click **New Committee**.
3. Enter a **Name** and optional **Description**.
4. Add members by searching for project users.
5. Click **Save**.

---

### How to define an approval authority rule

> TODO: Document the approval authority rule configuration workflow.

---

### How to log a stakeholder communication

> TODO: Document adding a communication log entry.

---

## Tips & Notes

> **Admin only:** All functions on this page require project admin permissions.

> **Note:** Engineering roles are project-scoped and distinct from the platform-level admin roles managed in the Admin panel. See [Admin](admin) documentation for platform roles.

---

## Related Pages

- [Requirements](01-requirements.md) — requirements have owners drawn from the stakeholder list
