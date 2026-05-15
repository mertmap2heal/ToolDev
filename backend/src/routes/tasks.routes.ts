import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireTaskProjectMember,
  requireBodyProjectMember,
} from '../middleware/requireTaskProjectMember.middleware'
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

// Project-scoped list / create — require membership via query/body project_id.
// Calendar must come before /:id so "calendar" is not treated as a task id.
router.get(
  '/calendar',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'task-calendar' }),
  getCalendarTasks
)
router.get(
  '/',
  requireBodyProjectMember('query', ['project_id', 'projectId'], { resourceLabel: 'task-list' }),
  getTasks
)
router.post(
  '/',
  requireBodyProjectMember('body', ['project_id', 'projectId'], { resourceLabel: 'task-create' }),
  createTask
)
// SEC-2 (#375): /bulk asserts project_id at the route level. The controller
// still validates that every task_id belongs to a project the caller is a
// member of (#159), so multi-project mixes are rejected at the controller
// even when project_id is present.
router.post(
  '/bulk',
  requireBodyProjectMember('body', ['project_id', 'projectId'], { resourceLabel: 'tasks-bulk' }),
  bulkUpdateTasks
)

// Core task routes (resolve projectId from the task itself)
router.get('/:id', requireTaskProjectMember('task'), getTask)
router.patch('/:id', requireTaskProjectMember('task'), updateTask)
router.delete('/:id', requireTaskProjectMember('task'), deleteTask)
router.post('/:id/duplicate', requireTaskProjectMember('task'), duplicateTask)

// Tag routes
router.post('/:id/tags/:tagId', requireTaskProjectMember('task'), linkTagToTask)
router.delete('/:id/tags/:tagId', requireTaskProjectMember('task'), unlinkTagFromTask)

// Comment routes
router.get('/:id/comments', requireTaskProjectMember('task'), getComments)
router.post('/:id/comments', requireTaskProjectMember('task'), createComment)

// Attachment routes
router.get('/:id/attachments', requireTaskProjectMember('task'), getAttachments)
router.post('/:id/attachments', requireTaskProjectMember('task'), uploadAttachment)

// Relation routes
router.get('/:id/relations', requireTaskProjectMember('task'), getRelations)
router.post('/:id/relations', requireTaskProjectMember('task'), createRelation)
router.get(
  '/:id/dependency-warnings',
  requireTaskProjectMember('task'),
  getDependencyWarnings
)

// Activity route
router.get('/:id/activity', requireTaskProjectMember('task'), getActivity)

export default router
