# Marketing & Legal — Public Surfaces Review

This package reviews every page a non-authenticated visitor can reach plus the in-app help docs. It is the **highest-leverage surface in Phase 2** of the roadmap because it is the first — and frequently only — impression an aerospace chief engineer forms of the product before they decide whether the rest is worth their afternoon.

## Surfaces covered

| Route | Component | Status |
|-------|-----------|--------|
| `/` (unauthenticated) | `LandingPage` + 8 sub-components | **Generic SaaS clone — full rebuild required** |
| `/login` | `LoginPage`, `LoginCard`, `AuthLayout`, `SecurityNote`, `CapsLockWarning` | Functional, banned-colour heavy |
| `/preview/landing` | `PreviewLandingPage` + 9 scoped sections | Brand-validation sample, CSS scoped, ahead of `/` |
| `/privacy` | `PrivacyPolicy` + `LegalLayout` | Adequate, voice off |
| `/terms` | `TermsOfUse` + `LegalLayout` | Adequate, voice off |
| `/help`, `/help/:slug` | `HelpLayout` + `helpRegistry` | In-app docs — separate sweep |

## Current state — the short version

The landing page is the exact composition `ui-research.md` §5 catalogues as the AI-slop tell list. Six AI-slop patterns are present simultaneously: a purple-to-blue gradient backdrop, the placeholder SVG hero card, an Inter-default typeface, a three-column Lucide-icon-and-paragraph feature grid, a placeholder "Contact us" pricing section, and the corporate-AI vocabulary `ui-research.md` §6 names as credibility-destroying: "demand rigor", "audit readiness", "enterprise-grade", "comprehensive", "end-to-end", "unified platform".

The grep results from `improvements/marketing-legal/` Phase 2 scan:
- **6 banned-list words** in `frontend/src/components/landing/*.tsx`: rigor (1), unified (1), comprehensive (2), end-to-end (1), enterprise-grade (1). The hero subhead alone uses two ("demand rigor", "audit readiness").
- **15 `blue-*` utility classes** across hero, navbar, feature card, security cards, FAQ focus ring, module bullets.
- **2 gradient backdrops** — one on `LandingPage` itself, one in the hero SVG card.
- **1 placeholder SVG** that pretends to be a product screenshot.
- **0 named standards anywhere** in any landing-page copy (no DO-178C, no DO-254, no ARP4754A, no DAL, no MoC, no PSAC).
- **0 named adversaries** (no DOORS, Jama, Codebeamer reference in body copy).
- **0 dual-CTA pattern** (per `ui-research.md` §6 universal hero pattern).

There is no positioning, no compliance badge strip, no named customer industry, no editorial voice. The landing as shipped today reads as "I used a Tailwind template" — the exact register `vision-and-usp.md` §1 frames as the credibility killer for aerospace buyers.

## Target state — `roadmap.md` Phase 2

`roadmap.md` Phase 2 prescribes a full rebuild. The `/preview/landing` route already proves out the direction with scoped CSS — `Hero.tsx` ships the **"Certify in months. Not years."** display heading and a traceability matrix mock above the fold, the **`StandardsStrip`** ships the DO-178C / DO-254 / ARP4754A / DO-326A compliance badges, and `Numbers.tsx` ships concrete time-to-value claims. The Phase 2 task is to promote that scaffolding to the canonical `/` route, replace the placeholder traceability matrix with a real product screenshot of the objective-completion matrix per `design-system.md` §8.2, and apply the design tokens from `design-system.md` §3.

Target hero copy is fixed by `vision-and-usp.md` §12 three-second elevator pitch:
> Certify in months. Not years.
> Requirements, verification, and audit evidence — built around DO-178C, not around ALM. Built for human-AI teams, not for AI autonomy.

Target subhead pattern is from `ui-research.md` §6: two-clause, fast claim plus credibility claim. Target CTA pairing is "Start free" plus "Talk to an engineer" (the role name matters per `ui-research.md` §6 dual-CTA note). Target compliance-badge strip lives directly below the hero, not in the footer.

## What this package contains

- **`README.md`** — this file. Purpose, current state, target state.
- **`frontend.md`** — per-component review of the eight landing sub-components, login, and the preview landing reference implementation, scored against `design-system.md` §3 tokens and `ui-research.md` §5 anti-patterns.
- **`backend.md`** — short. Public surfaces are mostly static; the only backend touched is `auth.routes.ts` for the login flow plus the password-reset endpoint.
- **`design-review.md`** — landing UX audit against `ui-research.md` AI-slop patterns and `design-system.md` §5 copy doctrine. Section-by-section critique, with the kill-list violation count cited.
- **`tickets.md`** — actionable tickets aligned one-to-one with `roadmap.md` Phase 2 "Concrete replacements": LandingHero rebuild, FeaturesSection editorial alternating layout, ModulesSection narrative walkthrough, PricingSection real-or-remove decision, SecuritySection compliance badges, FAQAccordion aerospace-buyer questions, LandingFooter minimal, plus the cross-cutting design-token migration and copy kill-list sweep.

## Reading order

For a strategy review: read this file plus `design-review.md`.
For an engineering kickoff: read `tickets.md`.
For component-level decisions: read `frontend.md`.
For the legal pages: skim `frontend.md` §Legal — they are adequate.
