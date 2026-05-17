# Marketing & Legal — Tickets

One ticket per `roadmap.md` Phase 2 "Concrete replacements" sub-item, plus the two cross-cutting tickets (token migration, copy kill-list sweep). Tickets are listed in dependency order: do not start ticket 2 until ticket 1 is in code review, etc.

Each ticket carries: a one-line goal, files touched, acceptance criteria, and a `roadmap.md` reference.

> **Scoping note (2026-05-18, PM).** `ROADMAP-phase3.md` §3 NX-6 ("Real landing page + brand migration completion") is an epic. It has been scoped to **one** shippable agentic-workflow ticket — the **landing-page per-section rebuild** — tracked as **Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454)**. That issue aggregates Tickets 1, 2, 3, 5, 6, 7 below plus Cross-cutting Ticket B (landing scope). Ticket 0 already shipped (N-1c). Cross-cutting Ticket A is the R-9 design-token foundation — already shipped (merge `30ee279`). Ticket 4 (PricingSection) is a founder decision folded into the #454 scope and may be deferred. **State-on-the-ground caveat:** Tickets 1-7 below were written against the now-deleted `frontend/src/components/landing/` directory; the canonical landing is now `frontend/src/pages/PreviewLanding/` with a different section set (`Navbar` / `Hero` / `StandardsStrip` / `ObjectiveFirst` / `HumanAITeaming` / `IntegrationHub` / `Numbers` / `TrustStrip` / `Footer`). The Architect restates the per-section rebuild against the actual `sections/` files — see #454 body.

---

## Ticket 0 — Promote `/preview/landing` to the canonical `/` route

**Status:** Shipped 2026-05-16 - Issue [#386](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/386), PR [#387](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/387), merge commit `02c52c8`. Resolution: `LandingOrApp.tsx` unauthenticated branch now renders `PreviewLandingPage`; `/preview/landing` redirects to `/`; legacy `LandingPage` + 9 `components/landing/` files deleted; 4 auth CTAs wired to `/login`. Residual placeholder anchors + the `PreviewLandingPage` rename deferred to NX-6 brand work.

**Goal.** Point the canonical `/` route at `PreviewLandingPage` and retire the legacy `LandingPage`. This is the route-swap step that precedes the per-component rebuilds in Tickets 1-7. Per `README.md` "Target state" — `/preview/landing` already proves out the correct direction with scoped design tokens; the Phase 2 task is to promote that scaffolding to `/`.

**Scope.** Route swap only — not a reskin. Wave N (Now bucket), effort S. R-9 (design tokens) is not a hard blocker: `PreviewLandingPage` ships its own scoped tokens via `preview-landing.css`.

**Files.** `frontend/src/components/LandingOrApp.tsx` (unauthenticated branch), `frontend/src/App.tsx` (`/preview/landing` route), `frontend/src/pages/Landing/LandingPage.tsx` + `frontend/src/components/landing/*` (deleted).

**Roadmap reference.** `ROADMAP-phase3.md` §2 N-1 `/preview/landing` sub-row.

---

## Ticket 1 — Rebuild `LandingHero.tsx` with the elevator-pitch copy and a real product screenshot

**Status:** Shipped 2026-05-18 — NX-6 / Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454), PR [#455](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/455), merge commit `872e3f9` (code commit `36ec127`). Restated against the actual `PreviewLanding/sections/Hero.tsx`: Hero is already token-clean with the `vision-and-usp.md` §12 pitch verbatim — NX-6 migrated its inline `marginTop` style to `pl-hero__media`, resolved the `#contact` CTA to a `mailto:`, and made `Start free` auth-aware. Per the approved Architecture/Design comments the hero keeps `TraceabilityMatrixMock` (a token-clean, product-truthful Table A-5 render) — a real screenshot swap is a follow-on once NX-7 ships the objective-completion matrix.

**Goal.** Replace the placeholder gradient hero with the three-second elevator pitch from `vision-and-usp.md` §12 and a real product screenshot of the objective-completion matrix.

**Files.**
- `frontend/src/components/landing/LandingHero.tsx` — full rewrite.
- `frontend/src/pages/Landing/LandingPage.tsx` — drop the `bg-gradient-to-br` wrapper.
- `frontend/src/assets/landing/objective-matrix-screenshot.png` — new asset (high-fidelity mock until Phase 4.3 ships the real component).

**Copy (verbatim from `vision-and-usp.md` §12).**
- Display heading: "Certify in months. Not years." — Fraunces 500, 64px, `-0.03em`, two lines on mobile.
- Subhead: "Requirements, verification, and audit evidence — built around DO-178C, not around ALM. Built for human-AI teams, not for AI autonomy." — Geist Sans 17px, max-width ~620px.
- Primary CTA: "Start free" — solid `accent.primary` (`#1B4332`), white text, `radius.sm` (4px). Auth-aware: if `authService.getToken()` is set, label becomes "Open app" and routes to `/`.
- Secondary CTA: "Talk to an engineer" — ghost button, `border.default`, `ink.primary` text. Routes to `mailto:` or a dedicated contact form.

**Visual.**
- Right column: a real screenshot of the objective-completion matrix per `design-system.md` §8.2. Show 6–8 filled DO-178C Table A-3 objectives, with monospace requirement IDs (`REQ-1024`, `REQ-1025`, ...), monospace objective codes (`A-3.1`, `A-3.2`), monospace timestamps, and status pills (`Approved` in `status.success` tint, `In review` in `status.warning` tint).
- The screenshot is presented borderless on the warm-cream surface — no `shadow-lg`, no `rounded-xl`, no gradient backdrop. A 1px `border.default` if any visual frame is needed (`design-system.md` §3.6 — borders, not shadows).

**Acceptance.**
- No `blue-*` utility classes in the file.
- No `bg-gradient-*` utilities.
- No `shadow-lg`.
- No placeholder SVG `<rect>` elements.
- Hero copy passes `rg -w "rigor|robust|leverage|unified|demand|comprehensive|enterprise-grade"` with zero hits.
- Lighthouse accessibility >95 on the page after merge.
- Dual CTA visible at all breakpoints from 320px up.

**Roadmap reference.** `roadmap.md` Phase 2, concrete replacements bullet 1 ("LandingHero replacement (real product screenshot of objective-completion matrix)").

---

## Ticket 2 — Replace `FeaturesSection` with editorial alternating layout

**Status:** Shipped 2026-05-18 — NX-6 / Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454), PR [#455](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/455), merge commit `872e3f9`. Restated against the actual page: no `FeaturesSection` exists — `ObjectiveFirst` and `HumanAITeaming` are already the editorial alternating two-column layout `design-system.md` §6 prescribes. NX-6 migrated their residual inline styles to `pl-*` classes; no structural change needed.

**Goal.** Replace the 3-column icon-and-paragraph grid with five full-width sections, alternating image-left / image-right, each naming an artefact and a standard.

**Files.**
- `frontend/src/components/landing/FeaturesSection.tsx` — full rewrite.
- `frontend/src/components/landing/FeatureCard.tsx` — delete in the same PR (no remaining consumers).
- `frontend/src/assets/landing/{atomic-language, mocs-filtered, evidence-attach, baseline-signoff, package-export}.png` — five new screenshots.

**Section structure (5 sections).**
1. **The requirement is opinionated.** Screenshot: requirement editor with the inline atomic-language flag and the ambiguous-word warning ("should" highlighted). Copy: *"The editor flags 'should', 'may', 'as appropriate' as ambiguous. The shall-language mode enforces 'The [system] shall [verb] [object]'. The DAL selector and MoC dropdown sit on the same screen — you cannot pick an invalid combination."* Cite `vision-and-usp.md` §8.2 evidence-at-creation.
2. **The verification method comes free with the requirement.** Screenshot: verification plan view with the MoC dropdown filtered to those valid for the DAL on the linked requirement. Copy: *"A requirement is invalid for DAL A–C without a verification method, an evidence slot, and an objective mapping. The plan exists from the moment the requirement does."*
3. **Evidence attaches itself.** Screenshot: evidence drawer with a parsed test report PDF and per-field confidence chips. Copy: *"Upload a JUnit XML, a test-report PDF, or a screenshot. The evidence attaches with provenance — who uploaded, who extracted, which fields are AI-extracted, which were human-verified."* Cite `ai-ready-vision.md` §7.4 evidence ingestion.
4. **Sign-off freezes a baseline.** Screenshot: review approval flow with the cryptographic-sign-off event in the audit trail. Copy: *"A signed review is a frozen baseline. The artefact under review is immutable from that moment. The DER reads the diff between baselines on a single screen."* Cite `design-system.md` §8.4.
5. **One command, one package.** Screenshot: the certification-package export modal showing PSAC, SDP, SVP, SAS, SCI, SECI artefacts checking themselves green. Copy: *"PSAC, SDP, SVP, SAS, SCI, SECI artefacts for the current state of the project. One button. Every artefact is a versioned PDF and a machine-readable JSON. Idempotent. Logged."* Cite `vision-and-usp.md` §8.3 audit-package-as-a-command.

**Style.**
- Section intro heading dropped or rewritten without kill-list words. Optional `display-lg` (48px) section heading. No "What it does" / "A unified platform" generic intro.
- Each section is its own row, `py-24`, `max-w-7xl` container, two columns on `lg:`, single column with image-above on smaller.
- Screenshots borderless on `surface.base`. No `rounded-2xl`. No shadow.
- No Lucide icon decoration. Icons may appear *inside* the screenshots (they are screenshots of real product), not as section-header glyphs.

**Acceptance.**
- Five sections render.
- Zero `blue-*` utility classes.
- Zero kill-list words.
- Every section names a standard or artefact: DO-178C, PSAC, MoC, DAL, SAS, SCI, etc.
- Screenshots are PNG or WebP, optimised, lazy-loaded below the fold.

**Roadmap reference.** `roadmap.md` Phase 2, bullet 2 ("FeaturesSection editorial alternating layout").

---

## Ticket 3 — Replace `ModulesSection` with a narrative certification-loop walkthrough

**Status:** Shipped (no-op) 2026-05-18 — NX-6 / Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454), PR [#455](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/455), merge commit `872e3f9`. Restated against the actual page: no `ModulesSection` / 20-card grid exists — the `PreviewLanding` page is already a narrative walkthrough (objective-first -> human-AI -> integrate -> numbers) with no feature-count grid to invite the `competitor-matrix.md` §10 comparison. Nothing to delete or rebuild.

**Goal.** Stop inviting a feature-matrix fight we lose. Replace the 20-card grid with a single narrative of one complete certification loop.

**Files.**
- `frontend/src/components/landing/ModulesSection.tsx` — full rewrite to a 5-step walkthrough (or delete entirely if Ticket 2's five-section layout already covers the loop end-to-end).

**Decision.** Per `roadmap.md` Phase 2: *"Re-evaluate. Listing every module is an incumbent-style 'feature matrix' move. Prefer a narrative walkthrough of one full certification loop."*

If Ticket 2 already walks the five-step loop, this section becomes redundant — delete it. If Ticket 2 stays at five *capabilities* rather than a *loop*, then this section becomes the narrative loop. Recommend deletion to avoid duplication.

**If retained,** the section is:
- A single horizontal step indicator with five numbered steps.
- One terse paragraph per step.
- A monospaced footer listing the 14 shipping modules as a single line: *"Requirements · Verification · Validation · Parameters · Functions · Tasks · Issues · Change Requests · PBS · Configuration Management · Compliance · Certification · Stakeholders · Documentation"* — only modules that are NOT mock-data per `_shared/inventory.md` §"Pages with no service imports."

**Modules NOT to list (mock-data only per `_shared/inventory.md`):** Risk Management, Interface Management, Safety Analysis. Listing them is dishonest per the `vision-and-usp.md` §13 credibility risk.

**Acceptance.**
- Section either deleted or rebuilt as a 5-step linear walkthrough.
- Zero kill-list words.
- Zero `blue-*` accents.
- No mock-only module listed.

**Roadmap reference.** `roadmap.md` Phase 2, bullet 3.

---

## Ticket 4 — `PricingSection` real-or-remove decision

**Status:** Folded into Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454) (NX-6) scope as a founder decision — may be deferred. The Designer states the call in the #454 design comment.

**Goal.** Decide between real pricing and removal. Either is acceptable; "Contact us" placeholder is not.

**Files.**
- `frontend/src/components/landing/PricingSection.tsx` — rewrite or delete.

**Decision input required from the founder.** Three options:

**A. Real per-seat pricing, three tiers.**
- "Dev" — free, single-user, full feature set, no project sharing.
- "Team" — $99/seat/month or $79/seat/year, up to 25 seats, full collaboration.
- "Programme" — Contact sales, 25+ seats, on-prem option, SSO, dedicated success engineer.

Target the small-team A&D ICP at sub-$5k/yr for 10 engineers per `_shared/competitor-matrix.md` §0. Beats Polarion's ~$18k floor, Codebeamer's ~$12k, DOORS's ~$98k.

**B. Two tiers only.**
- "Free" — full feature set, no sharing.
- "Contact sales" — pricing on request.

Cleaner, but loses the self-serve "I see the price, I buy" motion `vision-and-usp.md` §4 mandates.

**C. Remove the section entirely.**
- Hero "Talk to an engineer" CTA handles pre-pricing inquiries.
- Pricing returns when real numbers are decided.

**Recommendation.** Option A if pricing is locked. Option C until it is. Option B is the worst of both worlds.

**Acceptance.**
- Section either ships real prices in real currency, OR is removed and hero CTA covers the path.
- No mailto:contact@company.com placeholders.
- No "Pricing tailored to your organization" copy.

**Roadmap reference.** `roadmap.md` Phase 2, bullet 4 ("PricingSection real-or-remove").

---

## Ticket 5 — `SecuritySection` replaced with compliance-badge strip

**Status:** Shipped 2026-05-18 — NX-6 / Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454), PR [#455](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/455), merge commit `872e3f9`. Restated against the actual page: `StandardsStrip` + `TrustStrip` are the token-clean badge-strip equivalents. NX-6 migrated their inline styles to a shared `pl-strip` class and replaced the bare/false `TrustStrip` claims (`SOC 2 Type II`, `ISO/IEC 42001 aligned`, `EU AI Act Article 9 ready`) with honest pre-launch qualifiers (`readiness in progress`, `alignment in progress`, `risk process designed`) per `vision-and-usp.md` §13 — no "certified", no fake badge. The full `/trust` page stays out of scope (Phase 8).

**Goal.** Replace four-card RBAC/Audit/Trace/Export grid with a named compliance-badge strip and a `/trust` link.

**Files.**
- `frontend/src/components/landing/SecuritySection.tsx` — rewrite as a thin badge strip.
- `frontend/src/pages/Trust/TrustPage.tsx` — new stub page, links to from footer and badge strip.
- `frontend/src/App.tsx` — add `/trust` route.

**Structure.**
- A single horizontal row of badges, immediately below the hero per `ui-research.md` §6 trust-placement.
- Badge content: monochrome standards lockups for DO-178C, DO-254, ARP4754A, ISO 27001, SOC 2 Type II.
- Each badge has a status qualifier per `vision-and-usp.md` §13 credibility risk:
  - DO-178C: "Tool-qualification path: in progress, target Q3 2026"
  - DO-254: "Roadmap"
  - ARP4754A: "First-class data model"
  - ISO 27001: "Roadmap, target H1 2027"
  - SOC 2 Type II: "Pre-launch readiness in progress"
- One link below the strip: "Read the trust posture →" → `/trust`.
- `/trust` is a Phase 8 page per `roadmap.md` but ships as a stub now with the same compliance status, the subprocessor list, the data-residency policy, and the bug-bounty contact.

**Honest is better than aspirational.** Buyers respect "in progress, target Q3 2026" far more than they respect a badge with no qualifier.

**Acceptance.**
- Section is a single strip, not a card grid.
- Three kill-list words (`comprehensive`, `end-to-end`, `enterprise-grade`) removed from the section.
- `/trust` route renders (even if stub).
- No "Comprehensive audit trails" / "Enterprise-grade security" copy anywhere.

**Roadmap reference.** `roadmap.md` Phase 2 bullet 5 plus Phase 8 trust surfaces.

---

## Ticket 6 — `FAQAccordion` rewrite for aerospace buyers

**Status:** Shipped 2026-05-18 — NX-6 / Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454), PR [#455](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/455), merge commit `872e3f9`. The Designer ruled INCLUDE. NX-6 added a new landing-local `sections/Faq.tsx` — an accessible accordion (`<button aria-expanded>` / `aria-controls`, native Enter/Space, visible focus ring) with the six aerospace-buyer questions (standards, is-the-tool-certified, AI-sign-off, replace-vs-integrate, ITAR data residency, cancel/export) whose answers echo `vision-and-usp.md` positioning. It is a landing-local section, not a shared primitive (Phase-3 follow-on).

**Goal.** Replace the generic SaaS FAQ with the questions an aerospace chief engineer actually asks.

**Files.**
- `frontend/src/components/landing/FAQAccordion.tsx` — rewrite the `FAQS` array.

**Replacement Q&A set (six questions, in priority order).**

1. *"Do you support DAL A through D under DO-178C?"* — Yes. The objective catalogue ships seeded per DAL. Verification methods, MoC, and evidence requirements adjust automatically to the selected DAL.
2. *"What's in the exported PSAC and who signed off?"* — PSAC, SDP, SVP, SAS, SCI, SECI per `vision-and-usp.md` §8.3. Each artefact carries the cryptographic sign-off chain — every reviewer, every approval, every baseline snapshot. Machine-readable JSON ships alongside the PDF.
3. *"Do you ReqIF round-trip with DOORS?"* — Roadmap. Q3 2026. The data model already supports the polymorphic links ReqIF carries (per `_shared/inventory.md` §"Cross-cutting characteristics"); the parser is the work.
4. *"Can AI features run against our own Azure OpenAI key?"* — Yes (target launch). BYOK and self-hosted endpoints per `roadmap.md` B4. No AI call leaves your environment unless you configure it to.
5. *"What's the tool-qualification path under DO-330?"* — In progress, target Q3 2026. Status published on `/trust`.
6. *"If we cancel, do we get our requirements out?"* — Yes. Full project export as ReqIF, OOXML, and JSON. Export is in your hands; we keep your data only as long as your contract requires.

**Style.** No banned words. No corporate hedging. Each answer two to three sentences, concrete.

**Acceptance.**
- Six questions present.
- Every answer names a standard, artefact, or concrete date.
- Accordion accessibility (already correct) preserved.
- `focus:ring-blue-500` swapped for `border.strong` after Phase 1 tokens land.

**Roadmap reference.** `roadmap.md` Phase 2 bullet 6.

---

## Ticket 7 — `LandingFooter` minimal with trust/status/changelog slots

**Status:** Shipped 2026-05-18 — NX-6 / Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454), PR [#455](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/455), merge commit `872e3f9`. Restated against the actual `PreviewLanding/sections/Footer.tsx`: the dead `#`-anchor Product / Docs / Trust columns (12 anchors at routes behind auth or unbuilt Phase-8 surfaces) were removed — a link to a non-existent page is the dead affordance `design-system.md` §2.4 forbids. Net footer = wordmark + tagline + one slim legal row (`/privacy`, `/terms`, a `mailto:`, copyright). Inline styles migrated to `pl-footer__*` classes. Phase-8 `/status` and `/changelog` slots are NOT stubbed — they are omitted until those pages exist.

**Goal.** Footer follows `roadmap.md` Phase 2 doctrine: *"Sitemap, trust page, status page, contact. No marketing flourish."*

**Files.**
- `frontend/src/components/landing/LandingFooter.tsx` — minor restructure.

**Structure.**
- Left: copyright + version.
- Right: `Privacy` · `Terms` · `Trust` · `Status` · `Changelog` · real contact email.
- Phase-8 routes (`/trust`, `/status`, `/changelog`) stub now; footer slot is reserved.
- Remove `contact@company.com` placeholder. Replace with real email or remove the link until decided.
- Apply `surface.base` (warm cream) instead of `bg-white` after Phase 1 tokens.

**Acceptance.**
- No placeholder email.
- Five surface links plus contact.
- No marketing copy in the footer.

**Roadmap reference.** `roadmap.md` Phase 2 bullet 7.

---

## Cross-cutting Ticket A — Design-token migration (Phase 1 retroactive)

**Goal.** Per `roadmap.md` "Recommended starting path", Phase 2 lands first using local tokens, then Phase 1 extracts them into the central system. This is the extraction step.

**Files.**
- `frontend/tailwind.config.js` — rewrite palette per `design-system.md` §3.1.
- `frontend/src/index.css` — `:root` CSS variables.
- `frontend/src/design/tokens.ts` — single source of truth.
- `frontend/src/design/README.md` — token usage doc.
- `frontend/index.html` — Fraunces + Geist + JetBrains Mono fonts.

**Cross-cuts.** This ticket touches every page on every route. The marketing-legal package only consumes it on the landing — but completing the migration unlocks the Phase 4 interior reskin.

**Acceptance per `roadmap.md` Phase 1 DoD.**
- CI check fails on `blue-`, `indigo-`, `purple-`, `rounded-2xl`, `rounded-3xl` in new code.
- App still runs.
- Aesthetic is shifted but nothing is broken.

---

## Cross-cutting Ticket B — Copy kill-list sweep (Phase 6 partial)

**Status:** Landing scope Shipped 2026-05-18 — NX-6 / Issue [#454](https://github.com/chriertcafdle-beep/ToolDevelopment/issues/454), PR [#455](https://github.com/chriertcafdle-beep/ToolDevelopment/pull/455), merge commit `872e3f9`. The `PreviewLanding/` page was already kill-list-clean on arrival (per the approved Architecture comment); NX-6's edits — the honest `TrustStrip` qualifiers and the new `Faq.tsx` copy — were verified to introduce zero `design-system.md` §5.1 kill-list words. The wider codebase-wide Phase 6 sweep stays out of #454 and is a separate follow-on ticket.

**Goal.** Per `roadmap.md` Phase 6, grep the kill-list across the codebase and fix every hit. The marketing-legal rebuild fixes the landing surface; this cross-cutting ticket continues the sweep into the rest of the product.

**Scope for the marketing-legal package.**
- Verify zero hits after Tickets 1–7 land on:
  ```
  rg -w "rigor|rigour|robust|leverage|unified|streamline|seamless|empower|holistic|comprehensive|synergy|mission-critical|enterprise-grade|end-to-end|best-in-class|accelerate|supercharge|unlock|transform|game-changing|revolutionise|revolutionize|solution|demand|audit readiness|streamlined|powered|game-changing|transformative|robust" \
    frontend/src/pages/Landing/ frontend/src/components/landing/ frontend/src/pages/Login/ \
    frontend/src/pages/Legal/ frontend/src/pages/Help/
  ```

**Wider scope** (out of marketing-legal package, defer to Phase 6 sweep): every `frontend/src/` page that ships user-facing copy.

**Cross-cuts.** Every page. Single CI rule: `npm run lint:copy` runs the kill-list grep and fails on hits. Add to `package.json` scripts in Phase 6.

---

## Sequencing recommendation

1. **Week 1.** Tickets 1, 5, 7. The hero is the highest-leverage surface; the badge strip and footer are short.
2. **Week 2.** Tickets 2, 6. Features and FAQ are content-heavy but structurally simple after Ticket 1 sets the aesthetic.
3. **Week 2 mid.** Ticket 4 founder decision + Ticket 3 (delete or rewrite).
4. **Week 3.** Cross-cutting Ticket A token extraction. Cross-cutting Ticket B partial sweep.
5. **End of Week 3.** Lighthouse run, founder spot-check on the five-second test per `ui-research.md` §1, Playwright e2e for the public routes (the routes are not in the current spec list per `.claude/testing.md` — add a new `e2e/23-marketing.spec.ts` covering page-loads and CTA clicks).

Total estimate: three working weeks, consistent with `roadmap.md` Phase 2 "three to five working days" multiplied by the design-token-extraction overhead.
