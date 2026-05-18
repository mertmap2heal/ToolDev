# Stakeholders — Tickets

Tickets grouped by urgency and dependency. Each cites a competitor capability today, a measurable problem in code, or a cross-cutting prerequisite. None propose source-code edits.

Effort: **S** ≤1 day · **M** 1–5 days · **L** 1–2 weeks · **XL** 2+ weeks.
Priority: **P0** load-bearing aerospace credibility · **P1** competitive table-stakes · **P2** opinionated-default polish · **P3** nice-to-have.

Identifiers: `STK-<Q|N|L><n>` (Q quick, N near-term, L long-term).

---

## Section A — Quick wins (≤1 sprint, low coupling)

### STK-Q1 · Fix `inventory.md` Stakeholders row attribution
**Priority:** P1 · **Effort:** S

**Problem.** `inventory.md:57` attributes `comm.routes.ts` (13 endpoints) to Stakeholders. It is the parameter `CommBus`/`CommMessage`/`CommField` surface. Models column lists `Stakeholder / Committee / ApprovalRule` as Prisma; they are TypeScript interfaces. Misleads every downstream agent.

**Cited evidence.** `backend/src/routes/comm.routes.ts:1-37` (parameter buses); `inventory-models.md:34-36` (only stakeholder-related Prisma rows); `frontend/src/modules/stakeholders/types.ts:30-122` (TS interfaces).

**Acceptance.** Stakeholders row reads `5 endpoints in projects.routes.ts; EngineeringRole + ProjectUserEngineeringRole + UserEngineeringRole live; seven aspirational TS interfaces in modules/stakeholders/types.ts; RACI/Committees/ApprovalRules/Communication/Audit/Settings tabs are reducer-driven mock`. `comm.routes.ts` row moves to Parameters domain.

---

### STK-Q2 · "Preview" banner on the seven mock tabs
**Priority:** P0 · **Effort:** S

**Problem.** A buyer clicking Create Committee or Create Approval Rule sees a working modal and successful toast — but records do not persist past refresh. Worst outcome per README priority verdict.

**Cited evidence.** `store.ts:323-337` (`initialState` seeds from mockData; no persistence); `frontend.md` §1.2.

**Acceptance.** RACI, Committees, Approval Rules, Requests, Communication, Audit, Settings tabs render a persistent banner: "**Preview — this surface is a UI mockup. Records you create here are not saved.**" `status.warning/12` bg + `status.warning` text. Create dropdown items for the five non-live actions get a "(Preview)" suffix. Banner removed per-tab as backend lands.

---

### STK-Q3 · Remove `text-blue-*` / `bg-blue-*` violations
**Priority:** P2 · **Effort:** S

**Problem.** ~30 violations of the colour ban (`design-system.md` §3.1) across page shell, tab strip, Create button, role chips, search ring, filter chip, avatar gradient.

**Cited evidence.** `frontend.md` §1.3; `design-system.md` §3.1.

**Acceptance.** Migrate to deep-forest accent (`#1B4332`) once `tailwind.config.js` tokens land. Avatar gradient → `bg-surface-raised` + monogram in `ink.primary`. No `text-blue-*` / `bg-blue-*` / `border-blue-*` / `from-blue-*` / `to-indigo-*` classes remain.

---

### STK-Q4 · Drawer convention compliance for Directory user drawer
**Priority:** P2 · **Effort:** S

**Problem.** Drawer at `StakeholderPage.tsx:421-474` uses a plain panel, missing `rounded-2xl` + frosted header + sticky footer (`kb/react-typescript.md`). Other drawers converged on the new pattern in parameter-improvements.

**Acceptance.** Outer `rounded-2xl overflow-hidden shadow-2xl flex flex-col h-full`. Header `bg-accent-primary/20 backdrop-blur-sm border-b border-accent-primary/30 px-6 py-4 flex-shrink-0`. Body scrolls; footer sticks (with role-edit affordance, see STK-Q5).

---

### STK-Q5 · Inline role-edit affordance in Directory drawer
**Priority:** P1 · **Effort:** S

**Problem.** Drawer shows engineering roles but cannot edit. User-first flow (pick user → assign role) missing despite live backend supporting it (`frontend.md` §2.2).

**Acceptance.** Drawer footer hosts "Edit roles" (admins / project owners). Click opens a multi-select listing the engineering catalog with current roles pre-checked. Save calls assign/unassign atomically; React Query invalidates `usersWithRoles` + `engineeringRoles`.

---

### STK-Q6 · Render `EngineeringRole.description` on the Roles tab
**Priority:** P2 · **Effort:** S

**Problem.** Sixteen seeded role names render with no description. A user new to aerospace cannot tell `Configuration Manager` from `Quality Assurance` (`frontend.md` §3.1). Schema and API already carry the description (`projectStakeholderRoles.controller.ts:158-163`).

**Acceptance.** Role card renders description in `ink.muted` below the name. `isSystem=true` descriptions preset via seed migration; admin can edit non-system descriptions.

---

### STK-Q7 · Centralise audit action verbs
**Priority:** P2 · **Effort:** S

**Problem.** `projectStakeholderRoles.controller.ts:337` writes `stakeholder.role.assign`; canonical convention (`validation.service.ts:188-197`) is `<module>:<kebab-verb>` — `stakeholder:role-assign`. Aligning now prevents migration cost when other tabs land.

**Acceptance.** Stakeholder writes use `stakeholder:<verb>` action strings. New `kb/audit-logging.md` documents the convention so the seven future tabs follow it from day one.

---

## Section B — Near-term (1–2 sprints, structural)

### STK-N1 · Promote Committee + CommitteeMember + CommitteeDefaultReviewer to Prisma
**Priority:** P0 · **Effort:** L
**Status:** Shipped — NX-8 / Issue [#463](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/463) / PR [#464](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/464) / merge commit `73d6de4` (code commit `34ace5e`). Migration adds `Committee`, `CommitteeMember`, `CommitteeDefaultReviewer` with the R-1 8-column provenance lattice + `deletedAt`. New `stakeholders.{routes,controller,service}.ts` trio expose project-scoped CRUD; audit writes use `committee:<verb>` / `committee-member:<verb>` / `committee-default-reviewer:<verb>` to the central `AuditLog`. The Committees tab swaps the reducer for React Query (`['committees', projectId]`); the `committeeRole` seat enum (`Chair / Voting / NonVoting / Observer / Secretary / Auditor`) replaces the flat `members[]`. No Preview banner.

**Problem.** Committees tab is load-bearing — it produces the default-reviewer chain for every baseline / release / cert package / safety gate sign-off. Today it persists nothing.

**Cited evidence.** `backend.md` §3 schema sketch; `frontend.md` §5; `vision-and-usp.md` §8.5 (sign-off chain is governance-derived).

**Acceptance.** Migration adds `Committee`, `CommitteeMember`, `CommitteeDefaultReviewer` with the universal provenance lattice and `deletedAt`. `stakeholders.routes.ts` + `stakeholders.controller.ts` + `stakeholders.service.ts` (new files) expose CRUD endpoints; audit writes use `committee:<verb>`. Tab swaps reducer reads for React Query. Per-CCB role enum (`Chair / Voting / NonVoting / Observer / Secretary / Auditor`) replaces flat `members[]`. Preview banner removed.

---

### STK-N2 · Promote RaciEntry + RaciAssignment to Prisma; bind to live entities
**Priority:** P1 · **Effort:** L
**Status:** Shipped — NX-8 / Issue [#463](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/463) / PR [#464](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/464) / merge commit `73d6de4` (code commit `34ace5e`). Migration adds `RaciEntry` + `RaciAssignment` with the polymorphic subject ref (the `TraceLink` pattern). `subjectType` is constrained to `SystemFunction | Requirement | CertObjective | Component | Deliverable`; the service resolves the subject against the live project row at write time (the four model-backed types; `Deliverable` is a free string). The R/A/C/I picker uses `usersWithRoles` and renders engineering-role chips. Doctrine validation runs service-side inside a `prisma.$transaction`: 0 Accountable -> 422, >1 -> succeeds with a `warnings[]`. The RACI tab ships the 2D `role="grid"` matrix (rows = subjects, columns = users) with arrow-key cell nav + an Enter/Space cell-editor popover.

**Problem.** RACI matrix is reducer-driven; subjects are free-text; R/A/C/I are arrays of mock IDs.

**Acceptance.** Migration adds `RaciEntry` + `RaciAssignment`, polymorphic subject ref (same pattern as `TraceLink`). `subjectType` enum constrained to `SystemFunction | Requirement | CertObjective | Component | Deliverable`; subject must resolve to a live row. R/A/C/I picker uses `usersWithRoles`; engineering-role chips render alongside each name. Doctrine validation: at least one Accountable; one preferred (warning on multiple, error on zero). 2D matrix view (`design-review.md` §2) ships as a toggle.

---

### STK-N3 · Promote ApprovalRule with typed AST and real evaluator
**Priority:** P0 · **Effort:** XL
**Status:** Backlog — deliberately split out of NX-8 (#463/#464) as **NX-8-followup-A**. NX-8 shipped the Committees + RACI + Audit-Trail core; the `ApprovalRule` AST policy engine + evaluator is XL on its own and carries its own follow-on ticket.

**Problem.** Free-text condition cannot be evaluated. Two-person and delegation are booleans, not policy primitives the signature engine consults. Impact preview hardcoded (`frontend.md` §6; `backend.md` §7; `gap-summary.md` #1).

**Acceptance.** Migration adds `ApprovalRule` + `ApprovalRuleGroup`. `conditionAst Json` carries typed expression tree; AST schema documented in `kb/approval-rule-engine.md`. Editor renders constrained-template UI (sentence with inline dropdowns, `design-review.md` §5). Evaluator in `stakeholders.service.ts` exported as `evaluateRulesFor(action)`. Validation/Cert/CM sign-off endpoints call it before writing signature. Conflict detection. "Try this rule" simulator replaces hardcoded Impact Preview.

---

### STK-N4 · Promote CommunicationEvent to Prisma; split from audit trail
**Priority:** P2 · **Effort:** M
**Status:** Backlog — deliberately split out of NX-8 (#463/#464) as **NX-8-followup-B**. NX-8 shipped the Committees + RACI + Audit-Trail core; the `CommunicationEvent` model + Communication-Log surface carries its own follow-on ticket.

**Problem.** Log conflates outbound notices with audit observations; export is placeholder (`frontend.md` §8; `design-review.md` §4).

**Acceptance.** Migration adds `CommunicationEvent` with multi-recipient picker (committees / roles / individuals), delivery channel, delivery status, read-receipt count. Audit Trail tab decoupled (STK-N5). PDF export via corporate-DOCX template pipeline produces signed notice manifest.

---

### STK-N5 · Wire Audit Trail tab to central `AuditLog`
**Priority:** P1 · **Effort:** S
**Status:** Shipped — NX-8 / Issue [#463](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/463) / PR [#464](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/464) / merge commit `73d6de4` (code commit `34ace5e`). The shared `GET /projects/:projectId/audit-logs` endpoint was extended with an optional `modules=` action-prefix filter (matches `<token>:` and the legacy `<token>.` form) + pagination; the no-param path stays byte-identical for back-compat. The Audit Trail tab queries it via React Query and renders the new `committee:*` / `raci:*` rows; the `modules=` filter is a chip multi-select. The mock `AuditEvent` / `AuditAction` enum / `auditEvents` state / `nextEventId` / `appendAudit` were deleted from `store.ts` and `MOCK_AUDIT_EVENTS` from `mockData.ts`. (The endpoint is `audit-logs`, not the `audit` the original AC sketched.)

**Problem.** Audit Trail reads from mock reducer. Real `AuditLog` rows (engineering-role assigns/unassigns plus future governance writes) are invisible (`frontend.md` §9).

**Acceptance.** Backend endpoint `GET /projects/:projectId/audit?modules=stakeholder,committee,raci,approval-rule,comm-event` paginated. Tab queries it; renders summary copy per action verb via template lookup. Mock `AuditEvent`, `auditEvents` state, `nextEventId`, `appendAudit`, 16-value `AuditAction` enum deleted from `store.ts`. Date-range and actor filters per `ActivityPage` pattern.

---

### STK-N6 · Fold Requests & Actions into Tasks
**Priority:** P2 · **Effort:** M

**Problem.** Requests Board duplicates the Tasks module (`frontend.md` §7).

**Acceptance.** Add `kind` enum to `Task` (`STANDARD | STAKEHOLDER_REQUEST | ACTION_ITEM`) defaulting `STANDARD`. Requests tab becomes a filtered view of `/projects/:projectId/tasks?kind=STAKEHOLDER_REQUEST`, embedding the Tasks board with filter/group settings. "Send to Tasks" affordance from Stakeholders Create menu opens Task create modal with `kind` preselected. Mock `Request`, `RequestComment` removed.

---

### STK-N7 · Rename or delete Settings & Roles tab
**Priority:** P1 · **Effort:** S

**Problem.** "Settings & Roles" is the simulation-role surface; the name causes the confusion the README dedicates to preventing (`frontend.md` §10).

**Acceptance.** Pick one:
- **A — Rename "Permissions preview"**, keep as documentation surface with clearer disclaimer.
- **B — Promote to `AdminRole` template editor**: the matrix becomes editor for `AdminRole.defaultPermissions Json`, tab moves to `/admin/roles`.
- **C — Delete the tab**; document permission rules in `kb/permissions.md`.

Recommended: **C** until the permissions surface itself is real. Until then the page is decorative.

---

## Section C — Long-term / cross-cutting

### STK-L1 · Universal provenance lattice on Stakeholders governance tables
**Priority:** P0 · **Effort:** L

**Problem.** Per `gap-summary.md` #5, every cert-relevant table carries the eight-column lattice. Once Committee, RaciEntry, ApprovalRule, CommunicationEvent are real, they must join.

**Acceptance.** All five new tables carry `authorType`, `authorAiModel`, `authorAiVersion`, `authorAiPromptId`, `authorAiContextHash`, `classification`, `reviewStatus`, `reviewerUserId`, `reviewTimestamp`. Additive migrations; existing rows default `authorType='human'`, `reviewStatus='reviewed'`. AI-touched governance changes (e.g. AI drafts a default RACI) carry AI provenance so the surface renders an "AI-suggested — needs human review" badge.

---

### STK-L2 · EngineeringRole expansion for CCB roles (refines cross-cutting refactor #5)
**Priority:** P0 · **Effort:** M

**Problem.** Per `configuration-management.md` KB the CM module needs six role concepts (`ConfigManager`, `SystemEngineer`, `VerificationEngineer`, `SafetyEngineer`, `CCBMember`, `Auditor`). `gap-summary.md` cross-cutting refactor #5 calls these "AdminRole templates" — but the use case (*who can chair a CCB?*) is a discipline question. Correct primitive is `EngineeringRole`, not `AdminRole`.

**Acceptance.** Add `CCBMember` to `PREDEFINED_ROLES` in `projectStakeholderRoles.controller.ts:5-22` (the other five already exist or have near-equivalents). Seed-migration script `backend/src/scripts/seedEngineeringRoles.ts` replaces lazy in-controller seeding. CM module's CCB workflow consults `ProjectUserEngineeringRole` with `roleId = (lookup CCBMember)` to derive eligible voters. Reword `gap-summary.md` refactor #5 to clarify primitive is `EngineeringRole`.

---

### STK-L3 · Engineering-role enforcement on every sign-off endpoint
**Priority:** P0 · **Effort:** L

**Problem.** `ValidationSignOff.signerRoleLabel` is free text. `CertSignOff` does not consult engineering-role. `RequirementReview` signers carry no discipline. Every sign-off endpoint is "any project member with admin permission can sign" — not "this person holds the role this sign-off requires" (`backend.md` §4–§5; `vision-and-usp.md` §8.5).

**Acceptance.** New middleware `requireEngineeringRole(roleNames: string[])`. Resolves `req.params.projectId`, looks up `EngineeringRole.id`s, checks `ProjectUserEngineeringRole`. `CertObjective` gets `requiredEngineeringRoleId String?`; sign-off endpoint applies middleware when set. `ValidationSignOff.signerRoleLabel` deprecated (read-only with `(legacy)` badge); new sign-offs require middleware-validated role and write `signerEngineeringRoleId`. `RequirementReviewer` gains `requiredEngineeringRoleId`. Existing rows not enforced retroactively. Audit records both `signerUserId` and `signerEngineeringRoleId`.

---

### STK-L4 · Audit consolidation (cross-cutting refactor #6)
**Priority:** P1 · **Effort:** XL (cross-package)

**Problem.** Eleven audit tables today per `inventory.md`. Stakeholders is on the right side — using central `AuditLog`. Don't add a 12th.

**Acceptance.** New `kb/audit-logging.md` documents `<module>:<kebab-verb>` convention and `writeAudit(projectId, userId, action, detailsJson)` signature. `AuditLog.details String?` → `Json` (additive). All new Stakeholders writes use central `AuditLog` day one. Cross-package follow-ups sequence the other ten audit tables; Stakeholders is the canonical example to point at.

---

### STK-L5 · Cross-module deep-link adapters
**Priority:** P1 · **Effort:** S

**Problem.** `frontend/src/linkage/` has 18 entity adapters; none for stakeholder / committee / raci / approval-rule. Other modules hard-code URLs (`architecture.md` "Deep-link system").

**Acceptance.** Add `frontend/src/linkage/{stakeholder,committee,raci,approval-rule}.ts` modelled on existing adapters; register with `buildDeepLink.ts`. Cert's "approved by Avionics CCB" badge links via `buildDeepLink({ type: 'committee', id, projectId })`. Audit Trail rows referencing a RACI change link to the row.

---

### STK-L6 · Owner-on-every-requirement integration
**Priority:** P0 · **Effort:** L (cross-package)

**Problem.** `vision-and-usp.md` §10 is unambiguous: every requirement is **born with an owner**. Today the picker is per-page and free-form; Stakeholders is the natural source.

**Acceptance.** Shared `<OwnerPicker projectId requiredRoleNames={['Requirements Engineer','Systems Engineer']} />` in `frontend/src/components/common/`. Fed by `ProjectUserEngineeringRole` joined to `User`; required-role list configurable per artefact type. Requirements / Verification test cases / Validation items / Hazards / CRs / ConfigItems consume the same picker. Acceptance: creating a new requirement picks an owner only from users holding Req Eng or Sys Eng role on this project. No free text. No accidental delegation to someone without the discipline.

---

## Cross-cutting append (for `_shared/cross-cutting.md`)

Five entries appended to `cross-cutting.md` already:

1. **Three role vocabularies must be named in API and UI copy** — Reserve `EngineeringRole` for discipline; `AdminRole` for module-permission templates; delete the simulation enum. New `requireEngineeringRole(...)` middleware is the single chokepoint.
2. **Cross-cutting refactor #5 is EngineeringRole, not AdminRole** — Refines seed #5 and the CM refinement. `CCBMember` is the only genuinely new role; the other five already exist in `PREDEFINED_ROLES`.
3. **`inventory.md` Stakeholders row mis-attributes `comm.routes.ts`** — Corrected per STK-Q1.
4. **Stakeholders is the second positive cross-cut for central `AuditLog`** — Standardise on `<module>:<kebab-verb>` (colon then kebab). Document in `kb/audit-logging.md`.
5. **Owner-on-every-artefact requires shared `<OwnerPicker>` fed by EngineeringRole** — Tracks STK-L6; closes the same architectural gap as the sign-off engineering-role enforcement, surfaced at create time.

---

## Section D — Deliberate omissions

Considered and dropped. Tracked so the next reviewer does not surface them.

1. **`Stakeholder` as a separate Prisma model.** User + roles + memberships is the entity. Duplicating creates a sync trap.
2. **`Delegation` table.** `ApprovalRule.delegationAllowed` + sign-off "on behalf of" suffices v1.
3. **Stakeholder `Discipline` enum as a separate field.** This is `EngineeringRole.name` renamed.
4. **Mobile-grade UX for Stakeholders.** Out of scope first 18 months per `vision-and-usp.md` §9.
5. **External-stakeholder portal (customer / supplier / regulator self-service).** Different security perimeter; defer.
6. **CCB voting widget with real-time presence.** Quorum indicator is sufficient; live voting is future synchronous-collaboration work.
7. **Calendar integration for committee meeting cadence.** Out of scope; `nextMeetingAt` on the row is enough.
8. **Slack / Teams integration for Communication Log channels.** Webhook scaffold exists; UI work deferred until customers ask.
