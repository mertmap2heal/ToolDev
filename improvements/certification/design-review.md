# Certification — Design Review

This document reviews the UX of the five core surfaces — Compliance Matrix, MoC, Evidence Index, Findings & Actions, and the one-command Authority Package — against the design-system mandate and what incumbents ship. Anchored in `design-system.md` (especially §6 component philosophy, §8 workflow doctrine) and the competitor profiles in `improvements/_shared/`.

## 1. The Objective-Completion Matrix — the missing default landing

Status today: does not exist. The default landing is Overview, a six-card KPI strip. Per `design-system.md` §8.2 it must be the objective completion matrix.

**The reference surface:** Jama Coverage Report, Codebeamer Compliance Engineer dashboard, Polarion Multilevel Traceability widget. All three render a 2-D table — objectives on one axis, applicability (DAL or FDAL) on the other — with per-cell satisfaction colouring. None of the three are particularly clean visual designs; Polarion's is widely cited as "older and confusing" (per `competitor-polarion.md` Strengths/Weaknesses). The opportunity is to ship the same primitive with a modern, opinionated layout.

### 1.1 Proposed shape

A sticky-header virtualised table. Per-cell drill-down via right-edge drawer.

```
                         DAL A    DAL B    DAL C    DAL D    DAL E
A-1 Software Planning    7/7  ✔   7/7  ✔   7/7  ✔   7/7  ✔   —
   (independence needed
    on objectives 1-4)   AAAA     AAAA     ----     ----     —

A-2 Software Development 6/7  ✗   7/7  ✔   7/7  ✔   7/7  ✔   —
                                  AAAA     ----     ----

A-3 Verification SR      4/7  ✗   3/3  ✔   not applicable for this project
A-4 Verification Design  9/13 ✗   ...
A-5 Coding & Integration 7/9  ✗
A-6 Testing Integration  3/5  ✗
A-7 Verification of Ver. 6/9  ✗
A-8 Configuration Mgmt   6/6  ✔
A-9 Quality Assurance    5/5  ✔
A-10 Cert Liaison        3/3  ✔
─────────────────────────────────────────────────────────────────
Overall                  56/71      (DAL A coverage)
```

Each cell is clickable. The right-edge drawer shows the objectives in that (table, DAL) combination, each row with: objective ID, title, linked requirements count, linked verification activities count, linked evidence count, sign-off state. Click an objective → the full Objective drawer (already built) with requirement / verification / evidence pickers.

The colour coding:
- Green tick: all objectives in cell satisfied with required independence
- Yellow partial: some objectives open or in partial state
- Red cross: required objective unsatisfied for this DAL
- Grey em-dash: not applicable at this DAL

This is **exactly** the table that becomes the PSAC Section 11 ("Software Accomplishment Summary") body. Producing it as the landing view means the PSAC export is the screen the user is already looking at — the demo moment in §3.5 below.

### 1.2 Why this beats Jama's Coverage Report

Jama renders the same data as an HTML / Word / Excel export only. There is no live in-app screen that is the matrix. Customers run the Coverage Report on demand. Our advantage is making it the **always-current default screen**. Per `competitor-jama.md` Dimension 8: "The most-cited UX complaints in 2026 reviews are: noticeable navigation lag in large projects, dated visual styling versus modern SaaS, and a search experience that feels weak next to modern AI-enabled search."

### 1.3 Anti-pattern to avoid: a configurable matrix

Do not ship a "configure your matrix columns" wizard. Per `design-system.md` §8.2: "the objective catalogue *is* the project." The matrix is opinionated for the standard. DO-178C ships an A-1 through A-10 matrix. DO-254 ships an Appendix B matrix. ARP4754A ships an FDAL × objective matrix. The user does not choose what the matrix looks like; the standard chooses for them.

## 2. Compliance Matrix tab — keep, but reframe

The existing Compliance Matrix tab is the **second-best** rendering of the matrix data after the Objective-Completion Matrix. It pivots by regulation reference (`CS 25.1309`, `CS 25.1301`, etc.). This is the right pivot for **airworthiness regulations** (CS-25, CS-23, SC-VTOL). It is the *wrong* pivot for software (DO-178C uses tables, not paragraph refs) and hardware (DO-254 uses objectives, not paragraphs).

**Recommendation.** Rename "Compliance Matrix" to "Regulation Coverage". Keep it as a secondary view (third tab, not second). The objective-completion matrix is the primary view; the regulation coverage view answers "for CS-25.1309, what objectives have we satisfied and with what evidence?"

The drill-down drawer is well-built. Surface the existing PDF/XLSX export buttons in the same place. No structural change needed inside the tab; only repositioning.

## 3. MoC (Method of Compliance) UX — make the dropdown standard-aware

Today the MoC field is a single 6-item union (`Test / Analysis / Inspection / Similarity / Simulation / Review`) applied uniformly across all objectives. This is wrong for three reasons:

1. **DO-178C objectives do not name a MoC.** They name an output (Software Verification Cases and Procedures, Software Verification Results) and demand a process. The MoC concept does not exist there. Showing "Test" as MoC for `OBJ-DO178C-A6-1` ("Test cases are developed") is meaningless.
2. **DO-254 uses MoC1 through MoC8** (per Appendix B of DO-254). Our column does not capture that vocabulary.
3. **ARP4754A** uses "process" — not MoC at all. The MoC vocabulary is a CS-25 / FAR 25 / military hardware-spec concept that we have applied uniformly because the schema is one column.

### 3.1 Proposed shape

Each seeded objective declares its allowed MoC values. The UI dropdown filters to that subset.

```ts
// Seed JSON for an objective
{
  objectiveId: "DO-178C-A6-1",
  standard: "DO-178C",
  table: "A-6",
  rowIndex: 1,
  title: "Test cases are developed",
  applicability: {
    A: { output: "required", independence: "required" },
    B: { output: "required", independence: "required" },
    C: { output: "required", independence: "not_required" },
    D: { output: "required", independence: "not_required" },
    E: { output: "not_applicable" }
  },
  validMocValues: [],   // empty array: DO-178C objectives do not have MoC
  references: ["RTCA DO-178C §6.4.2.1"]
}

{
  objectiveId: "CS-25.1309-failure-conditions",
  standard: "CS-25",
  title: "Failure condition probability per cross-system assessment",
  validMocValues: ["Analysis", "Test", "Similarity"],   // not Inspection/Demonstration
  references: ["EASA CS 25.1309"]
}
```

The Objective detail drawer dropdown reads `validMocValues` from the seeded objective row. If empty, the MoC field is hidden entirely. If non-empty, only those values appear in the dropdown. This makes `vision-and-usp.md` §8.2 anti-proof — "The MoC dropdown is filtered to those valid for the DAL" — actually enforceable.

### 3.2 Comparison

| Tool | MoC vocabulary | Per-objective filter |
|---|---|---|
| Codebeamer DO-178C template kit | Per-tracker config | Yes, via Tracker workflow |
| Jama Airborne Systems | Custom field | No |
| Polarion | Custom field on Work Item | Configurable via workflow guards |
| DOORS Next | Custom attribute | Configurable via DXL |
| **Us** | One flat 6-item union | No |
| **Us (target)** | Per-seeded-objective subset | Yes, server-enforced |

## 4. Evidence Index UX — the "Attach Evidence" workflow gap

The Evidence Index tab today is a read-only table over `VerEvidence`. The user cannot upload evidence from this tab. The user cannot link existing evidence to an objective from this tab. They can only browse and filter.

**The demo-blocking workflow:** an aerospace engineer reviewing an objective sees "0 evidence linked" and wants to attach a test report PDF. Today they leave the certification page, navigate to Verification → Evidence, upload the file, navigate back, open the Objective drawer, and pick the evidence in the link picker.

**The proposed workflow** (per `ai-ready-vision.md` §7.4 evidence ingestion pipeline):

1. From the Objective drawer, click **Attach Evidence**.
2. Modal opens: drag-and-drop file, plus a "select from existing" tab.
3. On drop, the file uploads to the verification evidence pipeline.
4. The AI parser classifies the file (test report / analysis / inspection / review / measurement log) per the §7.4 pipeline. Confidence per field is shown.
5. The parser proposes the link "this evidence satisfies objective X" with confidence score.
6. The user accepts the proposed link (one keystroke) or edits it.
7. Evidence is now linked to the objective; `linkedEvidenceCount` increments; the matrix cell colour updates.

This is the **evidence-at-creation** USP per `vision-and-usp.md` §8.2. None of the four named ALM competitors ships this with native parser integration; Codebeamer and Jama require manual evidence-to-requirement linking after upload. Per `competitor-codebeamer.md` Dimension 5, Codebeamer adds a Jenkins plugin for automated test result ingestion — but only for results, not arbitrary evidence files.

### 4.1 Visual treatment

Per `design-system.md` §2.4 (Progressive disclosure — one decision per screen): the attach-evidence modal is **three screens**:

1. Upload — single drop zone, file format hints
2. Classify + Extract — show the AI-proposed classification, extracted fields, proposed link to the current objective. Human accepts each per-field with a single click (or edits).
3. Confirm — final state shown; one button: "Attach to objective X-Y-Z".

This is the same pattern as the Parameter import wizard. Reuse the wizard primitive (`frontend/src/components/parameters/ImportParameterModal.tsx`) and its three-step state.

## 5. Findings & Actions — unify with Issues, soften the divergence

The Findings tab today renders `CertFinding` rows. Severity (Minor / Major / Observation), status (Open / InProgress / Closed / Deferred), assignedTo, dueDate. The detail drawer is clean.

Two design issues:

**(a) The vocabulary is inconsistent with the Issues module.** Issues use a different severity vocabulary (Critical / High / Medium / Low) and a different status vocabulary (Open / In Progress / Resolved / Closed). An aerospace finding *is* an issue — it tracks remediation work the engineering team must do to satisfy an objective. Splitting it into a separate noun creates duplicate effort: the same finding shows up as a `CertFinding` row and (often) a parallel Jira ticket.

**(b) The link picker for `linkedObjectives` is a multi-select dropdown of objective IDs.** This is technically functional but visually poor at scale. The right shape is the same pattern Jama uses in its Coverage Report: the user starts typing and sees a search-as-you-type list with the objective ID + title + status badge.

### 5.1 Proposed shape

Findings become a typed Issue under the hood. The `CertFinding` table either becomes a view over `Issue` (filtered to `Issue.kind = 'certification_finding'`) or — more pragmatically — a `CertFinding` row is created **alongside** an `Issue` row, with FK linkage. The certification page renders the certification-finding-typed issues; the Issues module renders all issues.

This is one of the cross-cutting wins: the finding appears in **two surfaces** that are both real and both audit-grade, without duplicate data entry.

### 5.2 Anti-pattern to avoid

Do not let Findings have arbitrary attachments separate from Issue attachments. Today both modules support `uploadedFiles[]`. Unify them.

## 6. The One-Command Authority Package surface — the demo moment

This is the load-bearing UI moment in `vision-and-usp.md` §8.3 ("audit package as a command") and **the** USP we cannot fake in a demo. The current "Certification Package" tab is one big blue button + four side-by-side download shortcuts. It is a placeholder.

### 6.1 The reference surface

Per `competitor-codebeamer.md` Dimension 6: Codebeamer's DO-178C template kit ships a Compliance Engineer dashboard with named outputs (PSAC, SDP, SVP, SCMP, SQAP) as separate buttons, each calling a per-document Velocity / .docx template merge. The customer fills in the per-objective evidence rows; the template materialises a Word doc with merge fields.

Per `competitor-jama.md` Dimension 6: Jama's exports are HTML / Word / Excel via Office Templates. The Coverage Report is the closest single artefact to a PSAC; the rest is "build your own template."

Per `competitor-doors.md` (line 38 of the competitor profile): DOORS Next exports via JRS Report Builder + Document Builder. Both are templated; both require the customer to wire the template against the data once. After that, the template re-runs cleanly each baseline.

Per `competitor-polarion.md`: Wiki-based LiveReport. The customer composes the report once in Wiki syntax; subsequent runs re-materialise it.

**Our anti-proof per `vision-and-usp.md` §8.3:** "no build your own export template wizard. Opinionated outputs only." The user does not configure the PSAC. They click "Generate PSAC" and get the regulator-shaped PSAC for their current standard + DAL.

### 6.2 Proposed shape

The Certification Package tab becomes the **Authority Package screen**. Top section:

```
┌─────────────────────────────────────────────────────────────────┐
│ Current state — DAL-A DO-178C programme                          │
│                                                                  │
│ Objectives satisfied: 56 / 71      Independence: 22 / 23         │
│ Evidence linked:       143         Sign-offs:    12 / 23 pending │
│ Open Major findings:   2  ⚠                                      │
│                                                                  │
│ Baseline: BL-2026-04-CDR     Frozen: 2026-04-17 by Alice K.      │
└─────────────────────────────────────────────────────────────────┘
```

Below that, a **vertical list of artefacts**, one row per regulator-required deliverable:

```
┌─ PSAC — Plan for Software Aspects of Certification ─────────────┐
│ Last generated: 2026-04-20 14:02 from BL-2026-04-CDR             │
│                                                                  │
│ Sections complete: 11 / 11  ✔                                    │
│ Outstanding gaps: none                                            │
│                                                                  │
│ [Generate PDF + DOCX + JSON manifest]   [Preview]   [History]    │
└──────────────────────────────────────────────────────────────────┘

┌─ SDP — Software Development Plan ────────────────────────────────┐
│ ...
└──────────────────────────────────────────────────────────────────┘

┌─ SVP — Software Verification Plan ───────────────────────────────┐
┌─ SCMP — Software Configuration Management Plan ──────────────────┐
┌─ SQAP — Software Quality Assurance Plan ─────────────────────────┐
┌─ SAS — Software Accomplishment Summary ──────────────────────────┐
┌─ SCI — Software Configuration Index ─────────────────────────────┐
┌─ SECI — Software Environment Configuration Index ────────────────┐
```

A **Generate Full Package** button at the bottom does all of the above in one click — produces a ZIP containing every artefact + a `manifest.json` signed by the project owner.

### 6.3 Anti-pattern to avoid

Do not offer "configure which sections appear in the PSAC." The PSAC has a regulator-mandated table of contents (RTCA DO-178C §11.1.1). Our composer renders that ToC. The customer is offered the option to add a project-specific appendix at the end, but the body is opinionated.

### 6.4 Preview surface

Click **Preview** on any row → a side-by-side reader. Left pane shows the live rendered DOCX in HTML. Right pane shows the JSON manifest with per-section evidence hashes. The Preview is read-only and always reflects current state — not the last-generated state. Generating commits the current state to a versioned artefact.

### 6.5 History surface

Click **History** → a small drawer listing past generations of this artefact:

```
2026-04-20 14:02  PSAC-rev3.docx  9.2 MB  by Alice K.  [Download] [View diff]
2026-04-12 09:18  PSAC-rev2.docx  8.7 MB  by Bob M.    [Download] [View diff]
2026-03-04 11:30  PSAC-rev1.docx  7.4 MB  by Alice K.  [Download] [View diff]
```

Diff between two versions opens a structured diff (added objectives, changed sign-offs, modified requirements) — not a raw Word doc diff. This is the **`vision-and-usp.md` §8.5 DER view applied to the PSAC**: the auditor sees what changed between two regulator submissions in structured form.

## 7. Settings & Roles — surface the simulation truth

The current settings tab lets the user switch role (Certification Manager / Compliance Engineer / etc.), enable strict-audit mode, and enable read-only mode. None of these settings hit the backend; they are pure client UI simulators.

Per `frontend.md` §4.7, the design issue: a buyer demoing the product can switch roles and think they have changed their effective permissions. Two fixes:

1. **Add a small `(simulation — local only)` label** next to the role chooser. Same pattern as the Stakeholders module's "simulation role" per the `.claude/project.md` "Roles terminology" section.
2. **Hide the chooser** outside of dev mode unless the user has an `admin.certificationDemoRole` permission. In production, the role is server-derived from the user's `ProjectMember.engineeringRole`.

## 8. Per-tab summary against `design-system.md` principles

| Tab | §2.1 Audit-passing defaults | §2.2 Evidence at creation | §2.3 Standard in context | §2.4 One decision per screen | §2.5 Write once, trace automatically | Overall grade |
|---|---|---|---|---|---|---|
| Overview | ✗ (gate #1 hardcoded) | ✗ (no upload here) | ✓ (KPI cards reference DAL) | ✓ | n/a | C |
| Compliance Matrix | ✓ | ✗ | ✓ | ✓ | ✗ (client writes aggregates) | C+ |
| Objectives & MoC | ✗ (MoC vocab not scoped) | ✗ | ✗ (single union MoC) | ✓ | ✓ (objective ↔ requirement link) | C |
| Evidence Index | n/a | ✗ (read-only — biggest gap) | ✓ | ✓ | ✗ | D |
| Findings & Actions | ✓ | n/a | ✓ | ✓ | ✗ (separate from Issues) | B- |
| Certification Package | ✗ (no PSAC) | n/a | ✗ (no regulator shape) | ✓ | ✗ | D |
| Review Log | ✓ | n/a | ✓ | ✓ | ✗ | B- |
| Certification Plan | ✓ (CertPlan exists) | n/a | ✓ | ✓ | n/a | B |
| Checklists & Sign-offs | ✓ (password reauth) | n/a | ✓ (per-phase) | ✓ | ✓ (binds to checklist) | A- |
| Authority | ✓ (correspondence log) | n/a | ✓ | ✓ | ✓ (links to objectives + findings) | B |
| Settings & Roles | ✗ (simulation surface) | n/a | n/a | ✓ | n/a | C- |

The cleanest tab is Checklists & Sign-offs, anchored on the strongest signature primitive on the page. The most embarrassing tab is Certification Package — the very tab that is supposed to be the brand promise.

## 9. Accessibility check

Per `design-system.md` §9: WCAG 2.1 AA, 4.5:1 contrast, visible focus rings, real `<label>` per form field, `aria-label` on icon-only buttons.

Audit findings on inspection of `CertificationPage.tsx` and the tab files:

- **Tab strip** uses `role` implicit via `<button>` — no `aria-pressed` on the active tab. Add it.
- **Actions dropdown** is a click-toggle; missing `aria-expanded` and `aria-haspopup`. Add both.
- **Pagination controls** in Compliance Matrix tab use `disabled` correctly; pagination position number is announced via the surrounding `<span>` text which is accessible.
- **Status badges** (Complete / Partial / Open / Blocked) use colour but also include the status text — no colour-only encoding.
- **Bulk-action checkboxes** in Findings & Actions table use real `<input type="checkbox">` with adjacent `<label>` — passes.
- **Modal close buttons** in `CreateFindingModal` and `PackageWizardModal` need verification — quick sample shows they use `<button>` with `<X />` icon but no `aria-label`. Fix.

None of these are blocking accessibility violations. They are polish items for the launch.

## 10. Smallest visual wins (no engineering tickets needed)

These are tweaks to existing components, not new builds:

1. **Activity feed timestamps as relative** — show "3 hours ago" instead of `2026-04-17T14:22:11.123Z` everywhere. There is already a `date-fns` import.
2. **Drop the "Configuration Index" placeholder button** from the Certification Package tab. Per `gap-summary.md` Call-out C, ship-not-fake.
3. **Sticky context selector bar** — `ContextSelectorCard` should stick to the top of the scroll viewport when scrolling tabs that go below the fold. One-line CSS change.
4. **Severity badges** in Findings tab — distinguish Major / Minor / Observation by colour weight, not size. Today they are similar widths and similar colours.
5. **Sign-off chips** in the Checklists tab — when a sign-off is pending vs signed vs delegated, the chip background should reflect the state. Today all three look identical.

Each of these is 30 minutes or less.

## 11. Cross-references

- Frontend implementation review: [`frontend.md`](frontend.md)
- Backend route + schema review: [`backend.md`](backend.md)
- Concrete tickets: [`tickets.md`](tickets.md)
- Cross-cutting findings (signature primitive, baseline primitive, audit log unification): [`../_shared/cross-cutting.md`](../_shared/cross-cutting.md)
- The competitor profiles cited: [`competitor-codebeamer.md`](../_shared/competitor-codebeamer.md), [`competitor-jama.md`](../_shared/competitor-jama.md), [`competitor-polarion.md`](../_shared/competitor-polarion.md), [`competitor-doors.md`](../_shared/competitor-doors.md)
