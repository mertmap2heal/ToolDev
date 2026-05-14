# Stakeholders — Package Review

## 1. Purpose

The Stakeholders package answers *"who is accountable, consulted, and informed when a certification artefact moves?"* — the human side of the certification graph the rest of the modules persist (Requirements owners, Verification reviewers, Cert sign-off chains, CM CCB decisions). It is also where the **three role vocabularies** of the application meet, get confused, and need to be named with precision before any other improvement is sound. Per `.claude/project.md` "Roles terminology":

| Concept | Persistence | UI surface | What it represents |
|---|---|---|---|
| **Engineering / discipline roles** | `EngineeringRole` + `ProjectUserEngineeringRole` (live Prisma) | `Stakeholders → Roles & assignments`, Directory drawer | Project-scoped assignment to the engineering catalog (`Systems Engineer`, `Verification Engineer`, `Safety Engineer`, `Configuration Manager`, …). The **canonical source** for the lifecycle "allowed roles" gate and the only field a Cert / Validation / CM sign-off should consult to decide *is this person authorised to sign?* |
| **Admin permission roles** | `AdminRole` + `UserAdminRole` (live Prisma) | `/admin/roles` (outside Stakeholders) | RBAC templates with `defaultPermissions Json`. Decides whether a user can call a module's write endpoints. Does **not** carry discipline semantics. |
| **Stakeholder "simulation" role** | None (client-side reducer state) | `Stakeholders → Settings & Roles` | Four-value enum (`Admin / ProgramManager / Auditor / Engineer`) used only inside the Stakeholders reducer to demo the permissions matrix to a prospect. **Not stored on any User.** Toggling it has no server effect. |

Auditors and customers conflate these constantly. The README's job is to make the distinction the first thing anyone reads about the module — every entry below names which of the three is in scope before describing any change.

## 2. Current state — one-third real, two-thirds reducer-driven mock

| Dimension | Count | Note |
|---|---:|---|
| Frontend tabs | 9 | Directory, Roles & assignments, RACI, Committees, Approval Rules, Requests, Communication, Audit, Settings |
| Page component | 1 — `StakeholderPage.tsx` | 549 lines, three role vocabularies on screen |
| Module-local components | 18 | Under `frontend/src/modules/stakeholders/components/` |
| Module-local Prisma models | **0** | `Stakeholder`, `Committee`, `ApprovalRule`, `RaciEntry`, `Request`, `CommunicationLogEntry`, `AuditEvent` are **TypeScript interfaces in `modules/stakeholders/types.ts`**, persisted only in the client-side `useReducer`, seeded from `mockData.ts` |
| Backend route file dedicated to stakeholder governance | **0** | The inventory.md row that names `comm.routes.ts` (13 endpoints) is **mis-attributed** — `comm.routes.ts` is parameter `CommBus`/`CommMessage`/`CommField` (CAN/ARINC buses), not stakeholder communications |
| Live backend endpoints reachable from the Stakeholders page | **5** | All inside `projects.routes.ts`, served by `projectStakeholderRoles.controller.ts`: list-roles, list-users-with-roles, my-roles, assign, unassign |
| Prisma audit table touched on engineering-role write | 1 — central `AuditLog` | Correct — the same pattern Validation uses (`cross-cutting.md` positive cross-cut) |

Two of nine tabs (Directory, Roles & assignments) are wired to the live backend. The other seven (RACI, Committees, Approval Rules, Requests, Communication, Audit, Settings) read and write the in-memory reducer. A user who creates a committee, approval rule, RACI entry, or communication event today produces **no server state, no audit row, and no record after a browser refresh**. The page is an engineering-role assignment console *plus* a UX mockup of seven aspirational tabs.

The Settings tab compounds the confusion: it contains a "Role simulation" dropdown that switches the client-only `StakeholderRole` enum and a permissions matrix that explains the *intended* permission model for the not-yet-built tabs. To a buyer in a demo this looks like a configurable RBAC system; in the codebase it is a stub.

## 3. Target state — governance as canonical "who signed what"

Per `vision-and-usp.md` §10 ("a requirement is born with **an owner**…") and the cross-cutting gaps:

1. **`EngineeringRole` becomes the only role primitive sign-off code consults.** The Cert / Validation / CM "is this signer authorised?" check compares `ProjectUserEngineeringRole`, not user names, not `ValidationSignOff.signerRoleLabel` free text, not the simulation enum. Cross-cutting refactor #5 (`gap-summary.md`) seeds `ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor` as `EngineeringRole` rows — and Validation/Cert sign-off endpoints require holders of the relevant role.
2. **Real persistence for governance.** Promote the seven mock tabs to Prisma: `Committee`, `CommitteeMember`, `RaciEntry`, `ApprovalRule`, `ApprovalRuleGroup`, `CommunicationEvent`. Each gets the universal provenance lattice from day one. No `Stakeholder` table (User + ProjectUserEngineeringRole + CommitteeMember already cover it); no `StakeholderRequest` (use `Task.kind`).
3. **Owner provenance on every requirement, test case, validation item, hazard, CR.** §10 of vision is unambiguous: every requirement is **born with an owner**. Stakeholders is where that owner is picked, so the picker is a shared component fed by `ProjectUserEngineeringRole`.
4. **Audit consolidation.** Every governance action writes to central `AuditLog` — the same pattern Validation already uses (`cross-cutting.md` positive #1). No `StakeholderAuditEvent` table. The mock `AuditAction` enum becomes a controlled-vocabulary list of `AuditLog.action` strings.

## 4. Priority verdict

**P0 for governance honesty; P1 for the tabs themselves.** Seven of nine tabs persist nothing. A buyer who clicks through the demo and asks "where do these RACI entries live?" gets no good answer. Before any polish, the page either ships the missing Prisma models or surfaces a clear "Preview" banner on the seven mock tabs. Two of nine tabs that work plus seven that look like they work is the worst outcome — it sets a buyer expectation the schema cannot meet.

The cross-cutting work — engineering-role enforcement on every sign-off endpoint, CCB role seeding, central `AuditLog` for governance — is high leverage. It closes the lateral edges Stakeholders → Certification / Validation / CM / Requirements in one batch.

**Most surprising finding.** `inventory.md` attributes `comm.routes.ts` (13 endpoints) to this package as "Stakeholders backend." It is not — `comm.routes.ts` is the parameter communication-bus surface (CAN, ARINC-429) for the Parameters module. The actual backend reachable from the Stakeholders page is five endpoints under `projects.routes.ts`. The aggregate stats in `inventory.md` therefore overstate Stakeholders' backend by eight endpoints, and the picture is cleaner than it looks: Stakeholders already follows the positive central-AuditLog pattern.

## 5. Read this with

- `frontend.md` — tab-by-tab UX critique, three-role clarity, RACI / committee / communication / approval-rule UX.
- `backend.md` — five real endpoints today, the eight-table promotion plan, AdminRole / EngineeringRole separation in API, integration points with Cert sign-offs and CM CCB roles.
- `design-review.md` — RACI matrix display, committee membership management, communication timeline, approval-rule visualisation; the competitor opening (no ALM ships an opinionated stakeholder module).
- `tickets.md` — quick wins / near-term / long-term, with provenance on governance tables, AdminRole→EngineeringRole reframing for CCB roles, engineering-role enforcement on sign-offs, audit consolidation.
- `_shared/cross-cutting.md` — the appended Stakeholders findings on three-role naming, CCB-role primitive, inventory-attribution fix, central-AuditLog pattern, shared OwnerPicker.
