import { Router } from 'express'
import authRoutes from './auth.routes'
import projectRoutes from './projects.routes'
import componentsRoutes from './components.routes'
import workflowRoutes from './workflow.routes'
import requirementsRoutes from './requirements.routes'
import functionsRoutes from './functions.routes'
import architectureRoutes from './architecture.routes'
import verificationRoutes from './verification.routes'
import traceabilityRoutes from './traceability.routes'
import aiRoutes from './ai.routes'
import documentationRoutes from './documentation.routes'
import issuesRoutes from './issues.routes'
import parametersRoutes from './parameters.routes'
import aiParameterRoutes from './aiParameter.routes'
import aiCredentialRoutes from './aiCredential.routes'
import aiInvocationRoutes from './aiInvocation.routes'
import mcpRoutes from './mcp.routes'
import mcpKeyRoutes from './mcpKey.routes'
import commRoutes from './comm.routes'
import definitionEntriesRoutes from './definitionEntries.routes'
import changeRequestsRoutes from './changeRequests.routes'
import viewsRoutes from './views.routes'
import versionsRoutes from './versions.routes'
import baselinesRoutes from './baselines.routes'
import useCasesRoutes from './usecases.routes'
import requirementValidationRoutes from './requirementValidation.routes'
import templatesRoutes from './templates.routes'
import exportJobsRoutes from './exportJobs.routes'
import corporateDocxTemplatesRoutes from './corporateDocxTemplates.routes'
import excelColumnMappingsRoutes from './excelColumnMappings.routes'
import scheduledExportsRoutes from './scheduledExports.routes'
import reqifRoutes from './reqif.routes'
import diagramsRoutes from './diagrams.routes'
import requirementReviewsRoutes from './requirementReviews.routes'
import tasksRoutes from './tasks.routes'
import boardRoutes from './board.routes'
import tagsRoutes from './tags.routes'
import attachmentsRoutes from './attachments.routes'
import relationsRoutes from './relations.routes'
import savedViewsRoutes from './savedViews.routes'
import traceabilityViewsRoutes from './traceabilityViews.routes'
import automationRoutes from './automation.routes'
import importExportRoutes from './importExport.routes'
import timeTrackingRoutes from './timeTracking.routes'
import taskTemplateRoutes from './taskTemplates.routes'
import taskAnalyticsRoutes from './taskAnalytics.routes'
import complianceRoutes from './compliance.routes'
import certificationRoutes from './certification.routes'
import notificationsRoutes from './notifications.routes'
import platformAdminRoutes from './platformAdmin.routes'
import organizationRoutes from './organization.routes'
import adminRoutes from './admin.routes'
import adminUserRoleRoutes from './adminUserRole.routes'
import lifecycleRoutes from './lifecycle.routes'
import transitionChecklistRoutes from './transitionChecklist.routes'
import searchRoutes from './search.routes'
import requirementsViewPreferencesRoutes from './requirementsViewPreferences.routes'
import validationRoutes from './validation.routes'
import configItemsRoutes from './configItems.routes'
import deviationsWaiversRoutes from './deviationsWaivers.routes'
import ccbDecisionsRoutes from './ccbDecisions.routes'
import stakeholdersRoutes from './stakeholders.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/admin', adminRoutes)
// #284: adminUserRoleRoutes used to share the `/admin` prefix with
// adminRoutes. Express walks routers in order so any future path
// collision would silently resolve to the first match and could bypass
// a stricter middleware. Mount it on a disjoint subtree instead.
router.use('/admin/user-roles', adminUserRoleRoutes)
router.use('/organization', organizationRoutes)
router.use('/platform-admin', platformAdminRoutes)
router.use('/notifications', notificationsRoutes)
// projectRoutes must mount before componentsRoutes. componentsRoutes applies a
// blanket `router.use('/:projectId', ...)` that treats the first path segment as
// a project id; mounted first it swallows the static POST /projects/import,
// /bulk-update and /export routes and 404s them (#154). componentsRoutes' own
// routes are all two-segment `/:projectId/components...`, which projectRoutes
// does not shadow, so this order is safe both ways.
router.use('/projects', projectRoutes)
router.use('/projects', componentsRoutes)
router.use('/projects', requirementsViewPreferencesRoutes)
router.use('/workflow', workflowRoutes)
router.use('/requirements', requirementsRoutes)
router.use('/functions', functionsRoutes)
router.use('/architecture', architectureRoutes)
router.use('/verification', verificationRoutes)
router.use('/traceability', traceabilityRoutes)
router.use('/ai', aiRoutes)
router.use('/documentation', documentationRoutes)
router.use('/issues', issuesRoutes)
router.use('/parameters', parametersRoutes)
// AI-tier parameter routes. Mounted at the same /parameters prefix so the
// /:projectId prefix is consistent with the rest of the parameters API.
// The middleware chain inside this router enforces the three-layer AI
// feature gate (env -> project -> package).
router.use('/parameters', aiParameterRoutes)
// BYOK user-scoped AI credentials. Mounted at /ai so the URLs are
// /api/v1/ai/credentials regardless of which project is active.
router.use('/ai', aiCredentialRoutes)
// Admin-only AiInvocation list + NDJSON export for ISO/IEC 42001 audits.
router.use('/admin', aiInvocationRoutes)
// MCP Streamable HTTP endpoint (Claude Desktop, claude-code, etc).
// Auth is via scoped API key, NOT the session JWT - handler verifies
// the bearer token inside `handleMcpRequest`.
router.use('/mcp', mcpRoutes)
// Admin-only MCP key management endpoints.
router.use('/admin/projects', mcpKeyRoutes)
router.use('/comm', commRoutes)
router.use('/definitions', definitionEntriesRoutes)
router.use('/change-requests', changeRequestsRoutes)
router.use('/views', viewsRoutes)
router.use('/versions', versionsRoutes)
router.use('/baselines', baselinesRoutes)
router.use('/usecases', useCasesRoutes)
router.use('/requirement-validation', requirementValidationRoutes)
router.use('/templates', templatesRoutes)
router.use('/export-jobs', exportJobsRoutes)
router.use('/corporate-docx-templates', corporateDocxTemplatesRoutes)
router.use('/excel-column-mappings', excelColumnMappingsRoutes)
router.use('/scheduled-exports', scheduledExportsRoutes)
router.use('/reqif', reqifRoutes)
router.use('/diagrams', diagramsRoutes)
router.use('/projects', requirementReviewsRoutes)
router.use('/tasks', tasksRoutes)
router.use('/board', boardRoutes)
router.use('/tags', tagsRoutes)
router.use('/attachments', attachmentsRoutes)
router.use('/relations', relationsRoutes)
router.use('/saved-views', savedViewsRoutes)
router.use('/traceability-views', traceabilityViewsRoutes)
router.use('/automation', automationRoutes)
router.use('/csv', importExportRoutes)
router.use('/time-tracking', timeTrackingRoutes)
router.use('/task-templates', taskTemplateRoutes)
router.use('/task-analytics', taskAnalyticsRoutes)
router.use('/compliance', complianceRoutes)
router.use('/certification', certificationRoutes)
router.use('/lifecycle', lifecycleRoutes)
router.use('/transition-checklists', transitionChecklistRoutes)
router.use('/search', searchRoutes)
router.use('/validation', validationRoutes)
// NX-3 (#443) — Configuration Management primitives.
router.use('/config-items', configItemsRoutes)
router.use('/deviations-waivers', deviationsWaiversRoutes)
router.use('/ccb-decisions', ccbDecisionsRoutes)
// NX-8 (#463) — Stakeholders governance: committees + RACI. Mounted on
// /projects so the URLs are /api/v1/projects/:projectId/committees|raci.
router.use('/projects', stakeholdersRoutes)

export default router
