# Roadmap — Phased Execution Plan

Phases are sequential where ordering matters and parallel where ordering does not. No phase begins until its predecessor's definition-of-done is satisfied.

## Two parallel tracks

Two tracks run concurrently because they do not conflict at the file level:

- **Track A — Brand and UI** (Phases 0 to 8 below).
- **Track B — AI core** (provenance spine, MCP server, evidence pipeline, RAG, API v1). Specified in `ai-ready-vision.md` §9.1; summarised as Phase B1 to B4 below.

Launch readiness requires both tracks at their respective Phase 4. Neither track is optional for the launch claim "certification-native and AI-native."

---

## Track B — AI core

### Phase B1 — Provenance schema and API v1 skeleton

**Goal:** the data model gains the provenance schema from `ai-ready-vision.md` §6.1 on every cert-relevant field. The REST API v1 skeleton is built with full OpenAPI 3.1 documentation, even for endpoints that return empty implementations.

**Files:**
- `backend/prisma/schema.prisma` — add provenance fields to Requirement, Verification, Evidence, ChangeRequest, Review.
- `backend/src/middleware/provenance.middleware.ts` — attach human and AI authorship to every write.
- `backend/src/openapi.yaml` — single source of truth for the REST API.
- `backend/src/routes/v1/*` — versioned route tree.

**Definition of done:** every write to a cert-relevant field produces a provenance record; the OpenAPI doc is generated and served at `/api/v1/docs`.

### Phase B2 — MCP server, launch scope

**Goal:** the MCP server from `ai-ready-vision.md` §7.2 is running and exposes read, draft, review, and impact tools. Credentials are project-scoped and tier-bounded.

**Files:**
- `backend/src/mcp/server.ts` — MCP JSON-RPC server.
- `backend/src/mcp/tools/*.ts` — one file per tool in the launch scope.
- `backend/src/mcp/auth.ts` — credential model that carries tier information.
- Public documentation site gets an MCP section.

**Definition of done:** an external Claude agent can connect with launch-tier credentials, query the KB, draft a requirement, and trigger a review finding. All events appear in provenance.

### Phase B3 — Evidence ingestion pipeline

**Goal:** evidence upload becomes AI-native per `ai-ready-vision.md` §7.4. PDF, Word, Excel, structured formats, and image parsing all land with per-field confidence and human-review gating.

**Files:**
- `backend/src/services/evidence/parser.service.ts` — orchestrates classification, extraction, and linking.
- `backend/src/services/evidence/parsers/*.ts` — per-format parsers (pdf, docx, xlsx, junit-xml, image).
- `frontend/src/pages/Verification/EvidenceReview.tsx` — the side-by-side review surface (original on the right, extraction on the left).

**Definition of done:** an engineer uploads a test report PDF, sees the extraction within a defined SLA (aim ≤10s for 10MB), reviews the extracted fields with single-keystroke accept/reject, and the evidence attaches with full provenance.

### Phase B4 — Native project RAG and BYO-model paths

**Goal:** the project KB is auto-indexed and queryable per `ai-ready-vision.md` §7.5. Model hosting options include default (our Anthropic), BYOK, and self-hosted.

**Files:**
- `backend/src/services/kb/indexer.service.ts` — incremental KB updater hooked to write events.
- `backend/src/services/kb/retrieval.service.ts` — retrieval with permission inheritance.
- `backend/src/services/kb/store/*.ts` — pluggable vector-store backend (default Postgres + pgvector; option for Qdrant or customer-hosted).
- `backend/src/services/ai/provider/*.ts` — pluggable LLM providers (anthropic, openai, azure-openai, self-hosted-openai-compatible).
- `frontend/src/components/ai/RagAnswer.tsx` — citation-chip rendering.

**Definition of done:** a user asks "which requirements satisfy DO-178C A-5.5" and receives a cited answer within a defined SLA; a customer can configure BYOK in settings and observe the next AI call go through their key; a self-hosted endpoint URL can be configured and exercised.

---

## Track A — Brand and UI

---

## Phase 0 — Decisions (pre-code)

**Goal:** lock the strategy so downstream work does not thrash.

- Vision + USP confirmed by the founder (sign-off on `vision-and-usp.md` §2–§8).
- Anti-ICP confirmed (`vision-and-usp.md` §5). Any future feature debate citing a non-ICP use case is closed here.
- Brand direction confirmed (`design-system.md` §3). Oxblood accent versus forest accent is the one open variation. Pick one.
- Product name decision scheduled (not required for Phase 1 tokens, but required before Phase 2 landing rebuild).
- Logo commissioning scheduled (required before Phase 2).

**Definition of done:** all four documents in `improvements/` reviewed and revised by the founder. Any unresolved disagreement becomes an explicit TODO in `vision-and-usp.md` §13.

**Estimated effort:** one working session.

---

## Phase 1 — Design tokens (foundation, no UI changes yet)

**Goal:** replace the theme primitives without changing any visible UI. Sets the substrate for everything after.

**Files:**
- `frontend/tailwind.config.js` — rewrite palette, typography, spacing tokens per `design-system.md` §3.
- `frontend/src/index.css` — rewrite `:root` and `[data-theme="midnight"]` CSS variables to the new palette. Remove the GitHub-clone values.
- `frontend/src/design/tokens.ts` — new file, single source of truth for tokens consumed by component code that cannot use Tailwind classes.
- `frontend/src/design/README.md` — new file, explains how to use tokens and the hard rules (no inline hex, no `blue-*`, no non-scale font sizes).
- `package.json` (frontend) — add Fraunces, Geist Sans, JetBrains Mono as font dependencies or link via `<link>` in `index.html`.
- `frontend/index.html` — load Fraunces + Geist + JetBrains Mono.

**Rules established in this phase:**
- Ban inline `style={{}}` going forward. Existing usage stays until Phase 4 touches it.
- Ban `blue-*` / `indigo-*` / `purple-*` utility classes. Grep check in CI.
- Ban `rounded-2xl` / `rounded-3xl`. Grep check in CI.

**Definition of done:**
- Token spec documented in `frontend/src/design/README.md`.
- CI check script fails on `blue-`, `indigo-`, `purple-`, `rounded-2xl`, `rounded-3xl` in new code.
- The app still runs and every page still renders. The aesthetic is noticeably shifted but nothing is broken.

**Estimated effort:** one working day.

---

## Phase 2 — Landing page bespoke rebuild

**Goal:** replace the landing page. This is the highest-leverage public visible change and the cheapest proof-of-concept for the brand direction.

**Why this phase before primitives:** the landing page needs a small set of one-off components (hero, section blocks, features editorial, pricing, FAQ) that can be built without waiting for the shared primitives. Building it first validates the direction with the founder on the riskiest surface.

**Files:**
- `frontend/src/pages/Landing/LandingPage.tsx` — rewrite composition.
- `frontend/src/components/landing/*.tsx` — rewrite every component. Probably a full replacement of the directory.
- `frontend/src/components/Logo.tsx` — replace with the new logo once commissioned.
- `frontend/public/logo.png`, `public/logo.svg` — replace.
- `frontend/public/og-image.png` — rebuild the social card to match.

**Concrete replacements:**
- `LandingHero.tsx` — kill the gradient SVG. Replace with a real product screenshot of the objective-completion matrix, showing a few filled DO-178C objectives, mono requirement IDs, status pills, and a traceability thread.
- `FeaturesSection.tsx` — replace the 3-column grid with an editorial alternating layout: each feature is its own section, with a real product screenshot on one side and a concrete benefit statement on the other.
- `ModulesSection.tsx` — re-evaluate. Listing every module is an incumbent-style "feature matrix" move. Prefer a narrative walkthrough of one full certification loop.
- `PricingSection.tsx` — either real pricing or remove. Placeholder "Contact us" is worse than nothing.
- `SecuritySection.tsx` — keep the section, restructure as named compliance badges (DO-178C, ISO 27001, SOC 2 Type II) plus a `/trust` link.
- `FAQAccordion.tsx` — rewrite questions to be questions a real aerospace buyer asks: "Do you support DAL A?" "What's in the exported PSAC?" "Can we self-host?"
- `LandingFooter.tsx` — minimal. Sitemap, trust page, status page, contact. No marketing flourish.

**Copy principles (from `design-system.md` §5):**
- Hero: verb-first + named standards.
- Subhead: two-clause, fast + credibility.
- CTAs: "Start free" + "Talk to an engineer."
- Standards strip directly below the hero.

**Definition of done:**
- `/` loads the new landing page.
- Every word of copy passes the kill-list check.
- A peer (non-involved engineer) scan-reads the page in five seconds and answers three questions: who is this for, what does it do, why would I use it instead of DOORS.
- A Lighthouse run scores >95 on accessibility and >90 on performance.

**Estimated effort:** three to five working days, including copy revisions and one round of feedback.

---

## Phase 3 — Primitive components

**Goal:** the shared component library that Phase 4 consumes.

**Files:**
- `frontend/src/components/ui/Button.tsx` — variants (primary / ghost / danger / link), sizes (sm / md / lg), loading and disabled states.
- `frontend/src/components/ui/Card.tsx` — variants (flat / raised / inset).
- `frontend/src/components/ui/Badge.tsx` — status pills, type badges, DAL badges.
- `frontend/src/components/ui/Input.tsx` — text, number, date, with inline validation.
- `frontend/src/components/ui/Select.tsx` — replace the native `<select>` usage in `DashboardPage.tsx`.
- `frontend/src/components/ui/Textarea.tsx` — single component used everywhere.
- `frontend/src/components/ui/Modal.tsx` — replace the ad-hoc modals in `DashboardPage.tsx:454` and `:463`.
- `frontend/src/components/ui/Drawer.tsx` — replace the custom drawer code in the existing drawer components. Respects the drawer visual pattern in `.claude/kb/react-typescript.md`.
- `frontend/src/components/ui/Popover.tsx` — for dropdowns like the export menu.
- `frontend/src/components/ui/Table.tsx` — the canonical list primitive from `design-system.md` §6.2.
- `frontend/src/components/ui/EmptyState.tsx` — opinionated, named-action empty states.
- `frontend/src/components/ui/Skeleton.tsx` — content-shape skeletons, not spinning circles.

**Definition of done:**
- Every primitive has a story / example page at `/design/primitives` (dev-only route, stripped in production).
- Every primitive is WCAG AA compliant — keyboard nav, focus ring, aria labels.
- Every primitive has a `README.md` header comment listing when to use and when not to.

**Estimated effort:** five to eight working days.

---

## Phase 4 — App interior reskin

**Goal:** apply the tokens and primitives across the signed-in app.

Broken into sub-phases so no single PR becomes unreviewable. Each sub-phase lands independently.

**4.1 — Layout chrome.** `Sidebar.tsx`, `Header.tsx`, `StatusBar.tsx`, `MainLayout.tsx`, `ProjectLayout.tsx`, `Breadcrumbs.tsx`, `UserMenu.tsx`. Kill the inline `style={{}}` blocks. Kill the Sparkles AI icon. Replace the search pill. One PR.

**4.2 — Dashboard.** `DashboardPage.tsx`. Replace `StatCard` with editorial stats row. Redesign the project card (less Linear-clone, more this-product). Replace the ad-hoc modals with the `Modal` primitive. One PR.

**4.3 — Project landing.** `ProjectLandingPage.tsx`. Replace the generic "module launcher" pattern with the objective-completion matrix (per `design-system.md` §8.2). One PR — this is a large change and the biggest UX bet in the reskin.

**4.4 — Login.** `LoginPage.tsx`, `AuthLayout.tsx`. Apply tokens. Keep visually restrained.

**4.5 — Settings.** `Settings/*`. Tokens and primitives only. Minimal layout change.

**Definition of done per sub-phase:**
- No inline `style={{}}` in touched files.
- No `blue-*` / `indigo-*` / `purple-*` utility classes.
- Uses primitives from `frontend/src/components/ui/`.
- Existing Playwright e2e tests still pass (per `.claude/testing.md`).

**Estimated effort:** two to three weeks across all sub-phases.

---

## Phase 5 — Module pages

**Goal:** apply the system to every module page.

One module per PR. Order by traffic and importance:

1. Requirements (flagship — highest care).
2. Verification (second flagship).
3. Parameters.
4. Tasks.
5. Issues.
6. Change requests.
7. Risk management.
8. Certification.
9. Configuration management.
10. Remaining modules.

For each module:
- Apply tokens.
- Apply primitives.
- Strip inline styles.
- Strip banned colours.
- Migrate to canonical object panel (`design-system.md` §6.1) if the module has detail views.
- Update e2e tests to match new selectors if they changed.

**Definition of done per module:**
- One PR per module.
- Existing e2e tests pass.
- Founder spot-check on the primary workflow.

**Estimated effort:** ongoing, ~1 module per week.

---

## Phase 6 — Microcopy + voice sweep

**Goal:** every string in the product reads like the rest. Also updates all user-facing backend error messages.

- Grep the kill-list (`design-system.md` §5.1) across the codebase. Fix every hit.
- Empty states: every `page.getByText(/no .* found/i)` pattern in tests is the spot where an opinionated empty state belongs.
- Error messages: 500-level errors get named actions. 400-level errors name the constraint that failed.
- Loading states: replace "Loading..." with object-named loading.
- Notification messages: rewrite per the microcopy doctrine.

**Definition of done:**
- `rg -w "rigor|robust|leverage|unified|streamline|seamless|empower|holistic|comprehensive|synergy|mission-critical"` returns zero hits in `frontend/src/` and `backend/src/`.
- Named empty states on every list view.

**Estimated effort:** two to three working days.

---

## Phase 7 — Motion and polish

**Goal:** the final layer of craft.

- Apply motion rules (`design-system.md` §7).
- Hover states reviewed across the app.
- Focus ring visible everywhere — WCAG AA verified.
- Toast/notification system built and adopted.
- Skeleton loaders replace spinners everywhere.
- Micro-interactions on primary actions (create, baseline, export).

**Definition of done:**
- Lighthouse accessibility >98 across every top-level route.
- Playwright visual-regression baseline captured.
- Founder review of one complete workflow with stopwatch.

**Estimated effort:** one working week.

---

## Phase 8 — Documentation + public trust surfaces

**Goal:** the `/trust`, `/security`, `/docs`, `/changelog` surfaces. These are part of the brand even if they are not the app.

- `/trust` page — compliance posture, certifications in progress, subprocessor list, data-residency policy.
- `/security` page — how we build, threat model, vuln disclosure process, bug bounty.
- `/docs` — user manual styling matches the new system (see `.claude/kb/user-manual-standards.md`).
- `/changelog` — public changelog. Monthly cadence minimum.
- `/status` — uptime + incident history.

**Definition of done:**
- All four surfaces live and linked from the landing footer.
- Each has an owner and a refresh cadence.

**Estimated effort:** one working week.

---

## Recommended starting path

Track A and Track B run in parallel. Track A has a cheaper-proof option described below. Track B does not — the AI spine must be built early because every other feature depends on the provenance schema.

### Track B ordering

1. **Weeks 1–3.** Phase B1 — provenance schema and API v1 skeleton. Must land before any Track A feature that writes to a cert-relevant field.
2. **Weeks 3–6.** Phase B2 — MCP server launch scope, running against B1's schema.
3. **Weeks 5–9** (overlaps B2). Phase B3 — evidence ingestion pipeline.
4. **Weeks 7–12.** Phase B4 — native RAG and BYO-model paths.

### Track A ordering

Do not start at Phase 1 by default. The cheapest high-leverage move is **Phase 2 first, then Phase 1 retroactively.**

Why:
- Phase 2 can be built against a local set of overrides without touching the app's token system yet. It is a public validation of the brand direction.
- If Phase 2 lands well, Phase 1 becomes a confident, focused change instead of a nervous one.
- If Phase 2 reveals that the accent should be forest instead of oxblood, the cost of reverting is one landing page, not an entire token system.

Sequence recommendation:

1. **Week 1.** Phase 0. Founder reviews the three documents (`vision-and-usp.md`, `ui-research.md`, `design-system.md`), revises them, and signs off. Parallel track: logo commissioning brief sent.
2. **Weeks 2–3.** Phase 2 landing rebuild, using local tokens. Ships behind a `?preview=new` flag first, then promoted to default.
3. **Week 4.** Phase 1 token consolidation. The tokens used in Phase 2 are extracted into the central token system.
4. **Weeks 5–7.** Phase 3 primitives.
5. **Weeks 8–11.** Phase 4 interior reskin.
6. **Weeks 12+.** Phase 5 module pages, ongoing.

This sequence front-loads the visible proof of the direction, de-risks the brand bet, and leaves the heavy engineering work (primitives + interior reskin) for a period where the direction is validated and motivation is high.
