# Design System & Workflow Doctrine

Every UI and copy decision must satisfy the north star in §1 and at least one of the supporting principles in §2. If a decision conflicts with both, it is the wrong decision.

---

## 1. The north-star design rule

> **Every screen must directly advance the certification package. If a user action does not produce certification evidence, question why it exists.**

One rule. Applied as a decision filter:

- Adding a feature? Name the certification artefact it produces. If none, do not build.
- Drawing a modal? Name the objective it closes. If none, the modal is padding.
- Writing copy? Name the regulator-facing outcome. If none, the copy is filler.
- Adding a field? Name the objective table cell it fills. If none, the field is bureaucracy.

Falsifiable: any team member can cite a screen and ask "what evidence does this produce?" — if the answer is hand-wavy, the screen is wrong.

The rule exists because the pain of requirements work is not the writing. It is the assembly. Incumbents optimise the writing; we optimise the assembly. Every interaction is a deposit into the audit package. Nothing else.

---

## 2. Five supporting principles

Each principle has a rule, a *why*, and a *how to apply* clause. They are invoked by name in PR reviews.

### 2.1 Opinionated defaults. Audit-passing out of the box.

**Why.** Incumbents' infinite configurability is how every DOORS install becomes a unique, un-auditable snowflake. Every new-hire DER has to re-learn the schema. Every procurement review takes three weeks instead of three days.

**How to apply.** We ship opinionated schemas per standard — DO-178C, DO-254, ARP4754A — that are versioned centrally, not per-tenant. The user never configures a workflow state machine. The user never invents custom fields for requirements. The user never names their own verification methods. If a user requires something outside the opinionated defaults, they are either using the product wrong or we have a standards update to make upstream.

### 2.2 Evidence at point of creation, not point of audit.

**Why.** The pain in requirements work is not writing the text. It is scrambling three weeks before a certification review to find the evidence that the requirement was verified. By then the test engineer has moved on, the test rig is disassembled, and the log file has rotated out of the retention window.

**How to apply.** A requirement is invalid without a verification method, an evidence slot, and an objective mapping. The create form refuses to save until all three are populated. The verification plan exists the instant the requirement exists. The evidence slot is a first-class link, not a URL in a comment. The moment a test is run, the evidence attaches itself.

### 2.3 Show the standard in context, never as a separate module.

**Why.** Current tools treat the standard as a reference manual the user consults separately. That is a cognitive tax — the engineer holds DO-178C Table A-3 in their head while editing a requirement in a different tab. Every context switch is a chance to get it wrong.

**How to apply.** Every relevant screen surfaces the objective code, the objective text, and the completion state inline. When a user edits a requirement, the objective that requirement satisfies is visible on the same screen. When a user plans a verification, the Method-of-Compliance options are filtered to those valid for the DAL on that requirement. The standard is not a separate page. It is ambient context.

### 2.4 Progressive disclosure. One decision per screen.

**Why.** The defining sin of DOORS, Jama, and Codebeamer is the Excel-grid with eighty columns and forty ribbon buttons. It presents every possible action simultaneously, so every action is equally weighted and none is obviously correct. Engineers escape to Word.

**How to apply.** The default view for any object shows the canonical happy-path action and up to two secondary actions. Depth is available behind a disclosure trigger — an expandable "Advanced" or "For DERs" section. The expert is one click away from full power, but the novice is not drowning in it. A screen that forces three equally-weighted choices is a screen where the product has no opinion.

### 2.5 Write once, trace automatically.

**Why.** Manual traceability is the biggest time-sink in current tooling. When a requirement changes, engineers manually walk every trace link to check for breakage. When a verification method changes, they manually update every test plan. Every manual edit is a chance to miss one.

**How to apply.** Traceability is derived from the data model, not maintained by users. If a system function decomposes into software requirements, the link is created by the decomposition action, not by a separate "Add Trace" button. If a requirement's DAL changes, the verification methods re-validate automatically and flag conflicts. Baselines are snapshots of the live graph, not hand-assembled documents. The user's job is to make correct decisions; the tool's job is to propagate the consequences.

---

## 3. Brand tokens

The tokens below are the canonical reference. `tailwind.config.js`, `index.css`, and any future design-token file must be generated from these. No inline hex colours in components. No ad-hoc font-size usage.

### 3.1 Colour

```
SEMANTIC                     LIGHT            DARK (Midnight)   USAGE
────────────────────────────  ───────────────  ───────────────   ──────────────────────────────
ink.primary                   #0F1419          #F5F1E8           Body text, headings, icons
ink.muted                     #6B6660          #9B9489           Captions, metadata, timestamps
ink.faint                     #A8A29A          #6B645C           Disabled, very-secondary
surface.base                  #FAF8F3          #0F1014           Page background (warm, not white)
surface.raised                #F2EEE3          #161821           Cards, panels (subtle lift)
surface.inset                 #EBE5D5          #0A0B0E           Code, mono blocks, input fields
border.default                #E2DCCD          #2A2C36           1px dividers (ALL surfaces)
border.strong                 #C9C2AF          #3A3D4A           Focus rings, emphasis
accent.primary                #1B4332          #4A9065           Primary action, emphasis (DEEP FOREST)
accent.primary-hover          #2D5A3D          #5FA878
status.success                #1B4332          #4A9065           Pass, approved, signed-off (use 12% tint bg + forest text in pills)
status.warning                #B8860B          #D4A030           Review pending, caution
status.danger                 #8B0000          #D63A3A           Fail, blocked, critical
status.info                   #2D4A63          #6B9AC4           Informational (reserved, rare)
```

No `blue-500`. No `indigo-600`. No `purple-700`. The accent is deep forest and nothing else. Blue appears only in the rare `status.info` slot. Deep forest (`#1B4332`) signals established, tested, industrial trust — the visual language of DNV, TÜV, and regulated-industry heritage — and differentiates us from every blue SaaS clone.

### 3.2 Typography

```
ROLE         FAMILY                         WEIGHT   TRACKING    EXAMPLE USE
───────────  ─────────────────────────────  ───────  ─────────   ────────────────────────
display      Fraunces (variable, Google)    500      -0.03em     Hero, major section heads
title        Fraunces                       500      -0.02em     Page titles (H1/H2)
body         Geist Sans (free, Vercel)      400/500  -0.01em     All UI, all body copy
mono         JetBrains Mono                 400      0           IDs, versions, timestamps
```

### 3.3 Type scale

```
display-xl   64px / 1.05  -0.03em    hero headlines
display-lg   48px / 1.1   -0.03em    marketing section heads
title-lg     32px / 1.15  -0.02em    app page titles
title-md     24px / 1.2   -0.02em    panel titles
title-sm     18px / 1.3   -0.01em    card titles
body-lg      17px / 1.5    0         long-form reading
body-md      15px / 1.5    0         default UI body (was 13 — raised)
body-sm      13px / 1.45   0         dense tables, captions
caption      12px / 1.4    0         metadata strips
mono-md      13px / 1.4    0         IDs, timestamps, versions
mono-sm      12px / 1.4    0         inline code, req refs
```

Body default raises from 13px to 15px. 13px was dense-AI-tell territory. 15px with tight `-0.01em` tracking reads as confident and does not cost density where it matters.

### 3.4 Spacing

Strict 8px grid. Allowed values only:

```
0, 2, 4, 8, 12, 16, 24, 32, 48, 64, 96, 128
```

Anything else is a mistake. Tailwind's default spacing scale works — document the kept values, forbid the rest.

### 3.5 Radius

Reserved for meaning, not decoration:

```
radius.xs   2px   mono chips, status pills, hairline pills
radius.sm   4px   buttons, inputs, cards (default)
radius.md   8px   panels, large cards
radius.lg   16px  modals, drawers (rarely)
radius.full 9999  avatars, dots, toggles
```

Never `rounded-2xl`. Never `rounded-3xl`. Those are consumer-app tells.

### 3.6 Shadows — forbidden on primary surfaces

Shadows are a consumer-app signal. We use borders.

Allowed shadow contexts:
- Dropdown menus and popovers (subtle, `0 4px 16px rgba(0,0,0,0.06)`)
- Drag preview states only

Forbidden:
- Cards
- Panels
- Modals (use a backdrop, not a card shadow)
- Buttons

---

## 4. Iconography doctrine

- **Keep Lucide, but constrain.** Lucide's breadth is the problem; pick a subset of ~40 icons and extend only with deliberate proposal.
- **Two sizes only.** 14px for inline, 18px for primary actions. Never mix three in one view.
- **Stroke width 1.75px.** Default Lucide is 2px — we thin it deliberately. Gives a more precise, engineering-drawing feel.
- **Never decorative.** Every icon communicates state, action, or type. Icons that exist only to "visually break up" a section are removed.
- **No Sparkles ✨ for AI.** AI suggestions use a neutral `Wand2` or a custom mark. Label the AI feature in words, not glyphs.

---

## 5. Voice and microcopy

The voice is **engineer-to-engineer, direct, standards-literate.** Not marketing. Not consumer. Not chatbot.

### 5.1 Kill-list

Never use these words in any product copy, marketing copy, or microcopy. They are the incumbent-speak we are trying to escape:

> rigour, robust, leverage, unified, structured workflows, audit readiness, demand, empower, holistic, comprehensive, end-to-end, best-in-class, enterprise-grade, mission-critical, streamline, accelerate, seamless, synergy, solution, unlock, supercharge, supercharged, revolutionise, game-changing, transform, transformative.

### 5.2 Use-list

- Named standards: DO-178C, DO-254, ARP4754A, DO-326A, ISO 26262, IEC 62304.
- Named artefacts: PSAC, SDP, SVP, SAS, SCI, SECI, traceability matrix, MoC, DAL.
- Named verbs: ship, certify, verify, trace, baseline, sign off, review, export.
- Named units: in minutes, in seconds, in a day, within a week, on the same screen.

### 5.3 Sentence patterns

- Verb-first imperatives for hero copy and CTAs. "Ship certified hardware in months."
- Two-clause subheads. *[Fast claim]. [Credibility claim].*
- Concrete nouns over abstract nouns. "DO-178C Table A-3 objectives" not "applicable compliance objectives."
- Active voice. "The tool exports the package" not "the package is exported by the tool."

### 5.4 Empty state, error, loading copy

Empty states address the reader as an engineer:

- Not "No requirements yet! Click the button above to get started. 🚀"
- Yes "No requirements. Start with a system-level requirement, or import from an existing baseline."

Errors quote the exact error and offer a named action:

- Not "Something went wrong."
- Yes "Save failed: requirement REQ-0142 is referenced by VER-033. Unlink before edit, or edit the verification instead."

Loading states name the object being loaded:

- Not "Loading..."
- Yes "Loading baseline B-2024-11..."

---

## 6. Component philosophy

### 6.1 The canonical object panel

The most-repeated UI pattern across the app is the *object detail panel* — used for requirements, verifications, change requests, functions, parameters, risks. One canonical layout:

```
┌───────────────────────────────────────────────────────────────┐
│  ID-MONO       · TYPE-BADGE         · STATUS-PILL   [Actions] │ ← header, 1 line
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  Title — Fraunces 500, 24px                                   │
│                                                               │
│  Primary attributes — grid of labelled fields                 │
│  (DAL, Owner, Verification Method, MoC, Objective)            │
│                                                               │
│  Description — body prose, Fraunces-optional for long form    │
│                                                               │
│  ── Evidence ──────────────────────────────────────────────   │
│  Linked evidence list, with inline add                        │
│                                                               │
│  ── Traceability ──────────────────────────────────────────   │
│  Upward and downward links, derived, read-only here           │
│                                                               │
│  ── History (collapsed) ──────────────────────────────────    │
│  Audit log, signed-off events, baselines                      │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

The same layout for every object. Users learn it once. Minor objects collapse sections, they do not invent new ones.

### 6.2 The canonical list view

One table primitive. Sortable, filterable, selectable. Always has: ID column (mono), Title column, Status pill, Owner, Updated timestamp. Every other column is domain-specific and hidden by default.

Group headers are visually distinct — same row height but different background and a colSpan single cell. Group headers are visited by keyboard navigation but do not register clicks as row clicks.

### 6.3 The canonical wizard

When a multi-step action is genuinely required (new project, import, export, certification-package build), one wizard primitive:

- Step indicator at the top: numbered, named, clickable back.
- Single decision per step.
- The final step is always "Review and confirm" — never a surprise side-effect.
- The cancel button is present on every step except success.

---

## 7. Motion

Motion is informational, not decorative.

- **Page transitions:** none. A navigation is instant.
- **Content transitions:** fade-in over 120ms on initial render only.
- **Hover feedback:** colour shift, 80ms ease-out. No scale transforms.
- **Modal/drawer entry:** 200ms ease-out, translate only, no fade-and-scale combo.
- **Loading:** shimmer skeleton that matches the final content shape. No spinning lucide circles.
- **Success confirmations:** a 1.5s pill that slides in from the top-right, does not block, and is dismissible.

No page-load splash animations. No confetti on submit. No "👋" in the empty state.

---

## 8. Workflow doctrine — removing the pain from requirements

The specific UX doctrine that answers the user's ask: *make the workflows easy, remove the pain.* These are not generic UX principles — they are concrete rules derived from the pain of incumbent tools.

### 8.1 The requirement editor is opinionated.

- The title field is atomic — one verb, one object, one measurable criterion. The editor flags long titles as "probably not atomic."
- Ambiguous words (*should*, *may*, *as appropriate*, *robust*, *user-friendly*) are flagged inline as anti-patterns.
- The shall-language mode (optional per project) enforces "The [system] shall [verb] [object] [within/when/if condition]."
- The DAL selector is on the same screen as the verification method selector. The MoC dropdown is filtered to those valid for the DAL. The engineer cannot pick an invalid combination.

### 8.2 The objective view is the home view.

The default landing for a new project is **the objective completion matrix**, not a list of requirements. The user sees the DO-178C objective table with live completion status against their current artefacts. Clicking an objective drills into the requirements and verifications that satisfy it.

This inverts the incumbent pattern — which shows requirements first and lets objectives be a separate report. Here, the objective catalogue *is* the project.

### 8.3 One-click baseline and package.

Two buttons on every project:

- **Baseline this state.** Takes a point-in-time snapshot of every object. Signs it. Names it. Readable by any DER.
- **Build certification package.** One button. Produces PSAC, SDP, SVP, SAS, SCI, SECI artefacts for the current state. Every artefact is a versioned PDF and a machine-readable JSON.

Both are idempotent. Both record a full audit trail. Neither requires a wizard.

### 8.4 Reviews are first-class, not email threads.

A review is an object. It has participants, due dates, comments scoped to a specific requirement or verification, approval states, and a final sign-off event with cryptographic timestamp.

The reviewer's UI is a focus mode: one requirement at a time, keyboard-navigable, with the diff from the prior baseline shown inline. The reviewer approves, comments, or requests changes. No email. No spreadsheet.

### 8.5 The DER view.

A dedicated read-only view that presents the project the way a Designated Engineering Representative needs to see it for findings-of-compliance: objective-indexed, artefact-linked, sign-off-visible. No edit controls. No distractions. One export button that produces the DER's report template.

This alone removes a week from most aerospace programmes' final certification prep.

---

## 9. Accessibility — a trust signal, not a checkbox

The European Accessibility Act took effect in June 2025. WCAG 2.1 AA is a legal requirement for products sold to EU consumers. Every pair of foreground and background colours in this design system must pass 4.5:1 contrast. Every focusable element must have a visible focus ring. Every icon-only button must have an `aria-label`. Every form field must have a real `<label>`.

Accessibility is not a section at the end of the spec. It is a filter applied to every colour, spacing, and component decision.

---

## 10. What this document does not cover yet

Deliberately out of scope here, but named so we do not pretend they are solved:

- The logo. The current logo is a placeholder. Commissioning or in-house design is pending.
- The product name. "Engineering Tool" is a working title. The name decision sits alongside the logo decision.
- Illustration style. If we choose to commission illustrations (e.g. for the landing page hero *behind* the product screenshot), a style guide is needed. For now the rule is: no illustrations. Product screenshots only.
- The documentation site theme. `/docs` will reuse the core design system but probably wants a wider reading measure. Spec follows when we reach that roadmap phase.
