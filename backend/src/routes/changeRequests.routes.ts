import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  createChangeRequest,
  getChangeRequests,
  getChangeRequest,
  updateChangeRequest,
  deleteChangeRequest,
  uploadAttachment,
  getAttachments,
  deleteAttachment,
} from '../controllers/changeRequest.controller'

const router = Router()

router.use(authenticateToken)

router.post('/:projectId', createChangeRequest)
router.get('/:projectId', getChangeRequests)
router.get('/:projectId/:id', getChangeRequest)
router.put('/:projectId/:id', updateChangeRequest)
router.delete('/:projectId/:id', deleteChangeRequest)

// Attachment routes
router.post('/:projectId/:changeRequestId/attachments', uploadAttachment)
router.get('/:projectId/:changeRequestId/attachments', getAttachments)
router.delete('/:projectId/:changeRequestId/attachments/:attachmentId', deleteAttachment)

export default router
