# Agentic Workflow — One Ticket at a Time

A role-based, gated pipeline for executing the tickets in `improvements/<package>/tickets.md` against the sequencing in `improvements/ROADMAP-phase3.md`. Each ticket moves through ordered stages; each stage has a named role, a defined output, and a human approval gate before the next stage starts.

## 1. Principles

1. **One ticket fully shipped before the next begins** (per stream). A ticket is "shipped" only when the PR is merged, the e2e spec is green, and `tickets.md` is annotated `Shipped — <commit-hash>`. Half-finished tickets do not advance.
2. **Each stage has one role and one artefact.** No role does work outside its remit. The artefact is checked into git or written to the GH issue thread so the next role can audit upstream decisions.
3. **Human gates between every stage.** The orchestrator does not silently advance. The PM (you) approves transitions explicitly. Auto-advance is the failure mode that produced the audit-package drift we built this product to fix; refuse it here too.
4. **Cross-cutting refactors gate dependent tickets.** A ticket whose `R-Wave deps` column in ROADMAP-phase3.md is not satisfied stays in Backlog until the dependency lands. The orchestrator refuses to advance a ticket whose deps are unmet.
5. **All work via GitHub Issues + branches.** No floating spreadsheets, no untracked design notes. Discoverable from any reviewer's `gh issue list`.
6. **Tickets cite ROADMAP, cross-cutting, gap-summary, and competitor-matrix on the way in.** This is the audit trail that justifies the work.

---

## 2. Roles

Nine roles. Each invoked as a Claude sub-agent with the prompt pattern in §6.

### 2.1 Project Manager (PM) — `role/pm`

**Owns.** The ticket intake-to-close lifecycle. Opens GH issues. Assigns labels. Enforces gates. Updates `tickets.md` status.

**Reads.** `ROADMAP-phase3.md`, target package's `tickets.md`, `_shared/cross-cutting.md`, `_shared/gap-summary.md`.

**Writes.** GH issue with the ticket's full body + AC + dependency list. Labels: `package/<name>`, `effort/<S|M|L>`, `wave/<R|N|NX|L>`, `role-needed/<next>`. Updates `tickets.md` to mark status (`Backlog → In Architecture → In Design → In Dev → In Review → In QA → Shipped`).

**Refuses.** Tickets whose R-Wave deps are unmet. Tickets without an acceptance criterion. Tickets contradicting `vision-and-usp.md` §9 omissions.

**Tooling.** `gh issue create`, `gh issue edit`, `gh issue comment`, `gh label`.

### 2.2 Architect — `role/architect`

**Owns.** The "is this still the right move" decision. Translates the ticket into an implementation approach that conforms to the cert-native architecture.

**Reads.** Ticket body + AC + `_shared/cross-cutting.md` + `vision-and-usp.md` + `ai-ready-vision.md` + the affected `backend/prisma/schema.prisma` lines + the affected route/service/page files (read-only, via Explore agent if breadth > 3 files).

**Writes.** An `architecture.md` comment on the GH issue (~400-800 words) containing:

- **Approach.** 3-6 bullets describing the schema migration, service shape, controller shape, frontend integration.
- **Files touched.** Explicit list with line ranges.
- **Cross-cutting interactions.** Which `R-N` refactors does this touch; which `cross-cutting.md` entries get refined or appended.
- **Out of scope.** Explicit "not in this ticket" list.
- **Risk + mitigation.** One paragraph on the riskiest aspect.
- **Decision.** `Proceed | Block on <dep> | Reshape — see comment | Reject — out of scope`.

**Gates.** PM approves the architecture comment before any code is written. If the Architect flags a missing R-Wave dep, PM moves the ticket to `Blocked` and surfaces the dep as a new ticket.

### 2.3 UI/UX Designer — `role/designer`

**Owns.** Any visible UI surface in the ticket. Component shape, density, copy, empty / loading / error states, keyboard map, a11y. Conformance to `design-system.md`.

**Invoked when.** Ticket affects a `.tsx` file in `frontend/src/`. Skipped for backend-only tickets.

**Reads.** Ticket body + Architect's approach + `design-system.md` + `ui-research.md` + the affected page's current `frontend.md` + `design-review.md` from the package + the related cross-cutting entries (brand-token migration, "Coming soon", layout primitive, objective matrix).

**Writes.** A `design.md` comment on the GH issue (~300-600 words) containing:

- **Surface inventory.** Every page / drawer / modal / toast the ticket touches.
- **Layout decisions.** Citing `design-system.md` §-numbers. No new variants unless justified.
- **Copy.** Exact strings for empty / loading / error / button label. Passes the `design-system.md` §5.1 kill-list.
- **Keyboard map.** Per cross-cutting `Keyboard-first shortcuts are absent`.
- **A11y notes.** Focus order, aria labels, contrast.
- **Reuse audit.** Which existing component is being reused; what new component (if any) is being introduced and why.

**Gates.** PM approves before Dev starts. If a new shared component is introduced, the Architect re-approves.

### 2.4 Fullstack Developer — `role/dev`

**Owns.** The diff. Schema migration → service → controller → route → frontend hook → component → unit test → e2e test.

**Reads.** Architect's `architecture.md`, Designer's `design.md` (if present), package `tickets.md`, the relevant `kb/*.md` files (`backend-patterns.md`, `react-typescript.md`, `playwright-e2e.md`).

**Writes.** A feature branch named `<wave>/<ticket-id>-<short-slug>` (see §5). PRs follow conventional commits per `.claude/git-workflow.md`. Tests live alongside the change per `.claude/testing.md`.

**Constraints.**

- Must follow `.claude/rules.md` §1 (infrastructure lock), §2 (no new deps without permission), §3 (never downgrade), §4 (never delete data), §10 (minimal changes — no scope creep), §11 (security baseline).
- Every backend change uses the singleton Prisma client per `kb/backend-patterns.md`.
- Every frontend change uses tokens, not `blue-*` / inline styles, per the R-9 ESLint rule (once landed).
- Every cert-relevant write must populate the provenance lattice once R-1 lands.
- Updates the corresponding `tickets.md` entry inline: changes status, appends a `Shipped — <hash>` note pointing at the commit that closes the ticket.

**Gates.** PR opened against `dev` (per `git-workflow.md`). Reviewer + Security Reviewer + QA approve before merge.

### 2.5 Code Reviewer — `role/reviewer`

**Owns.** The "does this diff actually do what the AC says, and does it conform to the rules" verdict. Independent of the Dev — never the same Claude agent invocation.

**Reads.** The PR diff (`gh pr diff`), the GH issue body, the Architect's + Designer's comments, `_shared/cross-cutting.md` entries the ticket cited.

**Writes.** A `review.md` comment on the PR (~200-500 words):

- **AC verification.** Quote each acceptance criterion from `tickets.md`; mark `Met / Partial / Missing / Unverifiable`.
- **Rule conformance.** `.claude/rules.md` items 1-12 — flag any violation by §-number.
- **Cross-cutting drift.** Did this PR re-state a finding in `_shared/cross-cutting.md` instead of fix it? Cite which.
- **Code quality.** Strict file:line citations for any concern. Imperative ("rename X to Y", not "consider renaming").
- **Verdict.** `Approve | Request changes | Reject — out of scope`.

**Gates.** Approve required to advance to QA. Request-changes returns the ticket to `role/dev` with no penalty.

### 2.6 Security Reviewer — `role/security`

**Owns.** Tenant scoping. Auth. CFR 21 Part 11 signature integrity. Provenance audit. Soft-delete on regulated artefacts.

**Invoked when.** Ticket touches `auth.*`, `*signOff*`, `requireAdmin`, `req.body.<id>` fields, MCP, AI credentials, AI invocation, baseline, multi-tenant data, audit log, or any ticket labelled `security`.

**Reads.** PR diff + GH issue + `.claude/rules.md` §11 + `kb/backend-patterns.md` "Authentication Middleware" + the three SEC findings in `ROADMAP-phase3.md` §0 + the cross-cutting entries on tenant leaks and signature primitive.

**Writes.** A `security.md` comment on the PR (~200-400 words):

- **Threat model.** What does this endpoint expose; who can call it; under what scope.
- **Tenant scope.** Confirm `projectId` / `companyName` filtering on every read. `requireAdmin` is not a tenant filter — flag any reliance on it.
- **Signature integrity.** Confirm any signing event derives signer from `req.user`, not `req.body.signerId`.
- **Provenance.** Confirm `authorType` is populated on every write once R-1 lands.
- **Audit log.** Confirm a `<module>:<kebab-action>` row writes to the central `AuditLog` per the convention emerging from R-8.
- **Verdict.** `Approve | Block on security defect — cite line`.

**Gates.** Approve required to merge for any in-scope ticket. Block-on-security takes priority over all other reviewer verdicts.

### 2.7 QA / E2E — `role/qa`

**Owns.** The "is this verifiable by a real test" gate. Updates or writes the matching Playwright spec per `.claude/kb/playwright-e2e.md` and `.claude/testing.md`. Runs the spec. Runs the backend Vitest suite. Visual spot-check via Playwright trace or screenshot.

**Reads.** Ticket AC, PR diff, the relevant `frontend/e2e/<NN>-<feature>.spec.ts`, `.claude/kb/playwright-e2e.md`.

**Writes.** Updated `*.spec.ts` (committed to the PR). A `qa.md` comment on the PR:

- **Test plan.** New spec coverage; affected existing specs.
- **Run result.** `cd frontend && npx playwright test <spec>` + `cd backend && npm test` output (truncate to last 30 lines).
- **Type check.** `cd frontend && npx tsc --noEmit` + `cd backend && npx tsc --noEmit` results.
- **Lint.** `cd frontend && npm run lint` result.
- **Manual verification** (when applicable). 3-5 bullet "I clicked X, I saw Y."
- **Verdict.** `Pass | Fail — cite spec line`.

**Gates.** Pass required to merge. Fail returns to Dev with the failing trace attached.

### 2.8 Doc Writer — `role/doc`

**Owns.** `tickets.md` status update. `kb/*.md` updates when a convention or pattern emerges. User manual entry if the ticket affects a user-visible page.

**Invoked when.** PR is merged.

**Reads.** Merged commit + GH issue thread + the package's `tickets.md` + `kb/user-manual-standards.md`.

**Writes.**

- Patch the corresponding ticket entry in `tickets.md` from `In QA` → `Shipped — <commit-hash>` with a one-line resolution note.
- Append to `kb/<relevant>.md` if a new pattern was established (e.g., the tenant-scope rule after SEC-1 lands, the audit-log convention after R-8 first move lands).
- Add a user manual page under `docs/user-manual/` if the ticket added or changed a user-facing surface (see `kb/user-manual-standards.md`).

**Gates.** PM closes the GH issue only after Doc has signed off.

### 2.9 Release Manager — `role/release`

**Owns.** Branch hygiene. Merge to `dev`. Sync `master` from `dev` when a milestone is hit. Tag releases.

**Reads.** Open PRs, `git-workflow.md`, the package's `tickets.md` for "Shipped" status.

**Writes.** Merges PR into `dev` via `gh pr merge --merge` (preserve merge commit so the GH issue link survives). Periodically cuts `chore(release): vX.Y.Z` PRs from `dev` to `master`. Pushes tags.

**Gates.** Will not merge a PR missing any of: Reviewer Approve, Security Approve (if applicable), QA Pass, Doc plan.

---

## 3. Pipeline — eight stages, one ticket

```
┌─────────────┐   ┌───────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
│  1. Intake  │──▶│ 2. Arch   │──▶│ 3. Design│──▶│ 4. Dev   │──▶│ 5. Review│──▶│ 6. Sec   │──▶│ 7. QA    │──▶│ 8. Close │
│  role/pm    │   │ /architect│   │ /designer│   │ /dev     │   │ /reviewer│   │ /security│   │ /qa      │   │ /doc+pm  │
└─────────────┘   └───────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
       │                │              │              │              │              │              │              │
       ▼                ▼              ▼              ▼              ▼              ▼              ▼              ▼
   GH issue       arch comment    design comment   feature branch  review.md     security.md     qa.md +     tickets.md
   + labels       on issue        on issue         + draft PR      on PR         on PR           green CI    Shipped +
                                  (skip if         ──────────── PR opened ─────────────────►                 issue close
                                   backend only)                                                              + kb update
```

**Gates between stages:** PM must explicitly invoke the next role with `proceed: true` for the ticket to advance. The orchestrator never auto-advances.

**Stage 3 is conditional.** Backend-only tickets (e.g., SEC-1, R-2, schema migrations) skip Design; ticket label `surface/backend-only` controls this.

**Stages 5 + 6 run in parallel.** Code review and security review can land independent comments; both must Approve before Stage 7.

---

## 4. GitHub Issues — schema

### 4.1 One issue per ticket

Issue title format: `[<wave>/<id>] <one-line summary>`

Examples:
- `[SEC-1] AiInvocation cross-tenant leak via requireAdmin`
- `[R-1] Universal provenance lattice on cert-relevant tables`
- `[N-2/Verification/V-NT-1] xUnit/JUnit/Robot test-result parsers`

### 4.2 Issue body

PM populates from `improvements/<package>/tickets.md`. Required sections:

```
## Source
improvements/<package>/tickets.md §<section> — line link

## Wave
<R | N | NX | L> per ROADMAP-phase3.md

## Effort
<S | M | L>

## Dependencies
- R-Wave: <list or "none">
- Other tickets: <list or "none">
- Schema: <list of Prisma models touched>

## Acceptance criteria
<verbatim from tickets.md>

## Cross-cutting refinements expected
<which cross-cutting.md entries this is expected to refine or close>

## Out of scope
<explicit list>

## ROADMAP linkage
<paste the ROADMAP-phase3.md row that contains this ticket>
```

### 4.3 Labels

| Family | Examples |
|---|---|
| `package/*` | `package/requirements`, `package/verification`, ... (14 total) |
| `wave/*` | `wave/R`, `wave/N`, `wave/NX`, `wave/L` |
| `effort/*` | `effort/S`, `effort/M`, `effort/L` |
| `surface/*` | `surface/backend-only`, `surface/frontend-only`, `surface/fullstack`, `surface/schema-only` |
| `status/*` | `status/backlog`, `status/in-architecture`, `status/in-design`, `status/in-dev`, `status/in-review`, `status/in-qa`, `status/blocked`, `status/shipped` |
| `security` | when Security Reviewer must be invoked |
| `cross-cutting` | when a cross-cutting refactor (R-1..R-11) is the parent |
| `blocked-by/*` | dynamic — points at another issue # |

### 4.4 Per-stage comments

Each role writes one canonical comment. Naming convention so they sort visually:

```
1️⃣ Intake (PM)
2️⃣ Architecture (architect)
3️⃣ Design (designer)
4️⃣ Implementation — PR #N
5️⃣ Code review (reviewer)
6️⃣ Security review (security)
7️⃣ QA (qa)
8️⃣ Close (doc + pm)
```

Use a leading numbered emoji or `Stage <N>:` prefix so reading the issue top-to-bottom recovers the lifecycle.

---

## 5. Branch + commit conventions

Per `.claude/git-workflow.md`, with one tightening:

### 5.1 Branch name

`<wave>/<ticket-id>-<short-slug>`

Examples:
- `fix/SEC-1-aiinvocation-tenant-scope`
- `feat/R-1-provenance-lattice`
- `feat/N-2-V-NT-1-xunit-parsers`

The `<wave>` prefix maps to the conventional-commit `<type>`:

| Wave | Type |
|---|---|
| `SEC-*` | `fix` |
| `R-*` (refactor) | `refactor` for pure restructure; `feat` if it adds a primitive |
| `N-*`, `NX-*`, `L-*` | `feat` if it adds capability; `fix` if it closes a defect |
| `chore/*` (sunset, cleanup) | `chore` |

### 5.2 Commit message

`<type>(<scope>): <summary>` — max 72 chars summary.

Body explains WHY, cites the GH issue (`Closes #<n>`), cites the ROADMAP entry, and includes the AI Co-Authored-By trailer per `.claude/git-workflow.md`.

### 5.3 PR title and body

PR title = primary commit summary. PR body required sections:

```
## Summary
2-5 bullets.

## Closes
- Closes #<issue>
- Refines cross-cutting: <list or "none">

## Test plan
Bulleted markdown checklist; QA fills in run results in a comment.

## Risk
1-3 sentences.
```

PR base branch is `dev`; never `master` directly.

---

## 6. Sub-agent invocation patterns

Each role is invoked through the Agent tool with a fixed prompt skeleton. The orchestrator (you, in the main Claude Code session) writes these.

### 6.1 PM — intake

```
Agent({
  description: "Intake <ticket-id>",
  subagent_type: "general-purpose",
  prompt: `
    Role: project-manager.

    Task: open a GH issue for ticket <id> from improvements/<package>/tickets.md.

    Read:
    - improvements/<package>/tickets.md (find the ticket)
    - improvements/ROADMAP-phase3.md (find the ticket's wave and dependencies)
    - improvements/_shared/cross-cutting.md (look for related entries)
    - improvements/_shared/gap-summary.md (look for related gap)

    Verify gates:
    - R-Wave deps satisfied? If not, return "Blocked by <dep>" and do NOT open the issue.
    - Acceptance criteria present? If not, return "Refuse — no AC".
    - Conflicts with vision-and-usp.md §9 omissions? If yes, return "Refuse — omission".

    If gates pass:
    1. Build the issue body using the §4.2 template.
    2. Run: gh issue create --title "[<id>] <summary>" --body "<body>" --label "package/<x>,wave/<y>,effort/<z>,surface/<w>,status/backlog"
    3. Output the issue URL.

    Constraints: no source-code changes. No edits to other files except tickets.md (set status to in-architecture and append issue link).
  `
})
```

### 6.2 Architect — review

```
Agent({
  description: "Architecture review <ticket-id>",
  subagent_type: "general-purpose",
  prompt: `
    Role: architect.

    Task: produce the architecture comment for GH issue #<n> (ticket <id>).

    Read:
    - The GH issue: gh issue view <n>
    - improvements/<package>/tickets.md (the ticket body and AC)
    - improvements/_shared/cross-cutting.md (full file)
    - improvements/vision-and-usp.md, ai-ready-vision.md
    - The Prisma models the ticket touches (use Grep against schema.prisma; do NOT Read schema.prisma in full)
    - The route/controller/service files (Glob first, then targeted Reads)

    Write: an architecture comment to the issue using the §2.2 structure.

    Run: gh issue comment <n> --body "<architecture-md>"

    Verdict: Proceed | Block on <dep> | Reshape | Reject.

    Constraints: no source-code changes. No Read of files larger than 1000 lines without offset/limit.
  `
})
```

### 6.3 Designer, Dev, Reviewer, Security, QA, Doc — same shape

Same skeleton, different role + Read + Write contracts per §2. Spell out exactly which files to read, what artefact to produce, what verdict format to use.

### 6.4 Orchestrator loop (the human or a meta-agent)

```
Pick next ticket from ROADMAP-phase3.md "Now" bucket
  ↓
Invoke role/pm with the ticket id
  ↓ wait for issue URL + AC verification
APPROVE? → yes → Invoke role/architect
                  ↓ wait for architecture comment + Proceed verdict
                APPROVE? → yes → If surface != backend-only: Invoke role/designer
                                            ↓ wait for design comment
                                          APPROVE? → yes → Invoke role/dev
                                                              ↓ wait for draft PR
                                                            Invoke role/reviewer AND role/security in parallel
                                                              ↓ wait for both Approve
                                                            Invoke role/qa
                                                              ↓ wait for Pass
                                                            Invoke role/release (merge)
                                                              ↓ wait for merged
                                                            Invoke role/doc
                                                              ↓ wait for tickets.md update + kb update
                                                            PM closes GH issue
```

No stage auto-advances. Every "APPROVE?" is the human's explicit `proceed: true`.

---

## 7. Worked example — SEC-1 lifecycle

The first ticket out of the gate, per `ROADMAP-phase3.md` §0.

**Stage 1 — Intake.** PM agent reads `improvements/admin-platform/tickets.md` for `AP-S1`, opens issue:

```
Title: [SEC-1] AiInvocation cross-tenant leak via requireAdmin
Body: (per §4.2 template)
Labels: package/admin-platform, wave/SEC, effort/S, surface/backend-only, security, status/backlog
```

PM also patches `improvements/admin-platform/tickets.md`: `AP-S1 — Status: In Architecture — Issue #<n>`.

**Stage 2 — Architecture.** Architect agent reads issue, `aiInvocation.routes.ts:7-8`, the `mcpKey.routes.ts:13-18` HIGH-2 comment (the correctly-protected sibling), `AdminRole` Prisma model, `cross-cutting.md` entry "`AiInvocation` ledger leaks cross-tenant". Writes:

```
## Approach
- Split into two endpoints:
  - GET /admin/ai/invocations — require SUPERIOR_ADMIN explicitly (raise the gate).
  - GET /admin/ai/invocations/company — require COMPANY_ADMIN; filter by req.user.company joined through AiInvocation.projectId → Project.companyName.
- Add a kb/backend-patterns.md entry codifying the rule.
- No schema change.

## Files
- backend/src/routes/aiInvocation.routes.ts (8 lines)
- backend/src/controllers/aiInvocation.controller.ts (~30 lines)
- .claude/kb/backend-patterns.md (append "Tenant Scope" section)

## Cross-cutting
- Closes "AiInvocation ledger leaks cross-tenant" in cross-cutting.md.
- Establishes the rule that R-8's audit-read endpoint will inherit.

## Out of scope
- AiInvocationLink polymorphic table (that is R-5).
- BYOK-credential join (AP-S3).

## Risk
Existing dashboards that called the single endpoint will need to switch to one of the two new endpoints; touch with care so the platform-admin AI page still works.

## Verdict
Proceed.
```

PM `proceed: true`.

**Stage 3 — Design.** Skipped (`surface/backend-only`).

**Stage 4 — Dev.** Fullstack agent creates `fix/SEC-1-aiinvocation-tenant-scope` off `dev`. Implements the split, updates kb, opens draft PR with template body. Status → `In Review`.

**Stage 5 — Code Review.** Reviewer agent diffs the PR, confirms the AC met, no rule violations, cites cross-cutting refinement. Approves.

**Stage 6 — Security.** Security agent confirms tenant scope, confirms no other `requireAdmin` callers leaked, confirms audit-log write. Approves. (Catches a missing `AuditLog` write — sends back to Dev with one tightening.)

**Stage 4 (round 2).** Dev fixes the `AuditLog` gap. New commit. Re-requests Security.

**Stage 6 (round 2).** Security Approves.

**Stage 7 — QA.** QA agent writes/updates `frontend/e2e/20-admin.spec.ts` to cover both new endpoints with two different roles. Runs the spec. Runs backend Vitest. Pass.

**Stage 8 — Close.** Release Manager merges PR into `dev`. Doc Writer patches `tickets.md` (`AP-S1 — Status: Shipped — <commit-hash>`), updates `.claude/kb/backend-patterns.md` "Tenant Scope" section. PM closes #<n>.

**Streams.** SEC-2 and SEC-3 run in their own streams in parallel — independent schemas, independent risk profiles.

---

## 8. Parallelism rules

- **One stream per package** by default. The Requirements stream, the Verification stream, the Validation stream advance independently.
- **R-Wave is its own stream.** R-1, R-2, R-3 ... advance in dependency order; downstream package streams that touch the same primitive pause at the gate.
- **SEC tickets get a dedicated stream.** They preempt other work in their packages.
- **At most three streams active at once** when running solo. Beyond that, the orchestrator and reviewers lose context coherence.
- **Cross-cutting refinements** discovered mid-stream are appended to `cross-cutting.md` by the Architect or Reviewer in that ticket — they do not block the current ticket, but feed the next R-Wave pick.

---

## 9. How to start

### 9.1 First three pulls

Per `ROADMAP-phase3.md` §0 + §1 + §2.

1. **SEC-1** (this morning) — see worked example. Stream: security. Effort: S. Owner: you + agents.
2. **SEC-2** (this afternoon) — `AutomationRule` `projectId` migration. Effort: M (schema migration + middleware + backfill query).
3. **SEC-3** (this afternoon or tomorrow) — Requirements reviewer-response auth check. Effort: S.

Land all three before any feature work resumes.

### 9.2 Next three pulls (after SEC-* land)

4. **N-1 cuts** — Inventory sunset, `/architecture` + `/reports` delete, "Coming soon" eradication. One bundled PR. Effort: S. Stream: chore.
5. **R-9** — design tokens + ESLint guard. Effort: S. Stream: R-Wave. Unblocks every UI ticket.
6. **R-2** — `POST /auth/reauth`. Effort: S. Stream: R-Wave. Unblocks R-3 and every signature-bearing ticket.

### 9.3 The orchestrator's first prompt

Open a new session and paste:

```
You are the orchestrator for the agentic workflow described in
improvements/AGENTIC-WORKFLOW.md. Read that file plus
improvements/ROADMAP-phase3.md §0 and §2. The first ticket is SEC-1.

Invoke role/pm to intake SEC-1. Wait for my "proceed: true" before
invoking role/architect. Do not auto-advance any stage.
```

The orchestrator then issues the role/pm sub-agent per §6.1 and pauses.

---

## 10. Anti-patterns the workflow explicitly refuses

- **One agent doing the entire pipeline.** No. Each role is a separate sub-agent so its context is bounded and its verdict is independent.
- **Skipping the security stage for "small" tenant-touching tickets.** No. If the ticket touches `req.body.<id>`, `requireAdmin`, `projectId`, or any signing field, `role/security` runs.
- **Marking a ticket "Shipped" before the PR is merged.** No. Doc writer waits for the merge commit hash.
- **Mid-ticket scope expansion.** No. New work goes into a new ticket and a new GH issue; the orchestrator surfaces the scope-creep candidate to the PM.
- **Cross-cutting drift.** No. Reviewer specifically checks: did this PR re-state a `cross-cutting.md` finding instead of fix it. If yes, the ticket is incomplete.
- **PR to `master` directly.** No. Per `.claude/git-workflow.md` only `dev` accepts PRs from feature branches; `master` only accepts a `chore(release)` PR from `dev`.

---

## 11. References

- `improvements/ROADMAP-phase3.md` — what to do, in what order
- `improvements/_shared/cross-cutting.md` — what spans packages
- `improvements/_shared/gap-summary.md` — why each ticket exists
- `improvements/_shared/competitor-matrix.md` — what each ticket has to beat
- `improvements/vision-and-usp.md` §9 — what we refuse to build
- `improvements/ai-ready-vision.md` §6 — provenance schema that anchors R-1
- `improvements/design-system.md` — what the Designer enforces
- `.claude/rules.md` — what every role refuses to violate
- `.claude/git-workflow.md` — branch + commit + PR mechanics
- `.claude/testing.md` — QA's testing contract
- `.claude/kb/backend-patterns.md` — Architect + Reviewer + Security baseline
- `.claude/kb/playwright-e2e.md` — QA's selector contract
