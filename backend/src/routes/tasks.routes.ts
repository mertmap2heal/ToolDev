import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  createTask,
  getTasks,
  getTask,
  updateTask,
  deleteTask,
  duplicateTask,
  bulkUpdateTasks,
  getActivity,
  getCalendarTasks,
} from '../controllers/task.controller'
import {
  linkTagToTask,
  unlinkTagFromTask,
} from '../controllers/tag.controller'
import {
  getComments,
  createComment,
} from '../controllers/comment.controller'
import {
  getAttachments,
  uploadAttachment,
} from '../controllers/attachment.controller'
import {
  getRelations,
  createRelation,
  getDependencyWarnings,
} from '../controllers/dependency.controller'

const router = Router()

router.use(authenticateToken)

// Core task routes
router.post('/', createTask)
router.get('/', getTasks)
router.get('/:id', getTask)
router.patch('/:id', updateTask)
router.delete('/:id', deleteTask)
router.post('/:id/duplicate', duplicateTask)
router.post('/bulk', bulkUpdateTasks)

// Tag routes
router.post('/:id/tags/:tagId', linkTagToTask)
router.delete('/:id/tags/:tagId', unlinkTagFromTask)

// Comment routes
router.get('/:id/comments', getComments)
router.post('/:id/comments', createComment)

// Attachment routes
router.get('/:id/attachments', getAttachments)
router.post('/:id/attachments', uploadAttachment)

// Relation routes
router.get('/:id/relations', getRelations)
router.post('/:id/relations', createRelation)
router.get('/:id/dependency-warnings', getDependencyWarnings)

// Activity route
router.get('/:id/activity', getActivity)

// Calendar route
router.get('/calendar', getCalendarTasks)

export default router
