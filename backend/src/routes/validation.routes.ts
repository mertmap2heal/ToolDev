import { Router } from 'express'
import multer from 'multer'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { requireProjectOwnerOrAdmin } from '../middleware/requireProjectOwnerOrAdmin.middleware'
import {
  listItems,
  exportItemsCsv,
  exportItemsMarkdown,
  exportItemsPdf,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
  duplicateItem,
  createFromRequirements,
  signOffItem,
  revokeSignOff,
  listSignOffs,
  listEvidence,
  attachEvidence,
  uploadEvidenceFile,
  detachEvidence,
  listLinkedRequirements,
  linkRequirement,
  unlinkRequirement,
  bulkUpdate,
  getCoverage,
  getTrend,
  listSavedViews,
  createSavedView,
  deleteSavedView,
  listUncoveredRequirements,
  star,
  unstar,
  listActivity,
  listProjectActivity,
  listComments,
  createComment,
  updateComment,
  deleteComment,
  getSettings,
  updateSettings,
  listBaselines,
  getBaseline,
  createBaseline,
  deleteBaseline,
  acknowledgeSuspect,
} from '../controllers/validation.controller'
import { ensureValidationApproverRole } from '../services/validation.service'

// Bootstrap the system "Validation Approver" engineering role on first import.
// Idempotent upsert; failures are logged but do not block route handlers.
ensureValidationApproverRole().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[validation] ensureValidationApproverRole failed:', (e as Error).message)
})

// 25 MB cap per uploaded evidence file. Matches a typical PDF / DOCX / image
// size that engineers attach; larger artefacts are referenced by URL via the
// existing attachEvidence endpoint.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/projects/:projectId', requireProjectMember)

// Settings (admin-gated)
router.get('/projects/:projectId/settings', getSettings)
router.put(
  '/projects/:projectId/settings',
  requireProjectOwnerOrAdmin,
  updateSettings,
)

// Coverage rollup + gap finder
router.get('/projects/:projectId/coverage', getCoverage)
router.get('/projects/:projectId/trend', getTrend)
router.get('/projects/:projectId/saved-views', listSavedViews)
router.post('/projects/:projectId/saved-views', createSavedView)
router.delete('/projects/:projectId/saved-views/:viewId', deleteSavedView)
router.get('/projects/:projectId/uncovered-requirements', listUncoveredRequirements)

// Baselines (point-in-time snapshots)
router.get('/projects/:projectId/baselines', listBaselines)
router.post('/projects/:projectId/baselines', createBaseline)
router.get('/projects/:projectId/baselines/:id', getBaseline)
router.delete('/projects/:projectId/baselines/:id', deleteBaseline)

// Items
router.get('/projects/:projectId/items', listItems)
router.get('/projects/:projectId/items.csv', exportItemsCsv)
router.get('/projects/:projectId/report.md', exportItemsMarkdown)
router.get('/projects/:projectId/report.pdf', exportItemsPdf)
router.post('/projects/:projectId/items', createItem)
router.post('/projects/:projectId/items/from-requirements', createFromRequirements)
router.post('/projects/:projectId/items/bulk', bulkUpdate)
router.get('/projects/:projectId/items/:id', getItem)
router.put('/projects/:projectId/items/:id', updateItem)
router.delete('/projects/:projectId/items/:id', deleteItem)
router.post('/projects/:projectId/items/:id/restore', restoreItem)
router.post('/projects/:projectId/items/:id/duplicate', duplicateItem)
router.post('/projects/:projectId/items/:id/star', star)
router.delete('/projects/:projectId/items/:id/star', unstar)
router.post('/projects/:projectId/items/:id/acknowledge-suspect', acknowledgeSuspect)

// Activity feed (filtered audit log)
router.get('/projects/:projectId/activity', listProjectActivity)
router.get('/projects/:projectId/items/:id/activity', listActivity)

// Comments / discussions
router.get('/projects/:projectId/items/:id/comments', listComments)
router.post('/projects/:projectId/items/:id/comments', createComment)
router.put('/projects/:projectId/items/:id/comments/:commentId', updateComment)
router.delete('/projects/:projectId/items/:id/comments/:commentId', deleteComment)

// Linked requirements (TraceLink with sourceType=ValidationItem)
router.get('/projects/:projectId/items/:id/linked-requirements', listLinkedRequirements)
router.post('/projects/:projectId/items/:id/linked-requirements', linkRequirement)
router.delete(
  '/projects/:projectId/items/:id/linked-requirements/:traceLinkId',
  unlinkRequirement,
)

// Sign-offs
router.get('/projects/:projectId/items/:id/sign-offs', listSignOffs)
router.post('/projects/:projectId/items/:id/sign-off', signOffItem)
router.post('/projects/:projectId/items/:id/sign-off/:signOffId/revoke', revokeSignOff)

// Evidence (reuses VerEvidence + VerEvidenceLink with linkedEntityType='ValidationItem')
router.get('/projects/:projectId/items/:id/evidence', listEvidence)
router.post('/projects/:projectId/items/:id/evidence', attachEvidence)
router.post(
  '/projects/:projectId/items/:id/evidence/upload',
  upload.single('file'),
  uploadEvidenceFile,
)
router.delete(
  '/projects/:projectId/items/:id/evidence/:linkId',
  detachEvidence,
)

export default router
