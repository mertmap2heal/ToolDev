import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import {
  listItems,
  exportItemsCsv,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  restoreItem,
  createFromRequirements,
  signOffItem,
  revokeSignOff,
  listSignOffs,
  listEvidence,
  attachEvidence,
  detachEvidence,
  listLinkedRequirements,
  linkRequirement,
  unlinkRequirement,
  bulkUpdate,
  getCoverage,
  listUncoveredRequirements,
  star,
  unstar,
  listComments,
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/validation.controller'
import { ensureValidationApproverRole } from '../services/validation.service'

// Bootstrap the system "Validation Approver" engineering role on first import.
// Idempotent upsert; failures are logged but do not block route handlers.
ensureValidationApproverRole().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[validation] ensureValidationApproverRole failed:', (e as Error).message)
})

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/projects/:projectId', requireProjectMember)

// Coverage rollup + gap finder
router.get('/projects/:projectId/coverage', getCoverage)
router.get('/projects/:projectId/uncovered-requirements', listUncoveredRequirements)

// Items
router.get('/projects/:projectId/items', listItems)
router.get('/projects/:projectId/items.csv', exportItemsCsv)
router.post('/projects/:projectId/items', createItem)
router.post('/projects/:projectId/items/from-requirements', createFromRequirements)
router.post('/projects/:projectId/items/bulk', bulkUpdate)
router.get('/projects/:projectId/items/:id', getItem)
router.put('/projects/:projectId/items/:id', updateItem)
router.delete('/projects/:projectId/items/:id', deleteItem)
router.post('/projects/:projectId/items/:id/restore', restoreItem)
router.post('/projects/:projectId/items/:id/star', star)
router.delete('/projects/:projectId/items/:id/star', unstar)

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
router.delete(
  '/projects/:projectId/items/:id/evidence/:linkId',
  detachEvidence,
)

export default router
