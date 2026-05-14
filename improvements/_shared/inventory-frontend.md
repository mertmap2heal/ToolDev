# Frontend Inventory

Complete enumeration of every route in `frontend/src/App.tsx`, with the React component file, the service files it imports, and the FeatureGuard / authentication context.

Source of truth: `frontend/src/App.tsx` (223 lines). Each entry below maps a `<Route path=...>` to its rendering component.

---

## Public routes

These routes are outside `<LandingOrApp>` and require no authentication.

| Path | Component | File | Description |
|------|-----------|------|-------------|
| `/login` | `LoginPage` | `frontend/src/pages/Login/LoginPage.tsx` | Email/password login form; uses `auth.service`. |
| `/preview/landing` | `PreviewLandingPage` | `frontend/src/pages/PreviewLanding/PreviewLandingPage.tsx` | Marketing landing-page brand-validation sample with scoped CSS; sections include Navbar, Hero, StandardsStrip, ObjectiveFirst, HumanAITeaming, IntegrationHub, Numbers, TrustStrip, Footer. |
| `/privacy` | `PrivacyPolicy` | `frontend/src/pages/Legal/PrivacyPolicy.tsx` | Static privacy policy page. |
| `/terms` | `TermsOfUse` | `frontend/src/pages/Legal/TermsOfUse.tsx` | Static terms of use page. |

### Conditional public/auth landing

| Path | Component | File | Description |
|------|-----------|------|-------------|
| `/` (unauthenticated) | `LandingPage` | `frontend/src/pages/Landing/LandingPage.tsx` | Marketing landing rendered when no auth token; uses `LandingNavbar`, `LandingHero`, `FeaturesSection`, `ModulesSection`, `PricingSection`, `SecuritySection`, `FAQAccordion`, `LandingFooter`. |

`LandingOrApp` (`frontend/src/components/LandingOrApp.tsx`) renders `LandingPage` when there is no token, otherwise renders `<Outlet />` containing the authenticated route tree below.

---

## Authenticated routes (no project context)

These routes live under `<LandingOrApp>` and `<MainLayout>` but are not scoped to a project.

| Path | Component | File | Services Used | Description |
|------|-----------|------|---------------|-------------|
| `/` (authenticated, index) | `DashboardPage` | `frontend/src/pages/Dashboard/DashboardPage.tsx` | `project.service.ts` | Authenticated home: project list, search/filter, create-project button, project-team modal, delete confirmation, stat cards. |
| `/organization` | `OrganizationPage` | `frontend/src/pages/Organization/OrganizationPage.tsx` | `organization.service.ts`, `auth.service.ts`, `project.service.ts` | Organization-level overview: members, projects, security, stats. |
| `/projects` | redirect to `/` | (Navigate component) | none | Redirect via `<Navigate to="/" replace />`. |
| `/settings` | `SettingsPage` | `frontend/src/pages/Settings/SettingsPage.tsx` | `auth.service.ts`, `aiCredential.service.ts` | User settings: profile, security, AI access (BYOK credentials), notifications, appearance, accessibility. |
| `/help` | `HelpLayout` | `frontend/src/pages/Help/HelpLayout.tsx` | none | Multi-page in-app help/docs layout (240px sidebar + right rail anchors). |
| `/help/:slug` | `HelpLayout` | `frontend/src/pages/Help/HelpLayout.tsx` | none | Help layout for a specific page slug. |
| `/tasks` (index) | `TasksDashboardPage` | `frontend/src/pages/Tasks/Dashboard/TasksDashboardPage.tsx` | `api.ts` (apiClient) | Cross-project tasks dashboard with stats, completion trend. |
| `/tasks/my-tasks` | `MyTasksPage` | `frontend/src/pages/Tasks/MyTasks/MyTasksPage.tsx` | `api.ts` | Current user's tasks across projects. |
| `/tasks/all` | `TasksPage` | `frontend/src/pages/Tasks/TasksPage.tsx` | `task.service.ts`, `project.service.ts`, `api.ts` | Global tasks list view. |
| `/tasks/board` | `TasksPage` | `frontend/src/pages/Tasks/TasksPage.tsx` | (same) | Same component as `/tasks/all` (board variant via internal state). |
| `/tasks/calendar` | `TasksPage` | `frontend/src/pages/Tasks/TasksPage.tsx` | (same) | Same component as `/tasks/all` (calendar variant). |
| `/tasks/reports` | `TasksReportsPage` | `frontend/src/pages/Tasks/Reports/TasksReportsPage.tsx` | `api.ts` | Task reports/statistics: by status, priority, trends. |
| `/tasks/templates` | `TaskTemplatesPage` | `frontend/src/pages/Tasks/Templates/TaskTemplatesPage.tsx` | `api.ts` | Reusable task templates CRUD. |
| `/tasks/workflows` | `TaskWorkflowsPage` | `frontend/src/pages/Tasks/Workflows/TaskWorkflowsPage.tsx` | `api.ts` | Automation rules and workflow runs. |
| `/tasks/time-tracking` | `TimeTrackingPage` | `frontend/src/pages/Tasks/TimeTracking/TimeTrackingPage.tsx` | `api.ts` | Time logs, timers, billable summaries. |
| `/tasks/notifications` | `TaskNotificationsPage` | `frontend/src/pages/Tasks/Notifications/TaskNotificationsPage.tsx` | `api.ts` | Task notification inbox (assignment, comments, status changes, dues). |
| `/tasks/settings` | `TaskSettingsPage` | `frontend/src/pages/Tasks/Settings/TaskSettingsPage.tsx` | none (local state) | Task-module preferences (default view/status/priority, automation, notifications, attachment limits). |
| `/inventory` (index) | redirect to `/inventory/items` | (Navigate) | none | Redirect. |
| `/inventory/items` | `ItemsPage` | `frontend/src/pages/Inventory/Items/ItemsPage.tsx` | `inventory.service.ts` | Inventory item catalogue. |
| `/inventory/warehouses` | `WarehousesPage` | `frontend/src/pages/Inventory/Warehouses/WarehousesPage.tsx` | `inventory.service.ts` | Warehouse list and editor. |
| `/inventory/purchasing` | `PurchasingPage` | `frontend/src/pages/Inventory/Purchasing/PurchasingPage.tsx` | `inventory.service.ts` | Suppliers, purchase orders, goods receipts. |
| `/inventory/sales` | `SalesPage` | `frontend/src/pages/Inventory/Sales/SalesPage.tsx` | none directly (uses subcomponents) | Customers, sales orders, shipments. |
| `/inventory/operations` | `OperationsPage` | `frontend/src/pages/Inventory/Operations/OperationsPage.tsx` | none directly | Transfers, adjustments, cycle counts. |
| `/inventory/reports` | `InventoryReportsPage` | `frontend/src/pages/Inventory/Reports/ReportsPage.tsx` | none | Inventory reports grid (stock-on-hand, movement, valuation, expiring lots, turns, backorders, shrinkage). |
| `/inventory/dashboard` | `InventoryDashboardPage` | `frontend/src/pages/Inventory/Dashboard/DashboardPage.tsx` | none | Inventory KPI dashboard (on-hand, alerts). |

---

## Project-scoped routes (under `/projects/:projectId`)

All routes below are nested under `<LandingOrApp>` and `<MainLayout>`. Each wraps its element in `<FeatureGuard moduleId="...">` unless noted. Some sub-routes nest under a layout (`<VerificationLayoutPage>`, `<SafetyLayoutPage>`).

| Path | Component | File | Services Used | FeatureGuard moduleId | Description |
|------|-----------|------|---------------|----------------------|-------------|
| `/projects/:projectId` | `ProjectLandingPage` | `frontend/src/pages/ProjectLanding/ProjectLandingPage.tsx` | none (uses `ModuleConfiguration`, `FeaturePackageContext`, `projectStore`) | none | Project home: grid of enabled module cards, gated by `FeaturePackageContext.isEnabled`. |
| `/projects/:projectId/stakeholder` | `StakeholderPage` | `frontend/src/pages/Stakeholder/StakeholderPage.tsx` | `stakeholderRoles.service.ts` (+ `modules/stakeholders/store`) | `stakeholder` | Stakeholder management: RACI, committees, communications, governance. |
| `/projects/:projectId/product-breakdown-structure` | `PBSPage` (module) | `frontend/src/modules/pbs/PBSPage.tsx` | `project.service.ts`, `requirement.service.ts`, `function.service.ts`, `link.service.ts`, `component.service.ts` | `product-breakdown-structure` | Product Breakdown Structure tree editor, import/export, node editor. |
| `/projects/:projectId/requirements` | `RequirementsPage` | `frontend/src/pages/Requirements/RequirementsPage.tsx` | `requirement.service.ts`, `function.service.ts`, `issue.service.ts`, `changeRequest.service.ts`, `traceability.service.ts`, `link.service.ts`, `component.service.ts`, `verification.service.ts`, `baseline.service.ts`, `requirementsViewPreferences.service.ts` | `requirements` | Main requirements management: list/tree, traceability matrix, baselines, import/export, quality panel, suspect links, diagrams. |
| `/projects/:projectId/requirements/settings` | `RequirementsSettingsPage` | `frontend/src/pages/Requirements/RequirementsSettingsPage.tsx` | none | `requirements` | Project-level requirement-type/level/risk dropdown options manager. |
| `/projects/:projectId/requirements/dashboard` | `RequirementsDashboardPage` | `frontend/src/pages/Requirements/RequirementsDashboardPage.tsx` | `requirement.service.ts` | `requirements` | Requirements summary cards and metrics. |
| `/projects/:projectId/requirements/traceability-views` | `TraceabilityViewsPage` | `frontend/src/pages/Requirements/TraceabilityViewsPage.tsx` | `traceabilityViews.service.ts` | `requirements` | Saved traceability views with folder tree, audit, revisions. |
| `/projects/:projectId/tasks` | `TasksPage` | `frontend/src/pages/Tasks/TasksPage.tsx` | `task.service.ts`, `project.service.ts`, `api.ts` | `tasks` | Project-scoped tasks: list, board, calendar, filters. |
| `/projects/:projectId/functions` | `SystemFunctionsPage` | `frontend/src/pages/SystemFunctions/SystemFunctionsPage.tsx` | `function.service.ts`, `issue.service.ts`, `changeRequest.service.ts` | `functions` | System functions tree, verification coverage matrix, relationship graph. |
| `/projects/:projectId/parameters` | `ParametersPage` | `frontend/src/pages/Parameters/ParametersPage.tsx` | `parameter.service.ts`, `parameterBulkJob.service.ts`, `parameterScenario.service.ts`, `aiParameter.service.ts` | `parameters` | Parameters list with folders, virtualisation, drag-drop, baselines, bulk jobs, AI extraction, scenarios. |
| `/projects/:projectId/parameters/settings` | `ParameterSettingsPage` | `frontend/src/pages/Parameters/ParameterSettingsPage.tsx` | none (uses `ParameterTypesPanel`, `ProjectUnitsPanel`) | `parameters` | Parameter type and project-unit management. |
| `/projects/:projectId/change-requests` | `ChangeRequestsPage` | `frontend/src/pages/ChangeRequests/ChangeRequestsPage.tsx` | `changeRequest.service.ts`, `requirement.service.ts` | `change-requests` | Change request list, filters, detail drawer, create modal. |
| `/projects/:projectId/architecture` | `ArchitecturePage` | `frontend/src/pages/Architecture/ArchitecturePage.tsx` | none | none (no guard) | "Coming soon" placeholder; Architecture module not yet implemented. |
| `/projects/:projectId/reports` | `ReportsPage` | `frontend/src/pages/Reports/ReportsPage.tsx` | none | none (no guard) | "Coming soon" placeholder with the safety report-pack CTA only. |
| `/projects/:projectId/issues` | `IssuesPage` | `frontend/src/pages/Issues/IssuesPage.tsx` | `issue.service.ts`, `function.service.ts`, `auth.service.ts` | `issues` | Issue list, filters, source details, create issue/CR modals. |
| `/projects/:projectId/issues/:issueId` | `IssueDetailPage` | `frontend/src/pages/Issues/IssueDetailPage.tsx` | `issue.service.ts`, `auth.service.ts` | `issues` | Single issue detail: description editor, sidebar, activity feed, linked items, subscriptions. |
| `/projects/:projectId/documentation` | `DocumentationPage` | `frontend/src/pages/Documentation/DocumentationPage.tsx` | `documentation.service.ts` (+ `link.service.ts` in `views/DocumentEditorView`) | `documentation` | Document templates, evidence packs, export profiles, history; backed by mock data. |
| `/projects/:projectId/lifecycle-status` | `LifecycleStatusPage` | `frontend/src/pages/LifecycleStatus/LifecycleStatusPage.tsx` | `lifecycleControl.service.ts` (via `control-tower/data/useLifecycleControlData.ts`) | `lifecycle-status` | Tabbed lifecycle view: status, control-tower, lifecycle-settings. |
| `/projects/:projectId/certification` | `CertificationPage` | `frontend/src/pages/Certification/CertificationPage.tsx` | none directly (uses `modules/certification/store`) | `certification` | Certification lifecycle: context, compliance matrix, MoC, evidence index, findings/actions. |
| `/projects/:projectId/validation` | `ValidationPage` | `frontend/src/pages/Validation/ValidationPage.tsx` | `validation.service.ts` | `validation` | Validation item list with create/from-requirements modals, drawer, onboarding, toast. |
| `/projects/:projectId/validation/der` | `DERView` | `frontend/src/pages/Validation/DERView.tsx` | `validation.service.ts` | `validation` | Read-only Designated Engineering Representative review view, printable. |
| `/projects/:projectId/validation/baselines` | `BaselinesPage` | `frontend/src/pages/Validation/BaselinesPage.tsx` | `validation.service.ts` | `validation` | Validation baseline snapshots list and read-only panel. |
| `/projects/:projectId/validation/activity` | `ActivityPage` | `frontend/src/pages/Validation/ActivityPage.tsx` | `validation.service.ts` | `validation` | Project-wide validation audit feed with actor/category filters. |
| `/projects/:projectId/validation/settings` | `ValidationSettingsPage` | `frontend/src/pages/Validation/ValidationSettingsPage.tsx` | `validation.service.ts` | `validation` | Validation key prefixes, tag palette, criterion templates. |
| `/projects/:projectId/risk-management` | `RiskManagementPage` | `frontend/src/pages/RiskManagement/RiskManagementPage.tsx` | none (mock data + own modal components) | `risk-management` | Risk register with filters, classification, detail drawer, create modal. |
| `/projects/:projectId/interface-management` | `InterfaceManagementPage` | `frontend/src/pages/InterfaceManagement/InterfaceManagementPage.tsx` | none (mock data in `mockInterfaces`) | `interface-management` | Interface register with filters, statuses, types. |
| `/projects/:projectId/configuration-management` | `ConfigurationManagementPage` | `frontend/src/pages/ConfigurationManagement/ConfigurationManagementPage.tsx` | none directly (uses `modules/configuration-management/store`) | `configuration-management` | CM tabs: overview, CIs, baselines, changes, releases, deviations/waivers, audit, access roles, compare. |
| `/projects/:projectId/archive` | `ArchivePage` | `frontend/src/pages/Archive/ArchivePage.tsx` | `requirement.service.ts`, `baseline.service.ts` | `archive` | Trash, glossary/abbreviations, retention/audit, archived baselines. |
| `/projects/:projectId/audit` | `AuditLogPage` (safety) | `frontend/src/pages/Safety/AuditLogPage.tsx` | none | `audit` | Mock audit log table (shared with Safety module). |
| `/projects/:projectId/compliance-check` | `ComplianceCheckPage` | `frontend/src/pages/ComplianceCheck/ComplianceCheckPage.tsx` | `compliance.service.ts` | `compliance-check` | Compliance rules, runs, findings; regulation folder tree. |
| `/projects/:projectId/mbse-models` | `MBSEModelsPage` | `frontend/src/pages/MBSEModels/MBSEModelsPage.tsx` | none (uses `mbseStore`, diagram components) | `mbse-models` | **Full-page experience outside MainLayout.** SysML diagrams (Requirements, UseCase, BDD/IBD, Parametric, Activity, Sequence, StateMachine, Package), model browser, validation engine. |

### Verification sub-routes (nested under `/projects/:projectId/verification`)

Parent: `<VerificationLayoutPage>` wrapping `<FeatureGuard moduleId="verification">`.

| Path | Component | File | Services Used | FeatureGuard moduleId | Description |
|------|-----------|------|---------------|----------------------|-------------|
| `/projects/:projectId/verification` | `VerificationLayoutPage` (layout) + `VerificationPage` (index) | `frontend/src/pages/Verification/VerificationLayoutPage.tsx`, `VerificationPage.tsx` | `project.service.ts`, `verification.service.ts`, `traceability.service.ts`, `requirement.service.ts`, `link.service.ts` | `verification` (on layout) | Verification module shell with tree panel + tabs + drawers (Test Plan, Test Case, Test Setup, Test Result, Test Run); index renders main list view. |
| `/projects/:projectId/verification/report/:entityType/:entityId` | `VerificationReportPage` | `frontend/src/pages/Verification/VerificationReportPage.tsx` | `verification.service.ts` | (inherits) | Read-only report for a test case/plan/run with export modal. |
| `/projects/:projectId/verification/settings` | `VerificationSettingsPage` | `frontend/src/pages/Verification/VerificationSettingsPage.tsx` | `verification.service.ts` | (inherits) | Custom dropdown options manager + baseline create/list. |
| `/projects/:projectId/verification/templates` | `TemplatesLandingPage` | `frontend/src/pages/Verification/TemplatesLandingPage.tsx` | `verification.service.ts` | (inherits) | Test-case and test-plan template library with archive, copy, delete. |
| `/projects/:projectId/verification/templates/:templateId` | `TemplateEditorPage` | `frontend/src/pages/Verification/TemplateEditorPage.tsx` | `verification.service.ts` | (inherits) | Section-based verification template editor with version history and preview. |

### Safety-analysis sub-routes (nested under `/projects/:projectId/safety-analysis`)

Parent: `<SafetyLayoutPage>` wrapping `<FeatureGuard moduleId="safety-analysis">`. All sub-pages are mock-data-only with a demo-only banner.

| Path | Component | File | Services Used | FeatureGuard moduleId | Description |
|------|-----------|------|---------------|----------------------|-------------|
| `/projects/:projectId/safety-analysis` | `SafetyLayoutPage` | `frontend/src/pages/Safety/SafetyLayoutPage.tsx` | none | `safety-analysis` | Layout with `SafetyNavigation` and a persistent demo-only banner. |
| `/projects/:projectId/safety-analysis` (index) | redirect to `overview` | (Navigate) | none | (inherits) | Index redirects to `/overview`. |
| `/projects/:projectId/safety-analysis/overview` | `SafetyOverviewPage` | `frontend/src/pages/Safety/SafetyOverviewPage.tsx` | `project.service.ts` | (inherits) | Hazard severity distribution, method metadata, top blockers. |
| `/projects/:projectId/safety-analysis/hazards` | `HazardsPage` | `frontend/src/pages/Safety/HazardsPage.tsx` | none (mock data) | (inherits) | Hazard register with severity/status filters, detail drawer, create modal. |
| `/projects/:projectId/safety-analysis/analyses` | `SafetyAnalysesLandingPage` | `frontend/src/pages/Safety/SafetyAnalysesLandingPage.tsx` | none | (inherits) | Method selector landing (FHA/PSSA/SSA/FMEA/FTA/CCA/Markov) with glossary. |
| `/projects/:projectId/safety-analysis/analyses/:method` | `AnalysisListPage` | `frontend/src/pages/Safety/AnalysisListPage.tsx` | none | (inherits) | List analyses for one method with open/duplicate. |
| `/projects/:projectId/safety-analysis/analyses/:method/new` | `CreateAnalysisWizardPage` | `frontend/src/pages/Safety/CreateAnalysisWizardPage.tsx` | none | (inherits) | 6-step wizard: baseline, info, hazards, links, method inputs (Fha/Pssa/Ssa/Fmea/Cca forms), summary. |
| `/projects/:projectId/safety-analysis/analyses/:method/:id` | `EditAnalysisWizardPage` | `frontend/src/pages/Safety/EditAnalysisWizardPage.tsx` | none | (inherits) | Edit version of the analysis wizard. |
| `/projects/:projectId/safety-analysis/visual-analysis` | `FTAVisualPage` | `frontend/src/pages/Safety/FTAVisualPage.tsx` | none | (inherits) | Fault Tree canvas with AND/OR gates, basic events, edges (no probability solving). |
| `/projects/:projectId/safety-analysis/markov` | `MarkovPage` | `frontend/src/pages/Safety/MarkovPage.tsx` | none | (inherits) | ReactFlow Markov state machine editor; state-tag editor (safe/degraded/failed). |
| `/projects/:projectId/safety-analysis/traceability` | `TraceabilityPage` (safety) | `frontend/src/pages/Safety/TraceabilityPage.tsx` | none | (inherits) | Hazards-to-requirements/interfaces/verification/CR matrix and Analyses-to-Hazards matrix (mock). |
| `/projects/:projectId/safety-analysis/impact-assessment` | `ImpactAssessmentPage` | `frontend/src/pages/Safety/ImpactAssessmentPage.tsx` | none | (inherits) | Change-request to safety impact placeholder UI. |
| `/projects/:projectId/safety-analysis/libraries` | `LibrariesPage` | `frontend/src/pages/Safety/LibrariesPage.tsx` | none | (inherits) | Template library with stubbed Create/Clone/Apply. |
| `/projects/:projectId/safety-analysis/reviews` | `ReviewsPage` | `frontend/src/pages/Safety/ReviewsPage.tsx` | none | (inherits) | Review inbox with stubbed Approve/Reject/Comment. |
| `/projects/:projectId/safety-analysis/audit-log` | `AuditLogPage` (safety) | `frontend/src/pages/Safety/AuditLogPage.tsx` | none | (inherits) | Mock audit log with before/after detail panel. |
| `/projects/:projectId/safety-analysis/exports` | `ExportsPage` | `frontend/src/pages/Safety/ExportsPage.tsx` | none | (inherits) | Placeholder export grid (Hazard Log, FHA/PSSA/SSA/FMEA/CCA/Markov reports, FTA PNG/PDF, traceability CSV). |
| `/projects/:projectId/safety-analysis/settings` | `SafetySettingsPage` | `frontend/src/pages/Safety/SafetySettingsPage.tsx` | none | (inherits) | Read-only severity/status definitions and naming rules. |

---

## Admin / platform routes

### Admin (project-context optional, gated by `<AdminRouteGuard>`)

| Path | Component | File | Services Used | FeatureGuard moduleId | Description |
|------|-----------|------|---------------|----------------------|-------------|
| `/admin` (index) | `AdminPage` | `frontend/src/pages/Admin/AdminPage.tsx` | `adminUserRole.service.ts` | none (uses `AdminRouteGuard`) | Admin tabs: Users, Projects, Roles, Authorities, Audit Log. Runs legacy-localStorage role-migration on mount. |
| `/admin/ai-invocations` | `AiInvocationsPage` | `frontend/src/pages/Admin/AiInvocationsPage.tsx` | `aiInvocation.service.ts` | (same) | Admin-only audit log of every AI/MCP call with NDJSON export for ISO/IEC 42001 compliance. |

### Platform Admin (top-level, dedicated layout, gated by `<PlatformAdminRouteGuard>` + `<PlatformAdminLayout>`)

Outside `<MainLayout>` — no project sidebar.

| Path | Component | File | Services Used | FeatureGuard moduleId | Description |
|------|-----------|------|---------------|----------------------|-------------|
| `/platform-admin` (index) | `PlatformAdminPage` | `frontend/src/pages/PlatformAdmin/PlatformAdminPage.tsx` | `platformAdmin.service.ts` (`getPlatformStats`) | none (custom guard) | Platform stats: organisations, users, projects, recent activity. |
| `/platform-admin/create-company-admin` | `CreateCompanyAdminPage` | `frontend/src/pages/PlatformAdmin/CreateCompanyAdminPage.tsx` | `platformAdmin.service.ts` (`getOrganizations`, `createPlatformUser`) | (same) | Create a company-admin user and assign them to an organisation. |
| `/platform-admin/companies` | `CompaniesPage` | `frontend/src/pages/PlatformAdmin/CompaniesPage.tsx` | `platformAdmin.service.ts` (`getOrganizations`, `getCompanies`, `updateOrganization`, `createCompany`) | (same) | Manage organisations and companies, reset passwords. |
| `/platform-admin/limits` | `CompanyLimitsPage` | `frontend/src/pages/PlatformAdmin/CompanyLimitsPage.tsx` | `platformAdmin.service.ts` (`getLimits`, `setCompanyLimit`) | (same) | Set per-company resource limits. |
| `/platform-admin/audit-logs` | `AuditLogsPage` | `frontend/src/pages/PlatformAdmin/AuditLogsPage.tsx` | `platformAdmin.service.ts` (`getAuditLogs`, `getOrganizations`) | (same) | Platform-level audit log search with actor/action/target/company/date filters. |
| `/platform-admin/data-flow` | `DataFlowAdminPanel` | `frontend/src/pages/PlatformAdmin/DataFlowAdminPanel.tsx` | none directly; uses `socket.io-client`, `reactflow` | (same) | Live ReactFlow data-flow visualisation over Socket.IO. |

---

## Settings routes

There is exactly one user-level settings route (admin tabs are in Admin section above).

| Path | Component | File | Services Used | Description |
|------|-----------|------|---------------|-------------|
| `/settings` | `SettingsPage` | `frontend/src/pages/Settings/SettingsPage.tsx` | `auth.service.ts`, `aiCredential.service.ts` | Tabs: profile, security, AI access (BYOK), notifications, appearance, accessibility. |

Project / module-level settings sub-routes (listed above for completeness):
- `/projects/:projectId/requirements/settings`
- `/projects/:projectId/parameters/settings`
- `/projects/:projectId/validation/settings`
- `/projects/:projectId/verification/settings`
- `/projects/:projectId/safety-analysis/settings`
- `/tasks/settings`

---

## Summary

- **Total routes** (path declarations in `App.tsx`, including layout and index/redirect entries): **75**
  - Public: 4 (`/login`, `/preview/landing`, `/privacy`, `/terms`)
  - Conditional landing wrapper: 1 (`/` via `<LandingOrApp>` -> `LandingPage` or `<MainLayout>`)
  - Authenticated, non-project: 23 (dashboard, organisation, settings, help x2, tasks tree x11, inventory tree x8, projects-redirect, admin x3 incl. guard wrap)
  - Project-scoped (under `/projects/:projectId`): 36 (including 5 verification sub-routes, 17 safety sub-routes)
  - Platform admin: 7 (incl. guard + layout shells)
  - Redirect-only routes: 3 (`/projects` -> `/`, `/safety-analysis` -> `overview`, `/inventory` -> `/inventory/items`)
- **Total page components**: **66 unique `.tsx` files** rendered as route elements (counting `TasksPage` once though it serves four routes, etc.).
- **Routes behind `<FeatureGuard>`**: **35**. Module IDs used: `mbse-models`, `stakeholder`, `product-breakdown-structure`, `requirements` (x4), `tasks`, `functions`, `parameters` (x2), `change-requests`, `verification` (1 layout covering 5 children), `issues` (x2), `documentation`, `lifecycle-status`, `certification`, `validation` (x5), `risk-management`, `interface-management`, `configuration-management`, `archive`, `audit`, `compliance-check`, `safety-analysis` (1 layout covering 17 children).

### Notable observations

1. **Two unguarded project-scoped routes**: `/projects/:projectId/architecture` and `/projects/:projectId/reports` render without `<FeatureGuard>`. Both currently show only a "Coming soon" placeholder (issue #280 in source comments), so the lack of a guard has no UX impact yet — but if those modules ship, guards must be added to honour the package-tier matrix in `feature-flags.md`.
2. **`MBSEModelsPage` is the only route deliberately outside `<MainLayout>`** — it is a full-page diagram editor experience (declared at the top of the route tree, sibling to `/login` rather than nested under `<LandingOrApp>`). It is still gated by `<FeatureGuard moduleId="mbse-models">` but uses no sidebar/header chrome.
3. **`AuditLogPage` from `pages/Safety/` is reused for two routes**: `/projects/:projectId/audit` (gated by `audit` module) and `/projects/:projectId/safety-analysis/audit-log` (inherits `safety-analysis` guard). Both render the same mock-data view — the safety module's entire data layer is in-memory mock data with a persistent demo-only banner (see `SafetyLayoutPage.tsx`).
4. **Tasks have a split routing tree**: the top-level `/tasks/*` (under `<MainLayout>`, no project context) hosts the cross-project task management UI (dashboard, my-tasks, reports, templates, workflows, time-tracking, notifications, settings), while `/projects/:projectId/tasks` serves the project-scoped task list (same `TasksPage` component reused as `/tasks/all|board|calendar`). Task sub-routes use the bare `apiClient` from `services/api.ts` rather than a dedicated `task.service.ts` — the latter is only imported by the project-scoped `TasksPage` and the cross-project `/tasks/all` variant.
