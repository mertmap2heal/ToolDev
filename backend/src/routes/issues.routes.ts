import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  createIssue,
  getIssues,
  getIssue,
  getIssueActivity,
  updateIssue,
  deleteIssue,
  createIssueComment,
  updateIssueComment,
  deleteIssueComment,
  subscribeToIssue,
  unsubscribeFromIssue,
  createIssueLink,
  deleteIssueLink,
  getProjectLabels,
  createProjectLabel,
  uploadIssueAttachment,
  getIssueAttachments,
  deleteIssueAttachment,
} from '../controllers/issue.controller'

const router = Router()

router.use(authenticateToken)

// Issue CRUD
router.post('/:projectId', createIssue)
router.get('/:projectId', getIssues)
router.get('/:projectId/:id', getIssue)
router.patch('/:projectId/:id', updateIssue)
router.delete('/:projectId/:id', deleteIssue)

// Activity
router.get('/:projectId/:id/activity', getIssueActivity)

// Comments
router.post('/:projectId/:id/comments', createIssueComment)
router.patch('/:projectId/comments/:commentId', updateIssueComment)
router.delete('/:projectId/comments/:commentId', deleteIssueComment)

// Subscriptions
router.post('/:projectId/:id/subscribe', subscribeToIssue)
router.delete('/:projectId/:id/subscribe', unsubscribeFromIssue)

// Links
router.post('/:projectId/:id/links', createIssueLink)
router.delete('/:projectId/links/:linkId', deleteIssueLink)

// Attachments
router.post('/:projectId/:id/attachments', uploadIssueAttachment)
router.get('/:projectId/:id/attachments', getIssueAttachments)
router.delete('/:projectId/:id/attachments/:attachmentId', deleteIssueAttachment)

// Labels
router.get('/:projectId/labels', getProjectLabels)
router.post('/:projectId/labels', createProjectLabel)

export default router
