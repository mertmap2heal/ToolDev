---
title: "Stakeholders"
description: "Manage project stakeholders, roles, responsibilities, committees, and approval authorities"
status: "draft"
lastUpdated: "2026-05-18"
version: "1.1"
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
| **RACI** | Responsible, Accountable, Consulted, Informed — a responsibility assignment framework. Each subject row must have at least one **Accountable** assignment; exactly one is preferred |
| **Committee** | A named group (e.g. Technical Review Board) with defined membership |
| **Committee seat** | The role a member holds on a committee — **Chair**, **Voting**, **Non-voting**, **Observer**, **Secretary**, or **Auditor**. This is per-committee and separate from the member's engineering role |
| **Default reviewer** | A committee member nominated as a standing reviewer; the committee's default reviewers seed the sign-off chain for baselines, releases, and certification packages |
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
5. For each member, set a **Committee seat**: **Chair**, **Voting**, **Non-voting**, **Observer**, **Secretary**, or **Auditor**.
6. Optionally mark one or more members as **Default reviewer** to seed the committee into sign-off chains.
7. Click **Save**.

**Result:** The committee appears in the **Committees & Boards** table with its member count and seats. The change is recorded on the **Audit Trail** tab.

---

### How to build the RACI matrix

1. Go to the **RACI / Responsibilities** tab.
2. Click **Add Subject** and pick the artefact the responsibility applies to — a System Function, Requirement, Certification Objective, or Component. (Choose **Deliverable** to enter a free-text subject.)
3. The matrix shows a grid with subjects as rows and project members as columns.
4. Click a cell to set the member's responsibility for that subject: **R** (Responsible), **A** (Accountable), **C** (Consulted), or **I** (Informed). Use the arrow keys to move between cells.
5. Repeat for each subject and member.
6. Click **Save**.

**Result:** The matrix is saved. Each subject must have at least one **Accountable** assignment — saving a subject with none is rejected with an error. A subject with more than one Accountable saves but shows a warning, because exactly one Accountable per subject is preferred.

---

### How to review the audit trail

1. Go to the **Audit Trail** tab.
2. The tab lists every recorded change — role assignments, committee edits, and RACI edits — newest first.
3. Use the **Modules** filter to narrow the list to one or more change types (for example, committee or RACI changes only).
4. Each row shows who made the change, when, and a summary of what changed.

**Result:** You see a chronological, filterable history of governance changes for the project.

---

### How to define an approval authority rule

> TODO: Document the approval authority rule configuration workflow. (The Approval Authority Rules tab is a preview surface — see Tips & Notes.)

---

### How to log a stakeholder communication

> TODO: Document adding a communication log entry. (The Communication Log tab is a preview surface — see Tips & Notes.)

---

## Tips & Notes

> **Admin only:** All functions on this page require project admin permissions.

> **Note:** Engineering roles are project-scoped and distinct from the platform-level admin roles managed in the Admin panel. See [Admin](admin) documentation for platform roles.

> **Committee seats vs engineering roles:** A member's committee seat (Chair, Voting, Observer, etc.) is set per committee and is separate from their project engineering role. A Systems Engineer can be a Chair on one committee and an Observer on another.

> **RACI accountability:** Every RACI subject must have at least one Accountable assignment. The matrix saves a subject with multiple Accountable assignments but flags it — aim for exactly one.

> **Preview surfaces:** The Committees & Boards, RACI / Responsibilities, and Audit Trail tabs save real records. The Approval Authority Rules and Communication Log tabs are still preview surfaces — records created there are not yet persisted.

---

## Related Pages

- [Requirements](01-requirements.md) — requirements have owners drawn from the stakeholder list
