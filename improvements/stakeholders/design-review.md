# Stakeholders — Design Review

Scope: visual design, IA, and competitor-relative positioning for four governance surfaces (RACI matrix, committee management, communication timeline, approval-rule visualisation) plus the three live ones (directory, roles & assignments, audit). Read alongside `frontend.md` (UX critique) and `backend.md` (the schema this design depends on).

The competitor baseline is **mostly empty**. None of Jama, Polarion, Codebeamer, DOORS Next, Jira+Xray ship an opinionated stakeholder governance module — they model "stakeholder" as a flavour of user with permissions and a tag, and leave RACI / committee / CCB workflows to custom fields, Confluence pages, or workflow apps. The opening is to ship the **only certification-native stakeholder governance surface in the category** — one that binds program governance to artefact sign-off rather than treating them as separate worlds.

---

## 1. North-star alignment

Per `design-system.md` §1 — *"every screen must directly advance the certification package"*:

| Tab | Certification artefact | Verdict |
|---|---|---|
| Directory | Engineering-role assignments — canonical source for sign-off authorisation downstream | Indirect but load-bearing. **Keep.** |
| Roles & assignments | `ProjectUserEngineeringRole` rows consulted by every sign-off endpoint | Direct. **Keep.** |
| RACI | Bound to `SystemFunction` / `Requirement` / `CertObjective`; the Accountable identity signs the upstream review | Direct once schema lands. **Keep.** |
| Committees | Default-reviewer chain for baselines / releases / cert packages / safety gates | Direct once integration lands. **Keep.** |
| Approval Rules | Defines *who must sign* and *how many*. The engine the sign-off endpoint consults | Direct. **Keep.** |
| Requests | Maps to the Tasks module. Per `frontend.md` §7, deduplicate | **Cut** — fold into Tasks |
| Communication | Outbound notice log. Marginal certification evidence | Reduce scope. Keep as light artefact |
| Audit Trail | Surface of `AuditLog`. Always certification evidence | **Keep** |
| Settings & Roles | Permissions matrix demo. No artefact | **Cut or rename** — repurpose or delete |

Net: nine tabs become seven; two (Requests, Settings) are absorbed into existing primitives.

---

## 2. RACI matrix display

Current `RaciMatrix.tsx` is a six-column long table: Subject, Type, Responsible, Accountable, Consulted, Informed. Three views — matrix, by-stakeholder, gaps & risks. IA is correct; rendering is generic.

**Reference patterns.** No ALM competitor ships a native RACI matrix; primes keep RACI in Confluence/Word linked to saved-view exports. Outside ALM, Smartsheet/Lucidchart render the 2D form: rows = subjects, columns = stakeholders, cells = single letters with colour.

**Recommendation: ship the 2D form.**

```
                  J.Smith   B.Wilson   A.Chen   ...
FCS Mode Logic      A         R          C
Avionics Stack      C         I          A
Propulsion EICAS    I         A          R
```

Cells colour-coded — `accent.primary/12` for A (load-bearing), `border.strong` for R, `ink.muted` for C, `ink.faint` for I.

**Per-DAL colour band on the subject row.** DAL-A → 4px left border in `status.danger/30`; DAL-B → `status.warning/30`; DAL-C → `status.info/30`; DAL-D → `border.default`. Visually surfaces "is the Accountable missing on the highest-DAL function?" — the question the Gaps view today answers by enumeration.

**Drill-down on cell click.** `(FCS Mode Logic, J.Smith)` opens a side drawer listing every requirement/function/objective J.Smith is Accountable for on that subject, with deep-links.

**Validation.** Refuse to save a subject with no Accountable (RACI doctrine: zero As is a gap, more than one A is "two Accountables means none"). Toast on save; red badge otherwise. Consistent with `vision-and-usp.md` §10 "refuses to save malformed" pattern.

---

## 3. Committee membership management

Current surface is functional but generic. A CCB is not a Slack channel.

**Reference patterns.** No competitor ships a CCB-aware UI. Codebeamer's Review Hub supports per-stage reviewer chains (3.2) but per-workflow, not as standing committees.

**Recommendation: committee card with role-grid, not flat member list.**

```
┌──────────────────────────────────────────────────────────────────┐
│ Avionics CCB                                          [CCB]      │
│ Bi-weekly · Tue 1400 PT · Next: Tue 19 May 2026                  │
├──────────────────────────────────────────────────────────────────┤
│ Chair                Voting (4)              Non-voting (2)      │
│ ┌─────────────────┐  ┌─────────┐ ┌─────────┐ ┌─────────┐         │
│ │ J. Smith        │  │ B. Wil  │ │ A. Chen │ │ DER     │         │
│ │ Systems Eng.    │  │ Safety  │ │ V&V     │ │ Observer│         │
│ │ ★ Quorum: yes   │  │ ...     │ │ ...     │ │ ...     │         │
│ └─────────────────┘  └─────────┘ └─────────┘ └─────────┘         │
├──────────────────────────────────────────────────────────────────┤
│ Default reviewer for:                                            │
│ • CertBaseline (PSAC, SAS)                                       │
│ • CmBaseline                                                     │
│ • SafetyGate                                                     │
├──────────────────────────────────────────────────────────────────┤
│ Recent decisions (last 30 days):                                 │
│ 12 May · CR-014 (Approved 4-0)                                   │
│ 05 May · BL-2026-04 Baseline (Approved 3-1)                      │
│ 28 Apr · Deviation D-002 (Returned for analysis)                 │
└──────────────────────────────────────────────────────────────────┘
```

Answers the four chair questions on opening the view: who is on this committee, what are they responsible for, are we quorate today, what did we decide last time. The current drawer answers question 1 only.

**Quorum indicator.** Quorate when ≥`quorumCount` voting members have accepted and are not on leave. "Quorum: 4/6 — quorate." If `< quorumCount`, indicator is red; next-meeting banner reads "**Quorum risk — recruit reviewers**". Evidence-producing UX per `design-system.md` §1.

**Decision log surface inside the drawer.** Chronological list of every CCB decision sourced from `AuditLog` filtered to `committee:decision` + `approval-rule:trigger`. Each row: date, artefact, outcome, voter chain, signer chain.

---

## 4. Communication timeline UX

Today the timeline is a vertical list of `CommunicationLogEntry` rows. No filtering beyond type checkboxes. Export is placeholder.

**Reference patterns.** Jama Activity Stream is per-item, filterable; Polarion History View is per-Work-Item; Codebeamer Audit Trail is a CSV-exportable table. None ship a *project-wide outbound communication* surface.

**Recommendation: distinguish outbound communication from audit observation.**

- **Communication Log** = outbound notices the program office has sent. Each row binds to a delivery channel (email / Teams / Slack / banner), recipient list, delivery status (sent / delivered / read by N/M). A regulator can subpoena ("show every notice you sent suppliers about Deviation D-002").
- **Audit Trail** = inbound observation of what happened in the system, sourced from `AuditLog`. Already covered by the Audit tab.

The Communication Log gains delivery-channel column, read-receipt indicator, recipient-count badge. Export becomes real — PDF rendering via the corporate-DOCX template pipeline.

**Audience picker.** Replace `(audienceKind, audienceRef)` with a multi-select picker: a notice can target multiple committees, roles, and individuals at once. Selection renders as pill stack ("Avionics CCB · DER · Verification Engineers — 14 recipients").

**Linked-artefact preview.** Today linked objects open a placeholder modal. Use `buildDeepLink({ type, id, projectId })`. When the link is a `ChangeRequest`, hovering shows the CR title and status.

---

## 5. Approval-rule visualisation

Per `frontend.md` §6 the conditions are unevaluatable; per `backend.md` §7 they need a typed AST.

**Reference patterns.** No ALM competitor ships a visual approval-rule builder. Workflow apps (ServiceNow, Jira Workflow) offer graph editors; both are notoriously complex. AWS IAM policy simulator is the closest "evaluate this rule against this artefact" pattern in widespread use.

**Recommendation: rule editor as a constrained template, not free text.** A rule is three nouns:

```
When [appliesTo: CertPackage],
  if [field: project.dal] [op: ≥] [value: B],
  require [N=2] approvals from [Role: CCBMember],
  with [✓ Two-person rule, ✗ Delegation allowed].
```

Render as a sentence with dropdowns inline for each variable, not as a table row + modal. The modal is wrong because the user reads the rule as English; the table forces them to decode the row.

**Per-rule simulator panel.** Below each rule, a "Try this rule" panel lets the user pick a current artefact and see whether the rule blocks or allows. Replaces the static "Impact preview" placeholder. Backed by the AST evaluator.

**Rule conflict detection.** Two rules that both apply to `CertPackage` on DAL-A with different `requiredApprovals` conflict. Surface a warning chip ("**Conflicts with RULE-003** — the stricter is enforced").

**Audit row on every enable/disable.** Today the buttons exist but the central `AuditLog` is not written. When status flips, write `approval-rule:enable` / `approval-rule:disable` with rule id, reason field (required), and 60-second reauth token under strict mode.

---

## 6. Brand-token migration

Per `design-system.md` §3.1 the page violates the colour ban across every tab. Page-by-page replacement:

| Today | Replace with |
|---|---|
| `bg-blue-600 hover:bg-blue-700` (primary) | `bg-[#1B4332] hover:bg-[#2D5A3D]` |
| `text-blue-600 dark:text-blue-400` (active tab) | `text-[#1B4332] dark:text-[#4A9065]` |
| `border-blue-500` (tab indicator) | `border-[#1B4332] dark:border-[#4A9065]` |
| `bg-blue-100 text-blue-800` (role chip) | `bg-[#1B4332]/12 text-[#1B4332]` |
| `from-blue-400 to-indigo-500` (avatar) | Solid `bg-surface-raised` + monogram in `ink.primary` |
| `focus:ring-blue-500` | `focus:ring-[#1B4332]` |

Tracked at cross-cutting level, not per-tab.

---

## 7. Empty states

Once the seven mock tabs hit a real database, the empty states matter. Each needs an opinionated state per `design-system.md` aesthetics:

- **Committees empty.** "Define your first review board." Sub: "A CCB, Safety Review Board, or Authority Interface Group routes baseline approvals through named members. Start with the CCB — table-stakes governance for any DO-178C programme." CTA: "Create CCB".
- **RACI empty.** "Map who is accountable, responsible, consulted, informed." Sub: "Pick a system function or deliverable, assign the four letters. The matrix becomes the audit-trail backbone for every sign-off downstream." CTA: "Create RACI entry".
- **Approval Rules empty.** "Define when a sign-off needs more than one approver." Sub: "A typical DO-178C DAL-A rule requires two CCB approvals with two-person rule. Start from a template." CTA: "Use DO-178C DAL-A template" / "Build from scratch".
- **Communication Log empty.** "No notices posted." Sub: "When you post an announcement, review request, or decision, it appears here as part of the program's audit trail."

Each opinionated empty state is itself certification evidence — the absence is the gap; the presence is the artefact.

---

## 8. Information architecture: tab ordering

Today: Directory · Roles & assignments · RACI · Committees · Approval Rules · Requests · Communication · Audit · Settings.

User mental model — "who is on this programme, what discipline, what bodies do they sit on, what authority, what have they done lately" — suggests:

**Directory · Roles & assignments · Committees · RACI · Approval Rules · Communication · Audit**

Drop Requests (folded into Tasks). Drop Settings (folded into AdminRole template editor or hidden). Strip shrinks 9 → 7 and reads as "people → discipline → group → responsibility → policy → notice → audit" — the order a regulator walks a programme.

---

## 9. Summary — competitive opening

No ALM competitor ships a first-class stakeholder governance module. The gap is buyer-visible: every aerospace small team keeps RACI in Confluence, committees in Outlook, approval rules in Word. The opening is the **only certification-native stakeholder governance surface in the category**, with:

1. Engineering-role assignment as canonical sign-off authorisation across all modules.
2. Committee-bound baseline default-reviewer chains (no more free-association sign-offs).
3. Typed approval rules with a real evaluator engine.
4. RACI 2D matrix with DAL colour-banding and per-cell drill-down.
5. Communication log as outbound notices with delivery + read receipts.
6. Audit consolidated into central `AuditLog`.

The depth of these surfaces is modest — not the full enterprise GRC tooling Workday or ServiceNow ships. But the **integration with the certification graph** — committee → baseline → signature → objective evidence — is the bind no competitor has. The demo moment that closes a procurement: *every sign-off in your programme is bound to a governance row, bound to a real engineering role, bound to a real user. Nothing is free-text. Nothing is unauditable.*
