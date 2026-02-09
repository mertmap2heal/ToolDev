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
import changeRequestsRoutes from './changeRequests.routes'
import viewsRoutes from './views.routes'
import versionsRoutes from './versions.routes'
import baselinesRoutes from './baselines.routes'
import useCasesRoutes from './usecases.routes'
import requirementValidationRoutes from './requirementValidation.routes'
import templatesRoutes from './templates.routes'
import reqifRoutes from './reqif.routes'
import diagramsRoutes from './diagrams.routes'
import requirementReviewsRoutes from './requirementReviews.routes'
import itemsRoutes from './items.routes'
import warehousesRoutes from './warehouses.routes'
import uomsRoutes from './uoms.routes'
import purchasingRoutes from './purchasing.routes'
import salesRoutes from './sales.routes'
import tasksRoutes from './tasks.routes'
import boardRoutes from './board.routes'
import tagsRoutes from './tags.routes'
import attachmentsRoutes from './attachments.routes'
import relationsRoutes from './relations.routes'
import savedViewsRoutes from './savedViews.routes'
import automationRoutes from './automation.routes'
import importExportRoutes from './importExport.routes'
import timeTrackingRoutes from './timeTracking.routes'
import taskTemplateRoutes from './taskTemplates.routes'
import taskAnalyticsRoutes from './taskAnalytics.routes'
import complianceRoutes from './compliance.routes'
import certificationRoutes from './certification.routes'
import notificationsRoutes from './notifications.routes'
import platformAdminRoutes from './platformAdmin.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/platform-admin', platformAdminRoutes)
router.use('/notifications', notificationsRoutes)
// Mount components (PBS) before project so /projects/:projectId/components is matched
router.use('/projects', componentsRoutes)
router.use('/projects', projectRoutes)
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
router.use('/change-requests', changeRequestsRoutes)
router.use('/views', viewsRoutes)
router.use('/versions', versionsRoutes)
router.use('/baselines', baselinesRoutes)
router.use('/usecases', useCasesRoutes)
router.use('/requirement-validation', requirementValidationRoutes)
router.use('/templates', templatesRoutes)
router.use('/reqif', reqifRoutes)
router.use('/diagrams', diagramsRoutes)
router.use('/projects', requirementReviewsRoutes)
router.use('/inventory/items', itemsRoutes)
router.use('/inventory/warehouses', warehousesRoutes)
router.use('/inventory/uoms', uomsRoutes)
router.use('/inventory', purchasingRoutes)
router.use('/inventory', salesRoutes)
router.use('/tasks', tasksRoutes)
router.use('/board', boardRoutes)
router.use('/tags', tagsRoutes)
router.use('/attachments', attachmentsRoutes)
router.use('/relations', relationsRoutes)
router.use('/saved-views', savedViewsRoutes)
router.use('/automation', automationRoutes)
router.use('/csv', importExportRoutes)
router.use('/time-tracking', timeTrackingRoutes)
router.use('/task-templates', taskTemplateRoutes)
router.use('/task-analytics', taskAnalyticsRoutes)
router.use('/compliance', complianceRoutes)
router.use('/certification', certificationRoutes)

export default router
