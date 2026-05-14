# Design Review — Placeholders

The two placeholder pages violate the design system, the feature-flag doctrine, and the brand voice simultaneously. They are the cheapest design fix in the codebase: deleting them removes all three violations at once.

## 1. Violates `design-system.md` §1 north-star rule

> Every screen must directly advance the certification package. If a user action does not produce certification evidence, question why it exists.

The "Coming soon" cards on `/architecture` and `/reports` produce zero certification evidence, zero downstream artefact, zero objective progress. They are screens that **announce the absence of a feature**. By the north-star rule's own test ("Adding a feature? Name the certification artefact it produces. If none, do not build."), the route should not exist in the first place. Once it exists, the only legitimate next move is to delete it — not to redesign the placeholder.

## 2. Violates `design-system.md` §2.4 progressive disclosure

The principle: "The default view for any object shows the canonical happy-path action and up to two secondary actions." The placeholder shows zero actions. There is no happy path. The progressive-disclosure pattern assumes the page *has* a primary action that can be revealed to power users with more detail behind a disclosure trigger. A page whose primary action is "wait until next release" is the inverse of opinionated.

## 3. Violates `design-system.md` §5.4 empty-state voice

The empty-state copy guidance, verbatim from §5.4:

> Not "No requirements yet! Click the button above to get started. 🚀"
> Yes "No requirements. Start with a system-level requirement, or import from an existing baseline."

The current "Coming soon" copy on both pages — "The Architecture module is not yet implemented. Tracking for a future release — the current page is a placeholder and does not persist any input." — fits the "wrong" pattern. It speaks to the user as if they have wandered into a roadmap meeting, not as if they are an engineer trying to make progress. There is no named next action. There is no offered alternative. There is no DO-178C / ARP4754A artefact named that the user should look at instead.

## 4. Violates `.claude/kb/feature-flags.md` "hidden = non-existent"

From the KB:

> When a module is disabled, it must not appear anywhere:
> - Not in the sidebar
> - Not in the header mega-menu, module launcher, module drawer, or quick access bar
> - Not on the project landing page
> - Direct URL access silently redirects to project home (no locked/upgrade screen)
> - Not referenced in dropdowns, panels, or cross-link sections inside **other** visible pages
> The user experience should be indistinguishable from those features never having existed.

The placeholder pages explicitly tell the user the feature exists and is "tracked for a future release" — the opposite of the doctrine. A user who lands on `/projects/<id>/architecture` learns something they should not have learned: that the team has named the route, registered the page, and shipped a stub.

## 5. Visual treatment uses out-of-system colour tokens

Both pages use Tailwind `amber-50` / `amber-300` / `amber-700` / `amber-900` directly, with no mapping to the brand token map in `design-system.md` §3.1. The brand map reserves `status.warning` for `#B8860B` / `#D4A030` — the amber-like tokens are documented but the Tailwind shorthand is not the canonical reference. If the cards were to remain, they should use the `status.warning` semantic token and **not** the deep-amber Tailwind shades. The `<Hammer />` icon is similarly decorative — `design-system.md` §4 rule: "Every icon communicates state, action, or type. Icons that exist only to 'visually break up' a section are removed."

## 6. The `SafetyLinkPanel` on `/reports` is the only thing worth keeping

The button — `<SafetyLinkPanel variant="report-pack" ctaOnly />` — is a styled secondary button that opens the Safety Analysis page. It is the only piece of live functionality on either placeholder page. Per the README, it belongs on the Safety Analysis main page or the Documentation export surface, not as the lone live element of a "Coming soon" card. Migrating it costs nothing.

## Recommendation

Delete both pages. Delete both routes. Delete the two e2e specs. Migrate the `SafetyLinkPanel` to the Safety Analysis main page. The whole change is under 100 lines of removed code and zero lines of new design work.
