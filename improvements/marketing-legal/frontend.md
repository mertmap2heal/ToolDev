# Marketing & Legal — Frontend Review

Per-component review of every public route. Each component is graded against `design-system.md` §3 (tokens), `design-system.md` §5 (voice), and `ui-research.md` §5 (AI-slop patterns).

---

## `LandingPage.tsx` — the composition root

**File:** `frontend/src/pages/Landing/LandingPage.tsx`. 27 lines, eight imports, one `bg-gradient-to-br` violation on the wrapper around `<LandingHero />`.

The composition is unremarkable: navbar, hero, features, modules, pricing, security, FAQ, footer. The shape is fine. The problem is that every child component below it carries the AI-slop tells `ui-research.md` §5 catalogues, and the wrapper itself adds the gradient-mesh backdrop that `ui-research.md` §5 calls "purple-to-blue gradient hero — GPT mockup cliché." The gradient is from `gray-50` to `gray-100`, not purple-to-blue, but the *shape* of the move — a soft directional gradient behind the hero — is identical, and the visual register reads the same way in a five-second scan.

**Target.** Per `roadmap.md` Phase 2 the composition should match the `/preview/landing` reference: navbar, hero with a real traceability-matrix screenshot, a `StandardsStrip` compliance-badge row immediately under the hero (this is currently *missing entirely*), and an editorial alternating-layout features section. The `gradient` wrapper is removed; the page background is `surface.base` (`#FAF8F3` warm cream) per `design-system.md` §3.1.

---

## `LandingNavbar.tsx`

**Token violations.** Three `bg-blue-600` button states, three `focus:ring-blue-500` rings, one `hover:bg-blue-700`. The nav links use the right `gray-*` neutral scale but the brand surface is pure white (`bg-white`), not the warm cream `#FAF8F3` of `design-system.md` §3.1. The logo size is `md` which renders the placeholder logo from `Logo.tsx`.

**Voice/structure.** Nav labels are correct — single-word section anchors. The auth-aware CTA is correct ("Open App" if logged in, else "Login"). But the CTA should be a dual pairing per `ui-research.md` §6: "Start free" primary, "Talk to an engineer" ghost. Currently a single button only.

**Concrete replacement.** Per `roadmap.md` Phase 2, swap the `blue-600` accent for `accent.primary` (deep forest `#1B4332` — `design-system.md` §3.1). Swap `bg-white` for `surface.base`. Replace the single CTA with the dual pattern. Use Geist Sans 400 for the nav labels at 13px tracking `-0.01em`. Keep the sticky-top behaviour. The `Logo` component is out of scope here — Phase 2 commissions the new logo separately per `roadmap.md` Phase 0 §logo commissioning.

---

## `LandingHero.tsx` — the most-broken surface

**Every line is wrong.** It is worth itemising because the rebuild ticket needs to be specific.

1. **Hero copy is AI-template register.** "Enterprise engineering lifecycle management" is the headline. This is the literal phrasing `vision-and-usp.md` §1 calls "a generic CRUD database with a custom field for 'standard.'" It is the register DOORS, Polarion, and Jama use; it is the register we exist to escape.
2. **Subhead contains TWO banned-list words in one sentence.** "Built for teams that demand rigor and audit readiness" — `demand` and `rigor` both appear on the `design-system.md` §5.1 kill-list. The phrase "audit readiness" is on the kill-list as a phrase.
3. **No named standard, no named adversary, no concrete claim.** No DO-178C, no DAL, no PSAC, no DOORS/Jama, no quantified time-to-value claim. The hero earns zero credibility against the `ui-research.md` §6 hero-headline-formulas checklist.
4. **Single CTA, generic label.** "Login" / "Open App" is functional but does not match `ui-research.md` §6 dual-CTA pattern. There is no "Talk to an engineer" path.
5. **The right column is a placeholder SVG masquerading as a product screenshot.** `<rect>` + `<linearGradient>` blue cards with mock lines. `ui-research.md` §4 hero-pattern explicitly names this: *"Linear, Figma, Vercel, Stripe, Resend, GitHub all show real product above the fold — never stock illustration, never abstract network diagrams, never the floating-cards-with-gradient cliché."* The SVG even contains a `linearGradient` with `#3B82F6` (Tailwind `blue-500`) — the exact accent `ui-research.md` §2 names as the credibility-destroying default.
6. **`rounded-xl` on the right-column card.** Reserved-for-modals radius per `design-system.md` §3.5; here it is used decoratively.
7. **`shadow-lg` on the right-column card.** Forbidden on primary surfaces per `design-system.md` §3.6.

**Target — the three-second elevator pitch from `vision-and-usp.md` §12:**

```
Certify in months. Not years.
Requirements, verification, and audit evidence —
built around DO-178C, not around ALM.
Built for human-AI teams, not for AI autonomy.
```

Display headline in Fraunces 500 at 64px / `-0.03em` per `design-system.md` §3.3 `display-xl`. Subhead in Geist Sans 17px. Dual CTA: "Start free" primary (accent forest fill) plus "Talk to an engineer" ghost button. Right column: a real, captured-from-production screenshot of the objective-completion matrix per `design-system.md` §8.2 — Phase 4.3 will build that screen, so the landing rebuild may use a high-fidelity Figma mock that matches the matrix component exactly. Monospace requirement IDs (`REQ-1024`, `VER-033`), monospace objective codes (`A-3.1`), pill statuses (`Approved`, `Open`).

**Reference.** `/preview/landing` already proves the direction with `TraceabilityMatrixMock`. The Phase 2 rebuild promotes that approach to `/`.

---

## `FeaturesSection.tsx` — three-column icon grid

**The anti-pattern by name.** `ui-research.md` §5 names this exactly: *"3-column icon + title + body feature grid — Every Tailwind template. Fix: Editorial alternating layout with real screenshots."*

The current section ships six Lucide icons in `bg-blue-50` 40px squares with a `text-blue-600` glyph inside, each captioned with a generic two-sentence claim. The icons are: `FileCheck`, `GitBranch`, `AlertCircle`, `AlertTriangle`, `ClipboardCheck`, `BookOpen`. None of them are wrong, but they are decorative — they say nothing the title does not already say. Per `design-system.md` §4 iconography doctrine, *"Icons that exist only to 'visually break up' a section are removed."*

**Copy.** "Requirements & Traceability — Manage requirements with full traceability from stakeholder needs through verification evidence." That sentence works on the landing page of any ALM product on Earth. It is interchangeable with the Jama, Polarion, Codebeamer landing pages. The `design-system.md` §5.3 sentence-pattern doctrine requires concrete nouns and named standards: "DO-178C Table A-3 objective satisfaction, per requirement, computed from the live trace graph."

**The intro line is two banned words.** "A unified platform for engineering lifecycle management with traceability, change control, and audit readiness." `unified` and `audit readiness` both on the kill-list. Plus the phrase "engineering lifecycle management" is the noun phrase `vision-and-usp.md` §3 explicitly disavows — *"Make certification a by-product of good engineering, not a parallel bureaucracy."*

**Target.** Per `roadmap.md` Phase 2 the section is replaced with an editorial alternating layout. Five or six features, each its own full-width section, alternating image-left / image-right. Each section contains a real product screenshot (objective matrix, requirement editor with the inline atomic-language flag, verification plan with MoC dropdown, evidence drawer with provenance, certification-package one-click export) and a concrete benefit statement that names the artefact: *"The verification plan exists from the moment the requirement does. The MoC dropdown is filtered to those valid for the DAL — you cannot pick an invalid combination."* No icon decoration.

`FeatureCard.tsx` becomes obsolete in the new layout. It can be deleted in the same PR.

---

## `ModulesSection.tsx` — incumbent-style feature matrix

**Why this section exists at all is the question.** It is a 20-module feature grid grouped into three categories: "System Definition" (6), "Development & Control" (8), "Assurance & Certification" (6). For each module: a Lucide icon, a label, and two bullet workflow lines.

`roadmap.md` Phase 2 names this explicitly: *"Re-evaluate. Listing every module is an incumbent-style 'feature matrix' move. Prefer a narrative walkthrough of one full certification loop."*

The competitor matrix in `improvements/_shared/competitor-matrix.md` §10 has us scoring ~22 native capabilities today versus Jama's ~50 and Polarion's ~52. We *will lose* a feature-matrix fight against the incumbents. The procurement-shaped fact is that an aerospace buyer reading our 20-module grid asks "do you have what DOORS has?" and the answer is "not yet." Listing modules invites that comparison on the exact axis where we are weakest.

**Voice violations.** The section intro: "Comprehensive modules aligned to system engineering and product development workflows." `comprehensive` is on the kill-list. The phrase "aligned to system engineering and product development workflows" is the exact phrasing every incumbent uses.

**The blue dot.** Each workflow bullet uses `<span className="text-blue-500 mt-0.5">•</span>`. Tiny but it adds up — twenty modules × two bullets each = forty `blue-500` bullets across the section.

**Target.** Replace the grid with a single editorial narrative: "One full certification loop, from requirement to PSAC." Walk the reader through the loop using a single screenshot per step. Step 1: write a requirement (atomic language flag). Step 2: choose verification method and MoC (filtered to DAL). Step 3: run the test, evidence auto-attaches. Step 4: review, sign-off becomes a baseline. Step 5: one-button certification package export. Five screenshots, five concrete claims, named standards throughout. The section becomes the proof of `vision-and-usp.md` §8.3 "Audit package as a command, not a project."

A second, terse list of modules can live further down the page — but as a one-line list ("Requirements · Verification · Validation · Change Requests · Risk · Compliance · Certification · ..."), not a 20-card grid that invites Jama comparison.

---

## `PricingSection.tsx` — placeholder shipped as product

Twelve lines including the section wrapper. The entire content is:

> "Pricing is tailored to your organization. Contact contact@company.com for more information."

`ui-research.md` §4 enterprise-trust unlocks names this as a credibility-destroyer: *"Hidden pricing (signals 'too expensive to say'). Empty pricing 'Contact us' — placeholder shipped as product."* The mailto recipient is also a placeholder (`contact@company.com`).

`vision-and-usp.md` §4 ICP self-serve posture says *"Self-serve first touch, enterprise contract on expansion. Can decide to buy within a week, not a quarter."* The current pricing section does the opposite of that — it forces a sales-led motion before the visitor knows what the product costs.

**Two acceptable outcomes**, per `roadmap.md` Phase 2: *"either real pricing or remove. Placeholder 'Contact us' is worse than nothing."*

- **Real pricing.** Three tiers. "Dev (free)", "Team", "Programme". A per-seat number on Team. A "Contact us" only on Programme. Per `_shared/competitor-matrix.md` §0 our target is *sub-$5k/yr for a 10-engineer team* — that number, in real currency, in the pricing card, beats every incumbent for the small-team ICP.
- **Remove the section** until pricing is decided. The page is better with no pricing than with placeholder pricing. The dual-CTA in the hero ("Talk to an engineer") handles the enterprise pre-pricing path.

The decision is a founder decision, not a designer decision. The ticket reflects that.

---

## `SecuritySection.tsx`

Four cards in a 4-column grid: Role-Based Access Control, Audit Logs, Traceability, Export & Import. Lucide icon, title, sentence. Same `bg-blue-50` icon plate pattern as `FeaturesSection`. Same `rounded-lg border` card.

**Three banned-list words in four sentences.** "Comprehensive audit trails" (`comprehensive`). "End-to-end traceability" (`end-to-end`). "Enterprise-grade security and compliance features for regulated environments" (`enterprise-grade`).

**The four claims are also generic.** Role-based access, audit logs, traceability, and import/export are table stakes — every competitor in `_shared/competitor-matrix.md` ships them. Listing them as the security story signals we *think* RBAC is a differentiator. It is not.

`ui-research.md` §6 trust placement: *"Compliance badges strip immediately below hero: DO-178C, ISO 26262, IEC 62304, SOC 2 Type II. Standards badges are social proof for regulated industries — they do not belong in the footer."*

**Target.** Per `roadmap.md` Phase 2: *"restructure as named compliance badges (DO-178C, ISO 27001, SOC 2 Type II) plus a `/trust` link."* The badges are the social proof; the RBAC / audit / traceability claims become a four-line list on the `/trust` page. The dedicated `/trust` page is `roadmap.md` Phase 8 — until that exists, the link is a sentence: *"Read the trust posture →"*.

If DO-178C and SOC 2 Type II are not yet attested (which is true at pre-launch), the badge wording is "DO-178C tool-qualification path: in progress, target Q3 2026" — concrete, honest, dated. Placeholder badges with no qualifier are worse than no badges.

---

## `FAQAccordion.tsx`

Six Q&A items. Accordion behaviour is accessible (proper `aria-expanded`, `aria-controls`, keyboard handler). The chevron animation works. The structural work is fine.

The **content** is the problem.

| Current Q | What an aerospace buyer actually asks |
|-----------|---------------------------------------|
| "What is the scope of this tool?" | "Do you support DAL A through D?" |
| "How does security and access control work?" | "Is the e-signature on a baseline CFR 21 Part 11-compliant?" |
| "Can we integrate with other tools?" | "Do you ReqIF round-trip with DOORS?" |
| "Is it suitable for on-premise or cloud deployment?" | "Can the AI features run against our own Azure OpenAI key?" |
| "How do we get support?" | "What's in the exported PSAC and who signed off?" |
| "Is there a pricing page?" | "If we cancel, do we get our requirements out?" |

`roadmap.md` Phase 2 names this specifically: *"rewrite questions to be questions a real aerospace buyer asks: 'Do you support DAL A?' 'What's in the exported PSAC?' 'Can we self-host?'"*

The current six questions read as a generic SaaS FAQ. They confirm to a sceptical reader that the authors do not know the aerospace buyer's vocabulary. That is the credibility loss `vision-and-usp.md` §1 specifically warns against.

**Style.** The accordion uses `focus:ring-blue-500`. Replace with `border.strong` from `design-system.md` §3.1. The `rounded-lg` on each item is acceptable per the §3.5 radius scale (`radius.sm` is 4px, `radius.md` is 8px — `rounded-lg` is 8px in Tailwind default, matches `radius.md`).

---

## `LandingFooter.tsx`

Thirty-two lines. Copyright, version, email link, Privacy, Terms. Minimal.

This one is closest to acceptable. `roadmap.md` Phase 2: *"minimal. Sitemap, trust page, status page, contact. No marketing flourish."*

**Adjustments.**
- The mailto `contact@company.com` is a placeholder. Replace with a real email.
- Add `/trust` and `/status` links per Phase 8 — these can be stubs that route to "coming soon" pages, but the footer slot is reserved now.
- Add `/changelog` link per Phase 8.
- `"Company Name"` literal is a placeholder. Phase 0 product-name decision unblocks this.
- Footer should sit on `surface.base`, not `bg-white`.

---

## `LoginPage.tsx`, `LoginCard.tsx`, `AuthLayout.tsx`

The login flow is functionally solid — accessibility is good (proper labels, error region with `aria-live`, focus management, caps-lock warning), validation is real (8-char minimum), the forgot-password flow is wired to a real backend endpoint.

**Token violations are heavy.** Twelve `blue-*` utility classes across the file. Two `rounded-2xl` modals (forgot-password modal at line 326). Multiple `bg-blue-600` button surfaces. The "Signing in..." spinner uses Lucide `Loader2 animate-spin` — per `design-system.md` §7 motion, *"Loading: shimmer skeleton that matches the final content shape. No spinning lucide circles."* — but for a login submit the lucide spinner is acceptable; the rule is about page-level loading, not button-level.

**The unauth-redirect splash is the worst surface.** Lines 145–154 — when a logged-in user lands on `/login`, they see a `bg-gradient-to-br from-gray-50 to-gray-100` background with a `Loader2 animate-spin` and "Redirecting..." text. That gradient is the AI-slop tell. Replace with `surface.base` and an object-named loading per `design-system.md` §5.4: *"Loading project..."* — though here it is the user being redirected, not a project, so *"Redirecting to your projects..."* is correct.

**Voice.** Error message in `getUserFriendlyError`: *"Backend not reachable. Start it in a terminal: cd backend && npm run dev — then try again."* This is dev-facing leakage to a production-facing surface. The user of `/login` is not the developer; they cannot start the backend. Replace with the neutral form per `design-system.md` §5.4: *"Service unavailable. Try again in a moment, or contact support."*

**Target.** Apply Phase 1 tokens. Replace the `blue-600` button with `accent.primary`. Replace the `rounded-2xl` modal with `radius.lg` (16px, modals only — `design-system.md` §3.5). Replace the gradient redirect splash. Keep the rest.

---

## `/preview/landing` — the reference implementation

This route already proves the direction. `PreviewLandingPage.tsx` composes a navbar, hero with a `TraceabilityMatrixMock` component, a `StandardsStrip` of compliance badges, an `ObjectiveFirst` editorial section, `HumanAITeaming`, `IntegrationHub`, `Numbers`, a CTA block, `TrustStrip`, and `Footer` — all scoped under `.preview-landing` CSS so nothing leaks.

The hero copy is **already correct**: *"Certify in months. Not years. Requirements, verification, and audit evidence — built around DO-178C, not around ALM. Built for human-AI teams, not AI autonomy."* The CTA pairing is **already correct**: "Start free" plus "Talk to an engineer."

**The Phase 2 task is essentially promote-and-polish.** Take the structure proven at `/preview/landing`, replace the placeholder `TraceabilityMatrixMock` with a real product screenshot once the matrix component lands in Phase 4.3 (or a high-fidelity Figma export until then), apply the canonical design tokens from `design-system.md` §3 (the preview uses scoped CSS variables that approximate them but do not share the source-of-truth), and deprecate `/preview/landing` once `/` matches.

---

## Legal pages — `PrivacyPolicy.tsx`, `TermsOfUse.tsx`

These pages use `LegalLayout` and ship as standard legal prose. The content is adequate for a pre-launch state. Voice is corporate-neutral, not engineer-direct — which is acceptable for legal copy.

Token violations are minor — `text-gray-900 dark:text-white` headings, `text-gray-700` body. No `blue-*` accents on the page body. The layout is a single-column reader at `max-w-3xl`.

**Phase 2 adjustments.** Apply tokens. Convert headings to Fraunces 500 (display + title scale). Body remains Geist 17px (`body-lg` for long-form reading per `design-system.md` §3.3). No structural change.

---

## Help — `HelpLayout.tsx` + `helpRegistry`

In-app docs, authenticated route. Three-pane layout: 240px sidebar of pages grouped by category, main content, 220px right rail with on-this-page anchors.

The header comment in the file says: *"Visual style follows the rest of the app: theme tokens for surface + text, blue-600 accent, gray-200 / gray-700 borders. No serif fonts and no warm palette so the page stays consistent with the other modules."* That comment captures the current state — `blue-600` accent, gray scale, no serif. After Phase 1 tokens land, the comment becomes wrong and the page automatically picks up the new palette.

**Recommendation.** Out of scope for Phase 2 landing rebuild. Help docs are an `/docs` site rebuild in Phase 8 per `roadmap.md`. Leave the in-app `/help` alone until then; it will pick up the new tokens automatically once Phase 1 lands.

---

## Summary

The eight landing sub-components contain every AI-slop pattern in `ui-research.md` §5. The login flow is functionally sound but cosmetically blue-heavy. The legal pages are adequate. The `/preview/landing` route is the reference for what the canonical `/` route should become. The in-app `/help` defers to Phase 8.

The single highest-leverage change is the hero rebuild — see `tickets.md` §1.
