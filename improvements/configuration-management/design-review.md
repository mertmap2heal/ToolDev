# Configuration Management — Design Review

Per-flow critique of the CCB workflow, CI lifecycle visual, baseline freeze ceremony, deviation/waiver review, and `Project.strictMode` UX. References Codebeamer Streams, Polarion Document Baselines + Workflow, DOORS Next Configurations, Jama Review Center. Anchored in `design-system.md` (north star: "every screen must directly advance the certification package") and `kb/configuration-management.md` (IEEE 828 / ISO 10007 / CCB role catalogue).

---

## 1. The CCB workflow — eight clicks where there should be one ceremony

### 1.1 The current click path

A user submitting a change request to the CCB and seeing it approved goes through:

1. Open Configuration Management page.
2. Open the "Create" dropdown.
3. Click "Create Change Request."
4. Fill the form (title, priority, status="Proposed", impactedCIs[] multiselect, safety impact checkbox, CCB level dropdown, justification).
5. Submit. Status: Proposed.
6. Navigate to the Changes (CCB) tab.
7. Open the CR detail drawer.
8. Approve the CR (manually transitions status: Proposed → Approved). One single click.
9. Open the same drawer again and click "Apply Version Updates" — this triggers `APPLY_CR_VERSIONS` and bumps every impacted CI's semver/revision.

Two consecutive disclosure modals (Create dropdown → Create modal) plus two consecutive in-drawer actions (Approve → Apply Versions) split what is, in IEEE 828 §6.3 language, **one ceremony**: the CCB holds a board, votes, signs the decision, and the CIs change version. Per `design-system.md` §2.4 ("Progressive disclosure. One decision per screen.") and §2.5 ("Write once, trace automatically"), the version-bump should be the consequence of the approval, not a separate manual step.

### 1.2 Codebeamer comparison

Codebeamer's CCB pattern (per `competitor-codebeamer.md` "Workflow engine" section): a tracker workflow transition (`Submit-to-CCB → Approve`) **fires post-transition actions** declared in the workflow XML — including automatic version increment on linked items. The user clicks one button; the system handles the propagation. This is the "opinionated workflow" pattern `vision-and-usp.md` §10 commits to: workflow as a state machine declared per certification standard, not as a configurable per-tenant snowflake.

### 1.3 Recommended pattern

A single "Approve CR" action in the drawer that:

1. Opens a CFR-21-Part-11-style **signature confirmation modal** with reauthentication (password re-entry per the universal `/auth/reauth` primitive flagged in validation tickets V-N1 + the gap-summary #1 e-signature work).
2. On successful reauth, transactionally:
   - Records the `CcbDecision` row (vote, ccbLevel, safetyImpact, signer chain).
   - Bumps every impacted `ConfigItem` version/revision.
   - Sets each impacted CI's `lockState = 'FrozenByBaseline'` if the CR closes against a baseline.
   - Writes a single `cm:cr-approve` audit log entry covering all three.
3. Returns the user to the CR drawer with the decision visibly recorded and the impacted-CI list rendered with new versions.

One screen, one decision, one signature event, one audit row — `design-system.md` §1 "every action is a deposit into the audit package."

The current tab's "Apply Version Updates" button (which is the second click) is an anti-pattern: it exposes the propagation as a separate user action, which means a CCB chair can approve a CR and forget to apply the versions, leaving the CIs at their pre-decision version but the CR marked Approved. That mismatch is exactly the certification-audit failure mode the module exists to prevent.

---

## 2. The CI lifecycle visual — text status pills where there should be a state diagram

### 2.1 Current state

The Configuration Items tab renders each CI's `status` as a colored pill (`getCIStatusColor` in `constants.ts:72-85`): grey for Draft, blue for InReview, green for Released, red for Obsolete. The `lockState` is rendered as plain text in the detail drawer (`CIDetailDrawer.tsx:129`). The CI version history is rendered as a table inside the drawer (`CIDetailDrawer.tsx:151-178`).

This is the right shape for a list view, but the wrong shape for the detail drawer. A CI's lifecycle is a state graph (`Draft → InReview → Released → Obsolete`, with `lockState` as an orthogonal attribute) plus a linear version chain plus the baselines that reference each version. None of those relationships are visible.

### 2.2 Competitor anchors

- **Polarion Document Baselines** (per `competitor-polarion.md`): the document detail view renders a side panel with every baseline that references the current item, with state pills (Draft / Released / Frozen) and click-through to the diff. Polarion's CM is unified with Documents, so the LiveDoc concept of "this paragraph is in baseline X" is a first-class visual.
- **Codebeamer Coverage Browser**: per `competitor-codebeamer.md`, this widget shows every tracker item with its baseline coverage and version chain inline.
- **DOORS Next** uses a separate "History" tab with a vertical timeline.

### 2.3 Recommended pattern

A CI detail drawer with three structural sections:

1. **Header**: CI key (mono), name (display title), current version+revision (mono), current status pill, current lockState pill, DAL chip (when safety-critical).
2. **State diagram** (horizontal, 4 nodes): `Draft → InReview → Released → Obsolete`. Each node is a chip; the current state is filled with `accent.primary`; reachable next-states show as outline chips with the action label as a tooltip ("Submit for review", "Release for use"). Clicking an outline chip opens the appropriate confirmation modal (with signature when transitioning to Released).
3. **Version chain** (vertical timeline): every prior version with author, date, change summary, the baseline that pinned that version (clickable), and the CR that authorized the version bump (clickable). Empty until `RequirementVersion`-equivalent persistence lands for CIs.

The cross-module artefact panel (current "Linked Artifacts (placeholder)" section) becomes real once `ConfigItem.refType` + `refId` are populated — each typed CI references the canonical row in another module via the existing `buildDeepLink` system (see `architecture.md` §"Deep-link system"). Click "Requirements (3)" → opens the Requirements list filtered to the three rows.

---

## 3. The baseline freeze ceremony — buttons in a row menu where there should be a wizard with signature

### 3.1 Current state

The Baselines tab row menu offers `View` / `Approve` (when Submitted) / `Freeze` (when Approved). Both Approve and Freeze are one-click — no confirmation, no signature, no reauth, no meaning string. The `APPROVE_BASELINE` reducer sets `status='Approved'` and stores `approvedBy: state.currentRole` (a string enum, not a user ID) and `approvedAt: ISO`. The `FREEZE_BASELINE` reducer sets `status='Frozen'` — no record of who froze it.

This is the strongest aerospace-credibility gap in the page. **A baseline freeze without a signature event is not an audit-grade baseline.** Per CFR 21 Part 11 §11.50 (signature record requirements): a signature record must include (a) the printed name of the signer, (b) the date and time of signing, and (c) the meaning of the signature. None of those are required by the current flow.

### 3.2 Competitor anchors

- **Jama Review Center** (per `competitor-jama.md`): baseline review with required signers, each signer reauthenticates at signing, the signature record is bound to an immutable baseline row, the audit log surfaces every signing event with meaning string.
- **Polarion Workflow Signers** (per `competitor-polarion.md`): per-transition signer rules; document baselines require a workflow gate transition and the gate prompts for signature.
- **Codebeamer Review Hub** (per `competitor-codebeamer.md`): UI 3.2 review hub collects e-signatures with reauth.
- **DOORS Next** "Sign Baseline" with electronic signature.

Every named ALM competitor except the Jira+Xray stack ships this primitive. Per `gap-summary.md` #1, this is **score 8.33** (user 5 × pressure 5 / cost 3).

### 3.3 Recommended pattern — the baseline ceremony

Replace "Freeze" in the row menu with "Approve & Freeze" as a single ceremonial action. Open a multi-step modal:

1. **Step 1 — review.** Show the baseline metadata, the snapshot count, the compliance flags (per active project standards), the suspect-link count from `linksSnapshot`, and any unsigned upstream traces. If `Project.strictMode = true`, require at least two distinct approvers — show the list of who else must sign.
2. **Step 2 — confirm.** A controlled-vocabulary dropdown for the signature meaning ("Approve for release", "Approve as PDR baseline", "Approve for customer delivery", "Approve as configuration audit basis"). The list is pinned per certification standard; not free-text.
3. **Step 3 — reauthenticate.** Password re-entry. On success, the system stores a `BaselineSignature` row (per the verification cross-cut entry "VerBaseline snapshot is mutable and unsigned" — same primitive lands here, polymorphic over `baselineKind`).
4. **Step 4 — confirmation.** Show the signed baseline with the signature event surfaced, the audit log entry visible, and a copy-to-clipboard of the immutable content hash.

After step 3, `Baseline.status` becomes `Frozen` and `Baseline.lockedAt` is set. Every `ConfigItem` referenced by the baseline (via `BaselineItem`) gets `lockState = 'FrozenByBaseline'`. Any subsequent mutation to a frozen CI returns 409 (per `kb/configuration-management.md` "strictMode rules"). The audit log row carries the signer userId, the reauth timestamp, the meaning string, and the content hash.

This is the **load-bearing demo moment** for any aerospace buyer. A 60-second video showing this ceremony — paired with a screenshot of the auditable signature record in the central audit log — is the single most convincing artefact in the sales conversation.

---

## 4. The deviation / waiver review — a one-screen form where there should be a workflow

### 4.1 Current state

The Deviations & Waivers tab opens the `CreateDWModal` (single screen). It captures type (Deviation / Waiver), title, linkedCIs[], riskLevel, validUntil, status, authorityInvolved checkbox, decisionNotes. Submits with `status = 'Draft'`. The detail drawer offers `Approve` / `Reject` buttons (which transition to `Approved` / `Rejected`).

**No risk justification, no signer chain, no authority notification, no expiry workflow.** A medium-risk deviation against a safety-critical CI with `authorityInvolved=true` is approved with the same click as a typo-correction waiver.

### 4.2 Anchors

`kb/configuration-management.md` §"Deviations and waivers" specifies:

> Both need linkage to CIs and an approving authority. Under `strictMode`, both require a cryptographic signer (future work).

EIA-649-C §7.5 (interchangeability rules) and ARP4754A §5.3 (deviations from intended use) both require a written record of the authority chain. Polarion's deviation workflow (per `competitor-polarion.md`) routes through workflow gates per risk level. Codebeamer's deviation tracker is a standard tracker with workflow transitions per risk.

### 4.3 Recommended pattern

Risk-level-conditional review path:

- **Low-risk waiver / deviation** — single approval from ConfigManager or CCBMember; no reauth; closes immediately.
- **Medium-risk** — two approvers required (one of whom must be SafetyEngineer if linkedCIs contains any `safetyCritical: true` CI); reauth on each signature; valid for a fixed window (default 90 days for deviations, indefinite for waivers).
- **High-risk** — two approvers + authority notification toggle + mandatory `authorityInvolved=true` + customer-facing change log entry. Expiry mandatory ≤30 days for deviations.

UI rendering: the create modal becomes a wizard with the risk level on step 1, the required-approvers list computed live on step 2 (based on linkedCIs and risk), the justification on step 3, and the authority notification template (if applicable) on step 4. The drawer renders the approval chain as a vertical signature ledger with each signer's name, role, date, meaning, and reauth confirmation — exactly the same pattern as the baseline ceremony, reused.

The expiry workflow is the missing capstone: when a deviation's `validUntil` is within 14 days, the system should generate an Issue (via the existing Issues module) tagged `cm:deviation-expiring` assigned to the ConfigManager. This is the "evidence at point of creation" principle from `design-system.md` §2.2 applied to the DW domain.

---

## 5. The strict-mode UX — a toggle that does nothing where there should be a project-wide regime

### 5.1 Current state

The Access & Roles tab renders two checkboxes:

> ☐ Strict mode — only ConfigManager can edit  
> ☐ Audit mode — extra confirmations

Both write to `state.strictMode` / `state.auditMode` in the page-local reducer. **Neither has any backend effect.** The strict-mode language is also wrong: per `kb/configuration-management.md`, strict mode means "CIs locked by a baseline are immutable / Baseline approval requires ≥2 distinct approvers / Release approval requires a signed set of roles / DW transitions are append-only" — not "only ConfigManager can edit."

### 5.2 Recommended pattern

Move strict mode out of the CM page into a project-wide setting:

- **Where it lives.** Project settings page (existing `/projects/:projectId/settings` or similar). The toggle becomes `Project.strictMode` on the Prisma model.
- **Who can toggle.** Admin only. Toggling requires a reason (free-text + audit log entry) and a confirmation modal that lists every constraint enabling strict-mode imposes.
- **What it enforces.** The five constraints from the KB. Every CM module endpoint reads `project.strictMode` and applies the constraint at the controller layer. Toggling on for a project mid-flight does not retroactively lock past baselines, but new actions follow the new regime.
- **Where it surfaces.** Every relevant CM screen renders a banner: "**Strict mode active.** Per IEEE 828-2012 and DO-178C §11, baseline approvals require two signers; CI mutations on locked baselines are rejected." The banner is informational, not dismissible.

The Audit mode toggle is more questionable. "Extra confirmations" is too vague to enforce. Drop it unless and until a specific behaviour is defined.

### 5.3 Competitor positioning

`vision-and-usp.md` §1 commits to "opinionated defaults, audit-passing out of the box." Strict mode is the *off* state for unregulated customers; the default for regulated customers should be **strict mode on**. The project create wizard should detect the regulation context (aerospace / medical / automotive) from the project template and enable strict mode automatically. This is `design-system.md` §2.1 ("opinionated defaults") applied to compliance posture: customers don't choose, the system selects.

No competitor sells this as a feature. Codebeamer offers workflow gates per tracker; Polarion offers per-document workflow rules; Jama bundles "Airborne Systems template kit" with pre-configured review gates. None ship a project-level "regulated mode" switch that toggles every module's enforcement posture at once.

---

## 6. The compare tab — the strongest backend asset in the package, hidden behind mock data

Per `frontend.md` §11, the compare tab today runs a 22-line in-memory diff against the page's mock baselines, ignoring the rich `compareBaselines` endpoint that ships `added[]` / `removed[]` / `modified[]` (with full requirement field deltas and a `previous` slot) plus `linksAdded[]` / `linksRemoved[]` / `linksSuspectChanged[]`.

Once wired:

- Render the diff in the same vertical-split layout the existing tab uses.
- Show field-level changes in a side-by-side panel, not just a status pill. The `modified[]` row already includes `previous` + current values for every field — render as `previous.title || current.title` with strikethrough/highlight.
- Surface the link diff prominently: "**3 trace links added / 1 removed / 2 marked suspect**." Click a link to deep-link to the source/target artefact.
- For the CI vs CI mode, drop the synthesised 3-entry mock history and render against a real `ConfigItemVersion` chain once that exists.

This is `design-system.md` §2.5 ("Write once, trace automatically") applied to baseline diff: the user does not assemble the diff; the system renders it the moment two baselines exist.

---

## 7. The cross-cutting baseline primitive UX consequence

Per the verification cross-cut entry ("Unified baseline primitive — five patterns today") and validation cross-cut entry ("ValidationBaseline is the most fragile of the five baseline patterns"), the codebase has five module-local baseline implementations. Each renders its own list view, its own create wizard, its own approval flow, its own diff (or no diff). Customers will see this immediately: "Why does my CertBaseline look different from my Configuration Management baseline?"

The CM page is the natural home of the unified baseline UX. Per `kb/configuration-management.md`, IEEE 828 §6.4 defines baselines as a CM activity, not a Verification or Certification activity. The unified UX:

- One Baselines list under Configuration Management, scoped by `kind` (Functional / Allocated / Product / Verification / Certification / Parameter / Validation / Release).
- One create wizard parameterised by kind. The kind selects which entities are eligible to snapshot.
- One signature ceremony (per §3 above), reused across kinds.
- One diff renderer (per §6 above), reused across kinds.
- Per-kind links from the originating module — the Verification page links to its Verification baselines under CM, not to a parallel listing.

This is the longest-term refactor in the package and the most strategically valuable. It is also the foundation for `gap-summary.md` #2 (one-command audit package export): when every cert-relevant artefact's baseline shares a primitive, the export composer walks a single shape, not five.

---

## 8. Theming and brand-token migration

All buttons use `bg-blue-600 hover:bg-blue-700`. All status pills use `bg-blue-100`, `bg-green-100`, `bg-red-100`. The detail drawer headers use `border-gray-200 dark:border-gray-700` and inline color hex literals nowhere — fully Tailwind-classed but pre-token-migration.

This is cross-cutting per the requirements cross-cut entry ("Brand-token migration is a cross-package, not a per-page, refactor"). Step zero is extending `tailwind.config.js` with the design-system §3.1 token map; per-page migration follows. The CM module's blue concentration (every action button, every "InReview" pill, every "Submitted" baseline status, every "UnderReview" CR status) means the visual impact of the migration will be the most dramatic of any module — the page is currently visually indistinguishable from a generic SaaS dashboard and should become the most aerospace-credible page in the product after migration.

Per `design-system.md` §3.1, deep-forest accent `#1B4332` "signals established, tested, industrial trust — the visual language of DNV, TÜV, and regulated-industry heritage." The CM module is the regulated-industry-heritage module by definition. Token migration here lands the strongest brand-vs-content match in the codebase.
