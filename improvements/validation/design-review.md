# Validation — Design Review

This file critiques the Validation package's UX surfaces against `design-system.md` and against the analogous flows in the named competitors (Jama Connect Review Center, Polarion configurable workflow signing, Codebeamer Review Hub, IBM DOORS Next baseline signing). Three sections:

1. **DER-style printable surfaces** — what Validation ships, what an aerospace DER actually needs, and what competitors offer for the same job.
2. **Sign-off chains** — the multi-actor signature flow, today vs. target.
3. **Baseline + diff** — the workflow doctrine §8.3 ("one-click baseline and package") test.

Every recommendation cites either a competitor capability that exists today or a measurable gap (broken trace, missing evidence, signature without reauthentication) per the constraint.

---

## 1. DER-style printable surfaces

### 1.1 Why this matters more in this package than anywhere else

The DER (Designated Engineering Representative, FAA Order 8100.8D) is an external party — not a project member — who reviews a programme's compliance evidence and issues findings of compliance on the FAA's behalf. The DER's review motion is:

1. Read the PSAC (Plan for Software Aspects of Certification).
2. Walk the compliance matrix — objective by objective, DAL by DAL.
3. For each objective, demand the evidence: which requirement, which test result, which validation activity, which sign-off chain.
4. Issue findings (positive, with conditions, or negative).
5. Sign the findings letter that goes into the certification package.

A DER cannot do this in the live application. They need a **printable, signed, watermarked artefact** that is timestamped and matches the engineering team's baseline. Today's `DERView` (`frontend/src/pages/Validation/DERView.tsx`, 299 lines) is the right surface — read-only, milestone-grouped, with three export buttons — but it falls short on four DER-grade attributes.

### 1.2 What today's DERView ships

- Read-only milestone-grouped table (Key / Title / Method / Status / Criteria / Sign-offs).
- Coverage summary tiles (Items / Validated / Requirements covered / Blocked / Suspect).
- Three export buttons: Browser print (`window.print()`), Markdown download (`/report.md`), PDF download (`/report.pdf` via pdfkit).
- Print stylesheet hides toolbar controls, resets dark-mode background to white, drops link text-decoration.

### 1.3 What an aerospace DER needs the printout to contain

Per FAA Order 8110.4C ("Type Certification") and FAA Order 8110.49A ("Software Approval Guidelines") the DER's evidence package must contain on every page:

| Element | Today's DERView | Jama Coverage Report | Polarion LiveReport | Codebeamer Coverage Browser |
|---|---|---|---|---|
| Document title + version (e.g. "Validation Evidence Pack v1.0") | **Missing** | Configurable in Velocity template | Wiki page header | Header widget |
| Programme name + project ID + baseline ID + generation date on every page | **Missing** | Yes via Velocity | Yes via wiki | Yes via widget |
| Page X of Y footer | **Missing** | Yes (Word output) | Yes | Yes |
| DAL annotation on every artefact | **Missing** | Yes (item field) | Yes (custom field) | Yes (custom field) |
| Objective code (DO-178C Table A-N.N) annotation | **Missing** | Configurable | Configurable | Configurable |
| Sign-off attribution per artefact (signer name + role + timestamp + meaning string) | **Partial — count only** | Yes (Part 11) | Yes (workflow signature) | Yes |
| Watermark on draft / unapproved artefacts ("DRAFT — NOT FOR CERTIFICATION USE") | **Missing** | Yes (configurable) | Yes (config) | Yes |
| Broken trace / evidence-gap red flag inline | **Partial — Suspect tile shown but not inline per artefact** | Yes (Live Traceability suspect) | Yes | Yes |
| Cryptographic chain-of-custody hash | **Missing** | No — competitor gap | No — competitor gap | No — competitor gap |
| QR/signature block for wet-ink countersign | **Missing** | Configurable | Configurable | Configurable |

The **competitor gap (no chain-of-custody hash)** is the opening — every named ALM ships a configurable template engine that requires the customer to author their own PSAC-shaped output. None of them ship a regulator-grade printout out of the box with a cryptographic fingerprint. That is the `vision-and-usp.md` §8.3 "audit package as a command, not a project" claim, expressed for one entity type.

### 1.4 Concrete UX recommendations (no source-code changes here — these are design directives for `tickets.md`)

1. **Add a `@page { size: A4; margin: 22mm 16mm 22mm 16mm; }` print rule** and a `@media print` running-header block that surfaces the programme name, project ID, and baseline ID. Cost: small CSS change. Cited adversary: Jama, Polarion, Codebeamer all do this in templates today.
2. **Add a stamped header strip** — generated date, baseline ID (or "Live state — not baselined"), DAL summary ("Items: 14 (DAL A: 5, B: 7, C: 2)"), authoring user. The data exists in the API; the UI does not surface it. Adversary: Polarion's LiveDashboards always show the project key in a header.
3. **Render the sign-off chain inline per row, not as a count.** A DER cannot pre-check a programme by counting sign-offs — they need to know *who* signed, *what role*, *when*. Today's "Sign-offs: 1" with a green check is data-loss compared to Jama's signer-name-and-role per row.
4. **Add a watermark when the project has any `suspect` items, any `BLOCKED` items, or any items without sign-offs at the printout's milestone.** "DRAFT — N SUSPECT / M BLOCKED / K UNSIGNED" diagonally across the page. Adversary: Polarion's draft watermark, Codebeamer's status banner.
5. **Add an "Open as printable" view link, separate from the in-app DERView.** Today `window.print()` on the in-app view is the only path; the print stylesheet is bolted on. A dedicated `/projects/:projectId/validation/print` route with `<MainLayout>` stripped would render the artefact at full page width with header / footer / page numbering rather than as a printed re-flow of the SPA. Adversary: this is how Jama, Polarion, and DOORS Next all handle audit prints.

### 1.5 What `vision-and-usp.md` §8.5 and §9.3 require

Quoting §8.5: "*A dedicated read-only view that presents the project the way a Designated Engineering Representative needs to see it for findings-of-compliance: objective-indexed, artefact-linked, sign-off-visible. No edit controls. No distractions. One export button that produces the DER's report template. This alone removes a week from most aerospace programmes' final certification prep.*"

Today's DERView is **milestone-indexed**, not objective-indexed. The pivot from milestone-grouping (PDR, CDR, FAT, SAT, EIS, OTHER) to objective-grouping (DO-178C A-1.1, A-1.2, ARP4754A 5.4.1, etc.) is the load-bearing transformation. It requires either:

- A `ValidationItem.objectiveCodes` field — multi-valued — populated either manually or auto-derived from the linked requirement's objective code, OR
- A separate `ValidationObjectiveLink` polymorphic table (consistent with `TraceLink`) that maps validation items to certification objectives.

Either path is a schema change. Until then the DER pre-check view is at best a "milestone readiness" board — useful, but not what `vision-and-usp.md` §8.5 commits to.

---

## 2. Sign-off chains

### 2.1 Today's flow

```
[User in EXECUTED state]
       │
       ▼
[Drawer → "Sign off" button] ─────────────────────►  Hidden if user is the item creator
       │
       ▼
[Drawer expands inline form]
  - Role label (free text)
  - Comment (markdown editor)
  - Confirm sign-off (green button)
       │
       ▼
[POST /sign-off]
  - Server checks signer !== creator
  - Server checks status === EXECUTED
  - Creates ValidationSignOff row
  - Promotes item to VALIDATED
       │
       ▼
[Drawer refreshes; new row appears under Sign-offs]
```

Revocation is symmetric: a project member clicks the revoke icon on an active sign-off, confirms via `confirmDialog`, and the server creates a supersession row, marks the prior row as `supersededById`, and demotes the item back to `EXECUTED` if no active sign-offs remain.

### 2.2 What competitors offer for the same job

**Jama Review Center.** Multi-participant review with configurable roles (Reviewers, Approvers, Moderator). Each participant has a row in the participant list. The approver sees an "Approve" / "Reject" / "Request changes" choice. On Approve, the system prompts for **reauthentication (user ID + password)**, applies the system-level signature meaning string ("I approve this review" — configurable but immutable per audit policy), and binds the signature to the **immutable baseline** that was auto-created when the review launched. The signature is cryptographically associated with the baseline ID and signer identity. Status: gold standard for ALM Part 11.

**Polarion configurable workflow signing.** Every Work Item type and LiveDoc has a configurable workflow. Administrators define states, transitions, guard conditions, and per-transition signature policies. A workflow transition (e.g. "Mark Approved") can be blocked until invited reviewers have all electronically signed. **Different stages can require different signer sets** — peer review → lead approval → quality gate. The signer reauthenticates per signing event. Signatures are bound to a stored audit record (signer identity, date/time, document revision).

**Codebeamer Review Hub UI 3.2.** Centralised review queue. Bulk approval/rejection. Visual diff highlighting between baseline and current. **E-signature collection** with FDA 21 CFR Part 11 compatibility — reauthentication, signature meaning string, signed-by-role enforcement.

**DOORS Next baseline signing.** Module-level "Baseline" operation with electronic signature. Signature is bound to the baseline's frozen revision. Different baseline types (Functional, Allocated, Product, Release per IEEE 828 — see `kb/configuration-management.md`) have different signer-set policies.

### 2.3 The gap, in concrete terms

| Capability | This package | Jama | Polarion | Codebeamer | DOORS |
|---|---|---|---|---|---|
| Multi-stage signer chain (different signers per stage) | **No — single sign-off action** | Yes | Yes | Yes | Yes |
| Reauthentication at sign | **No** | Yes | Yes | Yes | Yes |
| Signature bound to baseline | **No — bound to item** | Yes | Yes | Yes | Yes |
| Signed meaning string (audit-immutable) | **No — free-text comment** | Yes (system setting) | Yes (configurable per transition) | Yes | Yes |
| Append-only signature record | **Yes (via `supersededById`)** | Yes | Yes | Yes | Yes |
| Author-can't-sign-own-work | **Yes — service-level** | Yes (review config) | Yes (workflow config) | Yes | Yes |
| Role-based authority enforcement (signer must hold X engineering role) | **No — system role exists but not enforced** | Yes | Yes | Yes | Yes |

### 2.4 Recommended sign-off UX changes

These map to `tickets.md` near-term:

1. **Reauthentication modal at sign-off.** A second modal layered on the inline form requesting the user's password before the POST `/sign-off` fires. Server-side: a paired endpoint `/auth/reauth` issues a short-lived (60s) `reauth_token`; the sign-off endpoint requires it in headers and verifies before creating the row. Pattern: Jama Review Center.
2. **Signature meaning string from a controlled vocabulary.** Replace free-text `signerRoleLabel` with a project-configurable list of allowed role labels (default: "Customer Operations Lead", "Test Witness", "Validation Approver", "DER Reviewer"). The list comes from the engineering-role catalogue via `engineeringRole.findMany({ projectId })`. Selection is required. Free text is rejected. Adversary: every competitor.
3. **Multi-stage signer chain.** A `ValidationSignOffPolicy` table per item type or per milestone declares an ordered list of required signer roles. The state machine reads it: `EXECUTED` → `PENDING_STAGE_1` → ... → `PENDING_STAGE_N` → `VALIDATED`. Each stage requires a signer holding the configured role. This is the Polarion model; matches how aerospace teams handle peer review → lead approval → DER. Cost: schema add + service refactor + UI flow rebuild. Not for first ticket; queued in long-term.
4. **Bind the sign-off to the baseline that was auto-created when the sign-off chain started.** When the first signer in a chain begins, the system creates a frozen baseline of the item's state. Subsequent edits to the item before the chain completes are rejected. Adversary: Jama Review Center auto-baseline-on-review-start.
5. **Enforce the `Validation Approver` engineering role at sign-off time.** Today the role is upserted but unchecked. Add a server-side check: signer must hold the role in `ProjectUserEngineeringRole` for this project. Reject 403 otherwise. Quick win.

---

## 3. Baseline + diff

### 3.1 Today's flow

```
[ValidationPage → More → "Baseline this state…"]
       │
       ▼
[Prompt dialog: "Baseline label"]
       │
       ▼
[POST /baselines  →  ValidationBaseline row with snapshot=JSON]
       │
       ▼
[BaselinesPage row list, click any row]
       │
       ▼
[Drawer opens — shows snapshot table + diff vs current state]
       │
       ▼
[<Trash2> icon deletes any baseline by any project member]  ← problem
```

### 3.2 Workflow doctrine §8.3 — "one-click baseline and package"

Quoting `design-system.md` §8.3: "*Two buttons on every project: 'Baseline this state' and 'Build certification package'. Both are idempotent. Both record a full audit trail. Neither requires a wizard.*"

Today's baseline is **one click** (More → Baseline this state… → name → done). That side of the doctrine is satisfied for this entity. The "Build certification package" side is **not** — there is no `Build validation evidence pack` button that bundles the current baseline, the export PDF, the export Markdown, the activity log subset, and the sign-off chain into one zip. Adversary: every competitor ships export bundles via Word/Velocity templates, but the customer must configure them.

### 3.3 What competitors offer for analogous flows

| Capability | This package | Jama | Polarion | Codebeamer |
|---|---|---|---|---|
| Named baseline | Yes | Yes | Yes (Document Baseline) | Yes (Stream Baseline) |
| Auto-baseline on sign-off chain start | **No** | Yes (Review Center) | Yes (workflow) | Yes |
| Baseline diff vs current | Yes (client-side) | Yes | Yes (paragraph-level) | Yes |
| Baseline diff vs baseline | **No** | Yes | Yes | Yes |
| E-signature on baseline | **No** | Yes (Part 11) | Yes | Yes |
| Lock baseline against deletion | **No — any member can delete** | Yes | Yes (workflow-gated) | Yes |
| Branch from a baseline for parallel work | **No** | Yes (Reuse + Sync) | Yes (Live-Branch) | Yes (Streams) |

### 3.4 Recommended baseline UX changes

These map to `tickets.md`:

1. **Remove the delete affordance on every baseline row in `BaselinesPage`.** A baseline is a certification anchor. Replace `<Trash2>` with `<Archive>`; require `requireProjectOwnerOrAdmin` server-side for archive; preserve the snapshot row with a `deletedAt` field. Bound by `gap-summary.md` cross-cutting #2.
2. **Baseline-vs-baseline diff in `BaselinesPage`.** Today the drawer compares baseline N vs live state. Add a "Compare with…" dropdown in the drawer header that lets the user pick baseline M and renders the diff. Cost: small front-end change, server-side already returns full snapshots. Adversary: every competitor.
3. **Auto-baseline on first sign-off.** When the first signature in a chain is applied, the server snapshots the validation item state as a `ValidationBaseline` with label `"Auto: pre-signoff @ {ts}"` and records `signOff.baselineId = autoBaseline.id`. The item cannot be edited until either the chain completes (sign-off applied to baseline) or the chain is abandoned (auto-baseline marked superseded). Adversary: Jama Review Center.
4. **Cryptographic content hash on baseline creation.** Compute a SHA-256 of the canonicalised snapshot JSON. Store on `ValidationBaseline.contentHash`. Include the hash in every export (DERView print header, Markdown report, PDF report). This is the chain-of-custody artefact regulators sometimes ask for ("how do I know the printed PSAC is from the baseline I signed?"). No competitor ships this — opening per `gap-summary.md` §3.
5. **"Build validation evidence pack" button next to "Baseline this state".** One click → zip download of: the baseline JSON, the Markdown report, the PDF report, the activity log for the baseline window, and a manifest JSON. Adversary: every competitor's Velocity/BIRT/Document Builder workflow, where the customer authors the template. Our claim: opinionated default, ready to ship.

---

## 4. Coverage UI — best-in-class with one tactical change

The coverage strip on `ValidationPage` is already closer to `design-system.md` §8.2 ("objective view is the home view") than any other module in the codebase. The four tiles (Validation items / Requirements covered / Validated / Without validation) plus the per-status chip row plus the suspect chip render the project's state at-a-glance without a separate report.

**One tactical change:** the "Without validation" tile launches a modal listing uncovered requirements. The modal lets the user create a `ValidationItem` from any selected requirement. **This is the bidirectional close of the loop** — the loop being requirement → validation → evidence → sign-off → baseline → export. Today the loop is one-way for new validations; the modal makes it two-way for backfilling.

Competitor comparison: Jama's Coverage Report tells you which requirements are uncovered but does not let you create a Test Case from the report inline. The Validation module's pattern (uncovered → modal → click → create) is more opinionated. Document and propagate.

---

## 5. Activity feed — design-system compliant, two gaps

The `ActivityPage` is design-system compliant in colour, type, spacing, and motion. Two design gaps:

1. **The raw JSON `details` field rendered as text** (per `frontend.md` §4) is a UX miss. Each action type should have a one-line summary template: `"Created VAL-014: 'Pilots can complete approach within 2 minutes' (DEMONSTRATION, FAT)"`, `"Signed off VAL-014 as Customer Operations Lead"`, `"Baselined 14 items as 'PDR snapshot 2026-05-15'"`, etc. Per `design-system.md` §5.4 ("Errors quote the exact error and offer a named action") — the analogous principle here is "activity rows name the artefact and the action concretely, not abstractly."
2. **No date / range filter.** Adding a date-picker chip alongside the action and user dropdowns is one ticket and brings the feed in line with Jama's Activity Stream, Polarion's History View, and Codebeamer's Audit Trail. Out-of-box value.

---

## 6. Settings page — design-system mixed-mode

`ValidationSettingsPage` is the one page that **mixes** the validation-v2 CSS variable pattern with raw Tailwind dark-mode classes. The tag palette pulled the design-system tokens correctly; the rest of the page uses `rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900` style classes that pre-date the design system token migration.

The page also uses blue text accent for "Add prefix" / "Add tag" / "Add template" links (`text-blue-600 hover:text-blue-700`). `design-system.md` §3.1: "No `blue-500`. No `indigo-600`. The accent is deep forest and nothing else." Quick visual fix.

---

## 7. Summary — design verdict

The Validation package's UX is the **second-most-polished module in the codebase** by `design-system.md` conformance after Parameters. The main page (`ValidationPage`) is keyboard-first, opinionated, and at-a-glance, with patterns the rest of the app should adopt (saved views, inline ambiguity check, milestone burndown, coverage strip with uncovered-requirements bidirectional launcher).

The DER view is **the skeleton of what `vision-and-usp.md` §8.5 requires** — read-only, milestone-grouped, exportable — but is missing the four DER-grade attributes (running header, sign-off-per-row, watermark, objective indexing) that make it regulator-shippable.

The sign-off chain is the **strongest aerospace-credibility gap in the module**, mostly because the schema-level append-only-with-supersession primitive is correct but the runtime is missing reauthentication, role-enforced authority, signed meaning string, baseline binding, and multi-stage flow.

The baseline diff works for one entity (ValidationItem) and is closer to Jama/Polarion/Codebeamer than the rest of the codebase. The delete-by-any-member affordance is the one design defect that needs to be removed quickly.

The activity feed and coverage UI both lead the rest of the codebase on design-system compliance. The settings page lags and should be brought up to the rest of the module's standard.
