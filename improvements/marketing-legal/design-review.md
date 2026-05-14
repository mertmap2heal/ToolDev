# Marketing & Legal — Design Review

Audit of the public landing surface against `ui-research.md` §5 (AI-slop patterns), `design-system.md` §3 (tokens), and `design-system.md` §5 (voice doctrine). Section-by-section, with each pattern named and counted. This is a public-facing surface critique — the engineering implications are in `frontend.md`, the tickets are in `tickets.md`.

---

## The five-second test

`ui-research.md` §1 frames the problem in five seconds: a Baymard-style scanning test takes three to five seconds to categorise a product as "generic SaaS dashboard", at which point the visitor stops reading.

The current `/` route fails the five-second test on every dimension `ui-research.md` §5 catalogues:

| AI-slop pattern from `ui-research.md` §5 | Present at `/`? | Where |
|------|------|---|
| Default Inter font | Yes — inherited from app | All landing components |
| Tailwind `blue-600` accent | Yes — 15 utility-class hits | Navbar, hero, feature cards, security cards, FAQ ring, modules bullet |
| Purple-to-blue gradient hero | Yes (variant — gray gradient + blue hero SVG) | `LandingPage.tsx:15`, `LandingHero.tsx:48-71` |
| Uniform `rounded-lg` everywhere | Yes | Every card |
| 3-column icon + title + body feature grid | Yes — explicit copy of the anti-pattern | `FeaturesSection.tsx` |
| Lucide icons at uniform size | Yes — 20+ icons at `size={18}` or `size={20}` | Module grid, security cards |
| Stock illustration ("floating cards") | Yes — the hero SVG | `LandingHero.tsx:51-71` |
| Sparkles ✨ for AI features | No — but only because there are no AI features mentioned | Anti-pattern by omission |
| Vague copy: "Built for teams that demand rigour" | Yes — literal phrasing | `LandingHero.tsx:26` |
| Empty pricing "Contact us" | Yes — entire section | `PricingSection.tsx` |
| Corporate-AI register | Yes — six kill-list words | See §"Voice violations" below |

Eleven out of eleven of the `ui-research.md` §5 anti-patterns are present in some form. The page is, in `925 Studios` terminology, AI-slop.

---

## Hero — what an aerospace chief engineer reads in five seconds

The current hero communicates one thing: "this is a SaaS dashboard." It does not communicate the segment, the problem, the category reframe, or the named adversary — the four pieces `vision-and-usp.md` §6 lists as load-bearing for the positioning statement.

The display heading is "Enterprise engineering lifecycle management." Six words, all generic, naming no industry, no standard, no adversary. The subhead — "Requirements, traceability, verification, and compliance—all in one place. Built for teams that demand rigor and audit readiness." — contains *two kill-list words in one clause* (`demand`, `rigor`) and the kill-list phrase `audit readiness`. The visual element is a stock SVG of floating cards with a blue gradient — the `ui-research.md` §4 "the floating-cards-with-gradient cliché" verbatim.

`vision-and-usp.md` §12 provides the three-second elevator pitch for the hero. It exists, written, signed off, and ready:

> **Certify in months. Not years.**
> Requirements, verification, and audit evidence — built around DO-178C, not around ALM. Built for human-AI teams, not for AI autonomy.

That copy passes the five-second test on every dimension:
- **Verb-first imperative** per `ui-research.md` §6 hero formulas: *"Certify"* is the verb, *"in months"* is the qualifier. The Vercel-style "Develop. Preview. Ship." pattern.
- **Named standard** per `design-system.md` §5.2: "DO-178C" appears in the subhead. Concrete, not generic.
- **Contrarian naming the incumbent category** per `ui-research.md` §6: *"built around DO-178C, not around ALM"* — names ALM as the wrong category and reframes ours.
- **Two-clause subhead** per `design-system.md` §5.3: fast claim ("in months not years"), credibility claim ("built around DO-178C, not around ALM").

The hero copy is not the problem. The decision to ship it is.

---

## Features section — three-column-icon-grid by the book

`ui-research.md` §5 names this anti-pattern in literal words: *"3-column icon + title + body feature grid — Every Tailwind template. Fix: Editorial alternating layout with real screenshots."*

The current section ships six tiles. Each tile is a `bg-blue-50` 40px icon plate plus a generic two-sentence description. The descriptions are interchangeable with any incumbent's. "Manage requirements with full traceability from stakeholder needs through verification evidence" is a sentence I can write about Jama, Polarion, Codebeamer, DOORS, IBM ETM, Helix RM, or Cradle. It is not a sentence about *us*. It does not earn us a single byte of credibility.

`design-system.md` §5.3 sentence-pattern doctrine: *"Concrete nouns over abstract nouns. 'DO-178C Table A-3 objectives' not 'applicable compliance objectives.'"* The current section uses zero concrete nouns. No named standard, no named artefact, no named verb beyond the generic "manage" and "track."

The intro sentence — *"A unified platform for engineering lifecycle management with traceability, change control, and audit readiness"* — contains two kill-list violations (`unified`, `audit readiness`) and uses the phrase "engineering lifecycle management" which is the category `vision-and-usp.md` §6 explicitly disavows.

**The fix shape is fixed by the roadmap.** Editorial alternating layout. Five sections, each a full-width row with screenshot on one side and concrete benefit copy on the other. Named standards, named artefacts, named verbs. See `tickets.md` §2 for the structure.

---

## Modules section — the incumbent trap

`roadmap.md` Phase 2 names this section's problem explicitly: *"Listing every module is an incumbent-style 'feature matrix' move."*

The procurement-shaped argument is in `_shared/competitor-matrix.md` §10: we score ~22 native capabilities today versus Jama's ~50 and Polarion's ~52. A 20-module grid invites the comparison on the exact axis where we will lose. The strategic frame from `vision-and-usp.md` §7: *"Certification-native and AI-native. Not ALM-adapted, not AI-bolted-on."* That frame survives comparison only if we keep the conversation on architecture, not on feature count.

There is a second, more subtle problem. The current module list contains items that are mock-data only — Risk Management, Interface Management, Safety Analysis, parts of Documentation (per `_shared/inventory.md` §"Pages with no service imports"). Listing them as if they were shipping capabilities is dishonest. An aerospace buyer who signs up, clicks "Safety Analysis", and sees a persistent demo banner is a buyer who lost trust on day one. Per `vision-and-usp.md` §13 *"What must be true for this positioning to survive contact with the market"* — credibility is the load-bearing claim, and it cannot be casually traded for a more impressive-looking landing page.

**The fix.** Replace with a narrative walkthrough of one full certification loop, five panels, one screenshot per panel. Per `roadmap.md` Phase 2: *"Prefer a narrative walkthrough of one full certification loop."* See `tickets.md` §3.

---

## Pricing section — "Contact us" is worse than nothing

`ui-research.md` §4 NN/G enterprise-trust unlocks lists hidden pricing as a credibility-destroyer:

> *"Hidden pricing (signals 'too expensive to say'). Gating product info behind a login. Only one contact channel. No named-customer testimonials. No founder or team photos. Requiring a credit card for a 'free' trial."*

The current section ships hidden pricing *and* the only contact channel is a `mailto:contact@company.com` placeholder *and* there are no named customers *and* there are no team photos. Four of six enterprise-trust unlocks failed in twelve lines of code.

`vision-and-usp.md` §4 ICP procurement posture: *"Self-serve first touch, enterprise contract on expansion. Can decide to buy within a week, not a quarter."* The current pricing section enforces the opposite — sales-led, contact-required, no self-serve path. That is the Jama Connect motion (cited in `_shared/competitor-matrix.md` §0 as "Quote-only; slow response cited in reviews"). It is the motion we exist to escape.

**The decision is binary.** Real pricing or no section. `roadmap.md` Phase 2 is explicit: *"either real pricing or remove. Placeholder 'Contact us' is worse than nothing."*

The founder decision unblocks the ticket. The designer decision does not.

---

## Security section — RBAC is not the story

The four cards (RBAC, Audit Logs, Traceability, Export & Import) are all table-stakes per `_shared/competitor-matrix.md`. Every competitor in the matrix ships them. Leading the security story with these four claims signals we believe they are differentiators — which makes us look naive.

`ui-research.md` §6 trust-placement doctrine: *"Compliance badges strip immediately below hero: DO-178C, ISO 26262, IEC 62304, SOC 2 Type II."* The badges are the social proof. The cards are the deep-dive — and the deep-dive belongs on a dedicated `/trust` page per `roadmap.md` Phase 8, not on the landing.

**Three kill-list violations** in four sentences: `comprehensive` (twice — security card + modules intro), `end-to-end` (security card), `enterprise-grade` (security intro). That violation density is the corporate-AI register `design-system.md` §5.1 names as the incumbent-speak we are trying to escape.

**The fix.** Replace the four-card grid with a compliance-badge strip directly under the hero, plus a one-line "Read the trust posture →" link to `/trust` (stubbed if Phase 8 hasn't landed). Until DO-178C tool qualification is attested, the badge wording is honest: *"DO-178C tool-qualification path: in progress, target Q3 2026."* See `tickets.md` §5.

---

## FAQ section — wrong questions for the buyer

The accordion shell is well-built. The questions are wrong.

A real aerospace chief engineer landing on this page has the following questions, in approximate priority order:

1. Do you support DAL A?
2. What's in the exported PSAC, and who has cryptographically signed off on it?
3. Do you ReqIF round-trip with DOORS so I can migrate?
4. Can the AI features run against my own Azure OpenAI key (BYOK)?
5. What's the tool-qualification path?
6. Can we self-host?
7. How does the audit trail of AI-touched artefacts work under EASA Level 2A?
8. If we cancel, do we get our requirements out?

The current FAQ answers none of these. The current FAQ answers: scope, RBAC, integration, deployment, support, pricing. Those are the questions a generic SaaS evaluator asks. They are not the questions an aerospace buyer asks. Answering them does not build credibility with the ICP.

`roadmap.md` Phase 2: *"rewrite questions to be questions a real aerospace buyer asks."* The list above is the starting point.

---

## Voice violations — the kill-list audit

Per `design-system.md` §5.1 kill-list, the following words never appear in product or marketing copy:

> *rigour, robust, leverage, unified, structured workflows, audit readiness, demand, empower, holistic, comprehensive, end-to-end, best-in-class, enterprise-grade, mission-critical, streamline, accelerate, seamless, synergy, solution, unlock, supercharge, supercharged, revolutionise, game-changing, transform, transformative.*

Grep results on `frontend/src/components/landing/`:

| Word | Hits | File · line |
|------|-----:|-----|
| `rigor` | 1 | `LandingHero.tsx:26` ("demand rigor") |
| `demand` | 1 | `LandingHero.tsx:26` |
| `unified` | 1 | `FeaturesSection.tsx:51` |
| `comprehensive` | 2 | `SecuritySection.tsx:12`, `ModulesSection.tsx:81` |
| `end-to-end` | 1 | `SecuritySection.tsx:17` |
| `enterprise-grade` | 1 | `SecuritySection.tsx:33` |
| `audit readiness` | 2 | `LandingHero.tsx:26`, `FeaturesSection.tsx:51` |
| **Total** | **9** | (some words count once even when "audit readiness" co-occurs with `audit readiness` and `rigor`) |

Six unique kill-list words, nine total occurrences across four files. Every public-facing landing component except `LandingNavbar`, `FeatureCard`, `PricingSection`, `FAQAccordion`, and `LandingFooter` ships at least one kill-list violation.

`roadmap.md` Phase 6 prescribes the sweep: *"`rg -w \"rigor|robust|leverage|unified|streamline|seamless|empower|holistic|comprehensive|synergy|mission-critical\"` returns zero hits in `frontend/src/` and `backend/src/`."* The Phase 2 landing rebuild starts that sweep on the highest-visibility surface.

---

## What the page is missing

Beyond what is broken, two things are absent that the `ui-research.md` §6 positioning patterns identify as load-bearing:

**Named adversaries.** `vision-and-usp.md` §6 positioning statement: *"Unlike DOORS, Jama, and Codebeamer, which were built as generic ALM platforms and later fitted with certification plug-ins, every object in this tool is shaped by the certification objective it serves."* The current landing does not name DOORS, Jama, or Codebeamer anywhere. Buyers compare. Stand in the comparison.

**Named customer industries.** Per `ui-research.md` §6: *"Named customer industries when regulated: 'Trusted by aerospace, medical device, and automotive teams.'"* Pre-launch we have no customers — fine. But the segment is namable: "Built for small aerospace and defence teams" beats "built for teams that demand rigor" on every dimension that matters.

---

## Summary

The landing fails the five-second test on eleven of eleven AI-slop dimensions per `ui-research.md` §5. The copy contains six unique kill-list words across four files. The hero copy that would fix it already exists at `/preview/landing`. The structural rebuild is fixed by `roadmap.md` Phase 2. The decisions outstanding are: product name (Phase 0), real pricing or remove (founder), and one screenshot of the objective-completion matrix (Phase 4.3 dependency or high-fidelity mock).

The actionable tickets are in `tickets.md`.
