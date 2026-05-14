# Stakeholders — Frontend Review

Scope: `frontend/src/pages/Stakeholder/StakeholderPage.tsx` (entry point, 549 lines) and the 18 components in `frontend/src/modules/stakeholders/components/`. Store (`store.ts`), types (`types.ts`), permissions helper (`permissions.ts`), and seed data (`mockData.ts`) referenced where they shape behaviour. Per the README, the load-bearing problem is structural — seven of nine tabs persist no data — so much of this file describes UX over a missing schema.

---

## 1. Page shell and tab strip

`StakeholderPage.tsx` is a single 549-line component owning page chrome (breadcrumb, search, Create dropdown, Filters), tab strip, and a small detail drawer for Directory. The shell is one of the more readable single-page components in the codebase, but three structural issues bleed into every tab below.

**Issue 1.1 — Settings tab teaches the wrong mental model.** "Roles & assignments" (live, writes `ProjectUserEngineeringRole`) and "Settings & Roles" (mock, simulation enum) sit two clicks apart in the same strip. A buyer scanning the strip cannot tell which is real. Per `.claude/project.md` "Roles terminology", this is the exact confusion to design **against**.

**Issue 1.2 — Global Create dropdown lists six flows; five produce nothing persistent.** Lines 285–346: Roles & assignments, Create Committee, Create RACI Entry, Create Approval Rule, Create Request/Action, Post Announcement. Only the first navigates to a live tab. The other five drop into mock tabs whose Save handlers dispatch to the in-memory reducer.

**Issue 1.3 — `text-blue-*` / `bg-blue-*` / `from-blue-400 to-indigo-500` are pervasive.** Per `design-system.md` §3.1 these are banned outside `status.info`. ~30 violations in this page alone (Create button `bg-blue-600`, tab indicator `border-blue-500`, role pills `bg-blue-100 dark:bg-blue-900/30`, avatar gradient, search ring, filter count chip). Tracked at cross-cutting level.

---

## 2. Directory tab (live)

`StakeholderTable.tsx` queries `getProjectUsersWithRoles(projectId)` via React Query, sorts/filters by name/email/company/status/role. The drawer renders user details, engineering-role pills, and a footer reminder that user accounts live in Admin. This is the cleanest tab.

**Issue 2.1 — Drawer ignores the project's drawer convention.** `kb/react-typescript.md` specifies `rounded-2xl` outer panel, frosted `bg-[color]/20 backdrop-blur-sm` header, sticky footer. The Stakeholders drawer is a plain `bg-white shadow-2xl border-l` panel. Other drawers (Parameter, Requirement, Task, Item, Warehouse) converged on the new pattern in the parameter-improvements branch; this one was missed.

**Issue 2.2 — Drawer shows engineering roles but cannot edit them.** A user staring at "Jane Smith — Systems Engineer, Verification Engineer" has no inline affordance to add or remove a role. The footer says "Use **Roles & assignments**", which is two clicks away from a user-first mental model. The Roles tab is role-first (pick role → assign users); the user-first flow is missing despite the backend trivially supporting it.

**Issue 2.3 — Bulk "Add to committee" is wired to a mock destination.** `AddToCommitteeModal` dispatches `ADD_MEMBER` to the reducer. The selection survives the modal but the membership does not survive a refresh. This is the most plausible-looking workflow on the page and produces nothing.

---

## 3. Roles & assignments tab (live)

`EngineeringRolesManagementTab.tsx` is role-first: lists the seeded catalog, shows assigned users per role, lets an admin add/remove users. The mutation chain is clean, React Query invalidations are correct, audit is written server-side (`stakeholder.role.assign` / `stakeholder.role.unassign`). This is the tab the rest of the module should look like.

**Issue 3.1 — `EngineeringRole.description` is fetched but not rendered.** Sixteen seeded roles list by name only. A user new to aerospace cannot tell `Configuration Manager` from `Quality Assurance`. One-line render gap closes a discoverability hole.

**Issue 3.2 — Custom non-system roles are creatable in the schema but not the UI.** `EngineeringRole.isSystem: false` is supported by the Prisma model; the seed only creates system rows. No UI to create a project-specific role (a hypothetical "Avionics Independent Reviewer"). Per `vision-and-usp.md` §2.1 the seeded catalog is the right canonical set, but a project will occasionally need a one-off role.

**Issue 3.3 — No cross-link to the modules consuming each role.** A "Verification Engineer" card would benefit from a "12 verification reviews require this role" badge that deep-links. The schema supports the join; the UI does not surface it.

---

## 4. RACI / Responsibilities tab (mock)

`RaciMatrix.tsx` (327 lines) renders matrix, by-stakeholder, and "Gaps & Risks" views over the reducer's `state.raci`. The Gaps view (entries with no Accountable or `riskFlag`) is a useful audit-grade lens — but the data underneath is mock.

**Issue 4.1 — Subjects are typed but cannot be picked from the live entity catalog.** `RaciSubjectType` is `Module | SystemElement | Deliverable` and `subjectRef` is a free-text string. A real RACI for a DO-178C programme picks the actual `SystemFunction`, `Requirement`, `CertObjective`. Today they type "FCS Mode Logic" as a string. Hard to query, validate, or detect entity rename.

**Issue 4.2 — R/A/C/I are arrays of `stakeholderId` strings — but the stakeholders themselves are mock.** `state.stakeholders` is `MOCK_STAKEHOLDERS` (`SH-0001…SH-0005`). RACI entries reference IDs that map to no live user. When promoted, R/A/C/I should be `userId` arrays joined to `User` + `ProjectUserEngineeringRole` so the matrix shows live engineering roles alongside names.

**Issue 4.3 — Gaps view has no link back to source artefacts.** "Missing Accountable on Avionics Verification" should navigate to the verification plan via the deep-link adapter chain. Today it dead-ends.

**Issue 4.4 — No DAL / criticality colour-coding on subjects.** A regulator-readable RACI should highlight DAL-A/B subjects so a missing Accountable is visibly catastrophic vs. merely concerning. Today every row renders identically.

---

## 5. Committees & Boards tab (mock)

`CommitteeTable` + `CommitteeDrawer` + `CreateCommitteeModal` + `AddToCommitteeModal`. The Committee type carries `groupId`, `name`, `type` (`CCB | ReviewBoard | AuthorityInterface | SupplierPanel | ProgramGovernance`), `members`, `chair`, `defaultReviewersFor` (`Baseline | Release | CertificationPackage | SafetyGate | VerificationReview`), `meetingCadence`. The cleanest mock taxonomy in the module.

**Issue 5.1 — `defaultReviewersFor` exists in the type but does nothing downstream.** When a Cert baseline is approved, the Cert module does not look up which Committee carries this baseline-kind and route sign-off to the chair. Bind the Committee to the Cert/Validation/CM sign-off endpoints as the default reviewer chain — closing the link `vision-and-usp.md` §8.5 expects.

**Issue 5.2 — Chair-vs-member is one role. CCB needs more.** A real CCB has Chair, Voting Members, Non-Voting Advisors, Authority Observer, Secretary, Auditor. Current shape (`chair: string`, `members: string[]`) flattens these.

**Issue 5.3 — Meeting cadence is a free-text string.** Replace with a `frequency` enum + `nextMeetingAt` so the view can render "Next CCB: Tuesday 19 May 1400 PT."

**Issue 5.4 — No Decision Log.** A CCB exists to make decisions. The drawer's bottom panel should be a chronological decision log (each row: date, artefact, outcome, vote tally, signer chain) — actual governance evidence. Nowhere in the module today.

---

## 6. Approval Authority Rules tab (mock)

`ApprovalRules.tsx` renders a rule table — Rule ID, Applies to, Condition, Approvals, Groups, 2-person, Delegation, Status — plus a "Rule builder" modal accepting free-text conditions like `DAL=A OR SafetyCritical=true`. A placeholder "Impact preview" panel hardcodes five sample rows.

**Issue 6.1 — Free-text rule conditions cannot be evaluated.** No parser, no evaluator, no schema validation. A user writing `DAL=A OR SafetyCritical=true` produces a row no service can consult at sign-off time. A working engine needs a typed AST or controlled-vocabulary template. Today the field is decorative.

**Issue 6.2 — Impact preview is hardcoded.** The five rows are a static array in the component file. The label says "(placeholder)" but sits in a panel called "Impact preview" — most users will read as live.

**Issue 6.3 — `twoPersonRule` / `delegationAllowed` are booleans, not policy primitives the signature engine consults.** Two-person rule is a constraint enforced when the second signature is attempted, not a checkbox. Delegation is a date-windowed authority transfer. Both should bind into the cross-cutting signature primitive (`gap-summary.md` #1).

**Issue 6.4 — `appliesTo` enum does not align with the five-pattern `Baseline` / `VerBaseline` / `CertBaseline` / `ParameterBaseline` / `ValidationBaseline` split.** When the unified `BaselineRoot` primitive lands (cross-cutting refactor #2), reconcile the kinds.

---

## 7. Requests & Actions tab (mock)

`RequestsBoard.tsx` renders a Kanban (Open / Accepted / InProgress / Done / Blocked / Cancelled) over `state.requests`. Each carries type (Review / Approval / Response / Info / ActionItem), priority, target, title, message, due date, linked-object.

**Issue 7.1 — The Tasks module already does this.** `tasks.routes.ts` (18 endpoints), `Task` model, board columns, assignees, due dates — all live. A "Request / Action" with target=stakeholder is a Task with assignee=user. Delete this tab and replace with a filtered Tasks view scoped to stakeholders, or — if request semantics genuinely differ — model as `Task.kind = 'STAKEHOLDER_REQUEST'` rather than a parallel entity.

**Issue 7.2 — `linkedObject: { kind, id }` reuses the polymorphic-link pattern from `IssueLink` / `TraceLink`.** When promoted, reuse `linkedEntityType` / `linkedEntityId` so the deep-link adapter chain works without a new code path.

---

## 8. Communication Log tab (mock)

`CommunicationTimeline.tsx` renders a chronological timeline. The "Export log" button shows a toast: *"Export log is a placeholder. No file is generated."*

**Issue 8.1 — "Communication" competes with every module's activity feed.** Every module already has an audit surface. A separate Communication Log only makes sense if it captures *outbound* communication (email to customer safety team, notice to suppliers). Today the entries are indistinguishable from audit rows.

**Issue 8.2 — Audience targeting is a single string ref.** `CommAudience = { type: 'Group' | 'StakeholderType' | 'All', ref: string }`. A buyer expects to send a notice to "Avionics Authority + CCB Voting Members + DERs ≥ Level 2A". Current shape supports one of those at a time.

**Issue 8.3 — No delivery channel, no read receipt, no template.** A real program-governance communication system tracks *was it delivered, did the recipient read it, what channel*. Today the timeline is a write-only blog.

---

## 9. Audit Trail tab (mock)

`AuditTrailTable.tsx` lists the reducer's `state.auditEvents` — every action taken in the current session. **The reducer resets on page reload**, so this audit trail is a per-session timeline of mock actions, not a system audit log. The real `AuditLog` (engineering-role assigns/unassigns) is invisible from this tab.

**Issue 9.1 — The page calls `AuditLog` "Audit Trail" in one place and never reads it.** This is the single biggest disconnect on the page. Move the tab to read from `AuditLog` filtered to `action LIKE 'stakeholder.%'` and the seven mock tab actions become visible the moment they are promoted to real endpoints.

**Issue 9.2 — 16-value `AuditAction` enum does not match the central `action` convention.** Central convention is `<module>:<verb>` (e.g. `validation:create`). Stakeholder writes should follow: `stakeholder:create`, `committee:add-member`, `approval-rule:disable`. Dovetails with the cross-cutting audit consolidation.

---

## 10. Settings & Roles tab (mock)

`SettingsRolesTab.tsx` is the simulation-role surface — a dropdown to pick `Admin / ProgramManager / Auditor / Engineer`, a permissions matrix, two mode toggles (`Strict Mode`, `Read-only Mode`). Per the README this is the **simulation role concept** and **must not be confused** with engineering or admin permission roles.

**Issue 10.1 — Calling this surface "Settings & Roles" causes the exact confusion the README is dedicated to preventing.** Clearer label: "Permissions preview" or "Role behaviour demo". Keeping the word "Roles" perpetuates the conflation. The disclaimer "*This only affects the Stakeholders module (client-side)*" buried in body copy should be the tab name.

**Issue 10.2 — The permissions matrix is the only place in the codebase that names the intended permission rules.** Valuable documentation. If promoted to a real `AdminRole.defaultPermissions Json` editor, this tab becomes the AdminRole template editor scoped to the stakeholder surface. As a mock it is wasted.

---

## 11. Linkage, search, role switcher

- `RoleSwitcher.tsx` exists as a separate component but does not appear to be mounted in `StakeholderPage`. Confirm dead code.
- No `frontend/src/linkage/stakeholder.ts` (or `committee.ts`, `raci.ts`, `approval-rule.ts`). When the seven mock tabs promote, the deep-link adapter pattern from `architecture.md` should land here.
- The page-level search input filters only the Directory tab. Tab-switching does not clear it, so toggling to Committees leaves an orphan search string. Scope the input per-tab or rename "Search directory" and hide on others.
