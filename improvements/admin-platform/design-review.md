# Admin / Platform / Settings — Design Review

Competitor comparison and `design-system.md` conformance for the cluster.

---

## 1. Competitor admin UX — what aerospace buyers compare us to

Aerospace small-team buyers (`vision-and-usp.md` §4) generally arrive having used one of:

- **Jira admin** (any of Atlassian Cloud, Atlassian Data Center, or Jira Software Cloud) — by far the most common reference. Hundreds of millions of users.
- **Linear admin** — increasingly the reference for modern teams. Sets the bar for opinionated, fast admin UX.
- **GitHub Enterprise admin** — common for engineers migrating from "we use GitHub for everything."
- **Jama Connect admin** (rarer but the closest direct competitor `vision-and-usp.md` names).
- **Polarion admin** — almost universally cited as the worst-of-class.

### 1.1 Jira admin (Atlassian Cloud, mid-2026)

Jira's admin is split across **three** consoles:

1. **Site admin** (`admin.atlassian.com`) — global to a customer's Atlassian account, manages users + products + billing + SSO. Outside any product.
2. **Product admin** inside Jira (`/jira/settings`) — manages issues, schemes, workflows, custom fields.
3. **Project admin** (`/jira/projects/:key/settings`) — per-project configuration.

Three levels. A Jira customer with experience expects three places to look. **Our cluster collapses two of these into one `/admin`** (project + product config), and surfaces the third (cross-tenant site admin) as `/platform-admin`. This is the same shape, fewer surfaces, easier to navigate.

What Jira does better than us: every admin page has a left-rail of section headings (User access, Issue types, Workflows, Screens, Custom fields…). Our `/admin` page uses a six-tab horizontal strip. Tabs scale to ~6-8 entries before overflowing; left rails scale to ~30. As we expand the Admin surface (Engineering Roles + Permission Templates + Authorities → eventually + CCB Roles + AI Enablement + MCP Keys + Audit + AI Invocations + Notifications + Integrations + SSO + Tenant Settings), the horizontal tab strip will overflow within the year. Switch to a left-rail before we hit eight tabs.

What Jira does worse: **everything is configurable, so nothing is opinionated.** A Jira project admin presents 30 settings sections, every one demanding a decision. Per `vision-and-usp.md` §8.4 (opinionated defaults), we explicitly reject this. Our advantage is to have fewer admin settings, not more. Resist the temptation to grow `/admin` toward parity.

### 1.2 Linear admin (mid-2026 reference for opinionated UX)

Linear's admin is one screen with a left-rail of ten sections (`Profile, Account, Security, Notifications, API, Integrations, Workspace, Members, Billing, Import/Export`). No tabs, no sub-pages. Each section is a single scrollable page with cards.

Per `design-system.md` §6.1 (the canonical object panel) extended to settings, this is the right pattern: **one left-rail, one content pane**. Our `/settings` already follows this for the user-scoped surface (Profile / Security / AI Access / Notifications / Appearance / Accessibility). Our `/admin` does not — it uses tabs. The inconsistency is internal.

**Concrete fix:** unify `/admin` and `/settings` on the same chrome — left rail + content pane, headings render the section name, no horizontal tab strip. The active section in URL (`/admin?section=engineering-roles`). Then a single component pattern serves both pages.

### 1.3 GitHub Enterprise admin

GitHub's pattern is opinionated **defaults + escape hatches**. The org-level admin defaults to "everyone in the org can create repos" until the admin opts out. Branch protection rules ship as templates the admin extends, not blank slates. This matches `vision-and-usp.md` §8.4 closely. The cluster's `/admin → Authorities` tab is the closest analogue — versioned authority templates the admin instantiates onto users. The implementation is half-built (`AuthoritiesTab.tsx:36-39` is a `TODO: Apply template to users/roles`), but the intent is right.

### 1.4 Jama Connect admin

Jama splits admin into `Organization Admin` (cross-project) and `Project Admin` (per-project). Each is a flat list of management cards. Jama's most common buyer complaint (G2 2026): "the role/permission system is confusing for new admins." The product ships with the same three-concept role muddle we have (Role / Project Role / User License Type), shown across three separate pages.

**Our opportunity:** by naming the three concepts cleanly (engineering / admin permission / simulation per `.claude/project.md`) and rendering them on **non-overlapping screens**, we ship an admin UX that is materially less confusing than Jama on day one. This is a buyer-visible differentiator if we execute.

### 1.5 Polarion admin

The universally cited worst-of-class. Polarion admin is a Java-applet-style screen with hundreds of properties, XML-edit dialogs, and a "Tracker Configuration" tree that scrolls beyond the viewport. Polarion admin is one of the top three reasons G2 reviewers (2026) describe Polarion as "older and confusing." 

Setting a low bar; trivially clearable.

---

## 2. Admin tabs — strip vs left-rail

Current `AdminPage.tsx` uses:

```
┌─────────────────────────────────────────────────────────────────┐
│ Users  | Projects | Roles | Authorities | Audit Log | AI Invo.. │ ← 6 tabs
├─────────────────────────────────────────────────────────────────┤
│ ...tab content...                                                │
└─────────────────────────────────────────────────────────────────┘
```

At six items, the tab strip is at its natural limit. The recommended growth surface for Admin (CCB Roles, AI Enablement, MCP Keys list, Notifications config, SSO, Integrations) brings the count to ~11. The horizontal strip overflows.

**Recommendation:** convert to left-rail before tab #7 lands:

```
┌────────────────┬────────────────────────────────────────────────┐
│ Members        │                                                │
│   Users        │   Section content                              │
│   Roles        │                                                │
│                │                                                │
│ Permissions    │                                                │
│   Templates    │                                                │
│   Authorities  │                                                │
│                │                                                │
│ AI access      │                                                │
│   Credentials  │                                                │
│   MCP keys     │                                                │
│   Invocations  │                                                │
│                │                                                │
│ Audit          │                                                │
│   System log   │                                                │
│                │                                                │
└────────────────┴────────────────────────────────────────────────┘
```

Three benefits beyond just scaling:

1. **Section headings group what is currently flat.** "AI access" gathers Credentials + MCP keys + Invocations into one mental model. The buyer asking "how does AI access work" finds three sub-pages in one place — closes the `frontend.md` §6.2 gap (four scattered AI surfaces).
2. **`Permissions` groups Permission Templates with Authorities** — both are RBAC concepts.
3. **`Members` groups Users with Roles** — Users see their roles, Roles see their users.

Implementation: lift `frontend/src/pages/Settings/SettingsPage.tsx`'s sidebar nav into a shared `<SettingsLayout>` primitive. Both `/settings` (user-scoped) and `/admin` (tenant-scoped) consume it.

---

## 3. Platform Admin layout outside MainLayout — justified

The decision to render `/platform-admin/*` in its own layout (`PlatformAdminLayout`) outside `MainLayout` is correct.

Justification:

1. **Multi-tenant context is orthogonal.** A SUPERIOR_ADMIN does not have a "current project" — they are operating across projects of multiple companies. Rendering `MainLayout`'s project sidebar with FeatureGuards and project-scoped breadcrumbs is incoherent.
2. **Different identity model.** Platform admin uses `requireSuperiorAdmin` (a single global role); MainLayout assumes the per-project membership model. Mixing them confuses error states.
3. **Competitor precedent.** Jira (`admin.atlassian.com` separate domain), GitHub (`github.com/enterprises/...` separate URL), Linear (no equivalent — Linear is single-tenant per workspace), Polarion (separate `polarion-admin` URL). All separate the platform-operator surface from the in-product surface.

The current implementation matches the pattern correctly. Keep.

What is **not** justified is the visual divergence inside the layout. The cluster has two visual idioms in one `/platform-admin` tree:

- `PlatformAdminPage`, `CompaniesPage`, `CompanyLimitsPage`, `AuditLogsPage`, `CreateCompanyAdminPage` — sober, on-brand, identical to `MainLayout` content.
- `DataFlowAdminPanel`, `CommandCenterSidebar`, `WarRoomTerminal` — cyberpunk, neon, animated, off-brand.

The first group respects the layout brief. The second group is a different product.

---

## 4. The DataFlow Admin "Command Center" — brand audit

A walkthrough of `DataFlowAdminPanel.tsx`, `CommandCenterSidebar.tsx`, and `WarRoomTerminal.tsx`:

### 4.1 Background and palette

```jsx
<div className="h-full flex flex-col bg-[#0d1117] border-l border-gray-800 …">
<div className="p-6 border-b border-gray-800 bg-gradient-to-b from-[#161b22] to-transparent">
<div className={`text-4xl font-black mb-1 transition-colors ${getHealthColor(...)}`}>
```

Backgrounds are GitHub-dark-mode-ish `#0d1117` / `#161b22`. Health colours are emerald-500 / amber-500 / red-500 (not the `design-system.md` §3.1 status palette which uses deep forest for success, dark crimson for danger). Accent colours are blue-400 / purple-400.

**Verdict:** four `design-system.md` §3.1 violations in the first 100 lines.

### 4.2 Iconography

```jsx
import {
    Activity, Terminal, Users, Zap, ShieldCheck, Database, BarChart3,
    Cpu, Fingerprint, Command, ArrowUpRight, ArrowDownRight,
    MousePointer2, Trash2, RefreshCw, Power
} from 'lucide-react';
```

Lucide icons used appropriately for content (Database for DB nodes, etc.) but the **command palette buttons** (`Flush Cache`, `GC Run`, `Rollout`, `Halt Sys`) use Power / Zap / Trash2 / RefreshCw — visually screaming "this is destructive ops tooling." Per `design-system.md` §10 ("AI-powered sparkle iconography banned"), the same prohibition extends by intent to "operations-cyberpunk iconography." We are not in the SRE ops tooling business; this surface should not look like Grafana or Datadog.

### 4.3 Animation

```jsx
const getPulseClass = () => {
  if (metrics.load > 85) return 'animate-heartbeat';
  if (metrics.load > 60) return 'animate-pulse-fast';
  return '';
};
```

Two custom animations on every node every render. Per `design-system.md` §7 ("motion is informational, not decorative"), pulsing-by-default is decoration. The information ("load > 85%") is already conveyed by the colour change (`border-red-500`); the pulse adds visual noise without informational gain.

### 4.4 Copy

```
"Command Palette" / "Platform Vitals" / "Impact Inspector" / "Trace Stream" /
"Halt Sys" / "GC Run" / "Rollout"
```

Compare to the language in the rest of the cluster:

```
"Recent activity" / "Companies" / "Company limits" / "Global audit logs"
```

The first idiom is from a Cyberpunk-2077 ops cockpit. The second is from a SaaS admin console. They cannot coexist.

### 4.5 Recommendation

Two options, both acceptable; not "keep as-is":

**Option A — sandbox.** Move to `/dev/data-flow` behind a feature flag, never linked from the platform admin sidebar. The data-flow visualisation is useful for an SRE-mode debugging session; gate it behind a developer-only toggle.

**Option B — rebrand.** Keep the live data-flow Socket.IO integration. Replace the palette with deep-forest accents and status-pill colours from `design-system.md` §3.1. Replace `animate-heartbeat` with a single-frame border colour-change. Replace "Halt Sys" / "GC Run" buttons with nothing — the SUPERIOR_ADMIN does not need destructive ops actions in the audit-grade product. Rename "Trace Stream" to "Recent system events."

Option B preserves the useful surface; Option A admits the surface is not yet earned by a customer requirement.

`tickets.md` AP-N2 recommends Option A pending customer demand for live ops visualisation; Option B is the upgrade path.

---

## 5. AI Access tab as the buyer-visible BYOK story

This is the single highest-leverage UX surface in the cluster.

### 5.1 The strategic context

Per `ai-ready-vision.md` §7.5 and `vision-and-usp.md` §13 ("aerospace buyers must value certification-native"), the **moat against incumbents** is that:

1. Customers can supply their own AI key (BYOK) → data stays in customer billing.
2. Customers can run their own inference endpoint (self-hosted) → data stays in customer tenant.
3. Provenance is recorded for every invocation regardless of which key was used.

(1) is competitively unique against Jama (no BYOK), against Codebeamer (no BYOK), against Atlassian Rovo (no BYOK in 2026 GA). (2) is the only feature that closes the ITAR conversation. Both ship today, in this tab. **Buyers do not know they exist** because the tab is buried.

### 5.2 The current UX

`SettingsPage.tsx → AiAccessSection`:

```
┌───────────────────────────────────────────────────────────────┐
│ AI Access                                                     │
│ Connect your own AI provider or use the hosted default        │
├───────────────────────────────────────────────────────────────┤
│  ℹ️ Every AI call in the product is routed through the         │
│    provider configured here. Keys are encrypted at rest       │
│    (AES-256-GCM), decrypted server-side for a single          │
│    outbound request, and never sent back to the browser.      │
│                                                               │
│    If no key is stored, the product uses the operator-        │
│    configured hosted default (may be disabled for ITAR /      │
│    air-gapped deployments).                                   │
├───────────────────────────────────────────────────────────────┤
│ Add Provider Key                                              │
│ [Provider ▾] [Label ____________] [API Key …………] [Store]      │
├───────────────────────────────────────────────────────────────┤
│ Active Credentials                                            │
│ • Personal Claude key · anthropic · …a3F2 · added Apr 13      │
└───────────────────────────────────────────────────────────────┘
```

The copy is **exactly right**. AES-256-GCM is named. The fallback behaviour ("operator-configured hosted default") is named. ITAR is named. This is the right level of technical reassurance for an aerospace buyer.

### 5.3 The UX gaps

1. **Discoverability.** The buyer never reaches this tab in a demo. Surface a banner on `/projects/:projectId` for any AI-enabled project: "This project uses the hosted default Anthropic model. [Configure BYOK]." Link drops the user here.
2. **No model card.** `ai-ready-vision.md` §11.1 commits to a public AI model card. The "hosted default" copy mentions a provider exists; no link to "which model, which prompt template, which context size." Add a single link to `/ai-readiness` (or wherever the model card lives).
3. **No usage telemetry.** The buyer can stage a key but cannot see what it has been spent on. Add a per-credential drill-down: invocations this month, context tokens this month, models used, projects active on.
4. **No project ↔ credential binding.** Today the credential is user-scoped and the project-enablement flag (`Project.aiEnabled`) is admin-scoped. A user who staged a key has no way to know which projects will actually use it. Render the list inline ("Active on: Project A, Project B").

### 5.4 The MCP keys surface needs the same treatment

`McpKeysPanel.tsx` (a modal under `/admin → Projects → Per-project gear menu`) is the **first-class MCP onboarding surface** for an aerospace customer. Today it is a modal four clicks deep, opened only by an admin.

Per `ai-ready-vision.md` §7.2 (MCP server at launch), this is the surface that turns the product into an agent-driven tool. A customer integrating Claude Desktop or claude-code or their own LangGraph agent needs to:

1. Create a project-scoped key
2. Pick scopes (read / draft / review / impact)
3. Decide ITAR flag (today defaults off — buyer should make this explicit)
4. Decide expiry (today defaults 90 days — reasonable)
5. Copy the plaintext once

The modal surface does all five correctly. What it does **not** do:

1. **Live MCP connection status.** Once a key is created, the buyer has no way to know if Claude Desktop ever successfully connected with it. The `lastUsedAt` field exists in the model; show it prominently.
2. **Per-key usage telemetry.** Same gap as BYOK credentials — the data is in `AiInvocation`, the panel does not surface it.
3. **MCP server URL and protocol hints.** The modal does not tell the customer the MCP server lives at `/api/v1/mcp`. A buyer copying the key has no idea where to point Claude Desktop. Add a one-line "Connect to: `https://your-tenant.example/api/v1/mcp`" with copy button.
4. **Discoverability.** Promote the panel out of "Admin → Projects → gear menu" into the project-level AI access page (per §5.3 unified-AI-access fix).

---

## 6. The Organization page is on-brand

`OrganizationPage.tsx` is largely on-brand. Tabs (Overview / Team / Projects / Security & Compliance) use the standard left-aligned tab strip. KPI cards, tables, cards-with-actions — all standard Tailwind atoms.

Two violations:

1. **`OrgHeader` gradient** (`bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600`, line 299) — three banned tokens in one declaration. Replace with deep-forest tint (`bg-[#1B4332]/12` per `design-system.md` §3.1) or a flat `bg-surface-raised`.
2. **Avatar gradients** — same `from-blue-500 to-indigo-600` pattern repeated for user avatars. Replace with single-color circles in `accent.primary` per the design system.

The Compliance Score panel in the Security tab is interesting: it scores 5 simple checks (capacity, login activity, contact email set, description set) and renders a percentage. Per `design-system.md` §8.2 ("the objective view is the home view"), this is **the right architectural pattern at the wrong scale** — instead of a per-tenant 5-check score, the same pattern should render the DO-178C/DO-254/ARP4754A objective completion matrix at the project landing.

The Org page therefore previews the visual idiom for the eventual Objective Completion Matrix. Reuse the component pattern when the matrix lands. Cross-link from `_shared/cross-cutting.md` 2026-05-14 "Dashboard pattern violates §8.2".

---

## 7. Settings → Notifications is a UX bug

Showing ten toggles for behaviours that do not exist is exactly the "UI lies about backend" anti-pattern `design-system.md` §5 cautions against. The customer turns off "Email me about Verification Results" and gets the same zero emails they would have got with it on.

Per `vision-and-usp.md` §13 ("incumbent inertia must be overcomeable, but only if we ship what we claim"), this surface erodes trust on first contact. Either ship the backend (option 1 in `backend.md` §5) or trim the UI to the one toggle that works (option 2). The half-built state is the worst option.

Recommendation in `tickets.md`: trim now (15 minutes), ship in-app preferences next (1 sprint), defer email until SMTP is product-grade.

---

## 8. Component reuse opportunities

### 8.1 Settings sidebar nav → shared `<SettingsLayout>`

`SettingsPage.tsx` lines 110-137 implement a vertical icon+label nav. `AdminPage.tsx` lines 102-119 implement a horizontal icon+label tab strip. The active-state styling and structure are >70% identical.

Extract to `<SettingsLayout sections={[…]} activeSection={…} onSectionChange={…} />`. Both pages render the same primitive with `direction="vertical"` (Settings) or `direction="horizontal"` (Admin today, vertical after the migration in §2 above).

### 8.2 KPI cards → shared `<KpiCard>`

`OrganizationPage.tsx → KpiCard`, `PlatformAdminPage.tsx` inline tiles, and the future Objective Matrix all want the same primitive: icon + label + value + subtext. Extract.

### 8.3 The `MODAL = '.fixed.inset-0'` pattern

Per `kb/playwright-e2e.md`, the constant `'.fixed.inset-0'` is the canonical modal overlay selector. `McpKeysPanel`, `CreateUserCredentialsModal`, `ResetPasswordModal`, `RoleEditorModal`, `EditOrganizationModal`, `AuthorityEditorModal`, `EngineeringRoleEditorModal`, `UserCreateModal`, `UserEditDrawer`, and `ProjectEditorModal` all implement this pattern themselves. Extract a `<Modal>` primitive.

This is not Admin-specific (every page in the app has modals) but the Admin cluster has nine modal components in one folder, making it the right place to start. Tracked in `tickets.md`.

---

## 9. Read this with

- `README.md` — purpose and target state.
- `frontend.md` — page-by-page UX critique.
- `backend.md` — schema and route topology.
- `tickets.md` — every fix above sized and sequenced.
- `_shared/cross-cutting.md` — appended findings.
- `design-system.md` — §1 (north star), §3.1 (palette), §6 (component philosophy), §7 (motion), §8 (workflow doctrine).
- `vision-and-usp.md` — §8.1 (zero-rollout), §8.5 (human-AI teaming), §13 (positioning survival risks).
