import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import {
  listTraceabilityViewFolders,
  createTraceabilityViewFolder,
  updateTraceabilityViewFolder,
  deleteTraceabilityViewFolder,
  listTraceabilityViews,
  createTraceabilityView,
  getTraceabilityView,
  updateTraceabilityView,
  deleteTraceabilityView,
  listTraceabilityViewRevisions,
  getTraceabilityViewRevision,
  rollbackTraceabilityView,
  listTraceabilityViewAuditEvents,
  runTraceabilityViewAtBaseline,
  compareTraceabilityViewToCurrent,
} from '../controllers/traceabilityViews.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Folders
router.get('/:projectId/folders', listTraceabilityViewFolders)
router.post('/:projectId/folders', createTraceabilityViewFolder)
router.patch('/:projectId/folders/:folderId', updateTraceabilityViewFolder)
router.delete('/:projectId/folders/:folderId', deleteTraceabilityViewFolder)

// Views
router.get('/:projectId/views', listTraceabilityViews)
router.post('/:projectId/views', createTraceabilityView)
router.get('/:projectId/views/:viewId', getTraceabilityView)
router.patch('/:projectId/views/:viewId', updateTraceabilityView)
router.delete('/:projectId/views/:viewId', deleteTraceabilityView)

// Revisions / audit
router.get('/:projectId/views/:viewId/revisions', listTraceabilityViewRevisions)
router.get('/:projectId/views/:viewId/revisions/:revisionNumber', getTraceabilityViewRevision)
router.post('/:projectId/views/:viewId/rollback', rollbackTraceabilityView)
router.get('/:projectId/views/:viewId/audit', listTraceabilityViewAuditEvents)

// Baseline run/compare
router.get('/:projectId/views/:viewId/run', runTraceabilityViewAtBaseline)
router.get('/:projectId/views/:viewId/compare', compareTraceabilityViewToCurrent)

export default router

