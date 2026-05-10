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
} from '../controllers/validation.controller'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)
router.use('/projects/:projectId', requireProjectMember)

// Items
router.get('/projects/:projectId/items', listItems)
router.get('/projects/:projectId/items.csv', exportItemsCsv)
router.post('/projects/:projectId/items', createItem)
router.post('/projects/:projectId/items/from-requirements', createFromRequirements)
router.get('/projects/:projectId/items/:id', getItem)
router.put('/projects/:projectId/items/:id', updateItem)
router.delete('/projects/:projectId/items/:id', deleteItem)
router.post('/projects/:projectId/items/:id/restore', restoreItem)

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
