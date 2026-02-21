import { Router } from 'express'
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  acceptProjectInvitation,
  declineProjectInvitation,
  getProjectAuditLogs,
  getProjectAnalytics,
  bulkUpdateProjects,
  exportProjects,
  importProjects,
} from '../controllers/project.controller'
import { authenticateToken } from '../middleware/auth.middleware'
import { resolveProjectParam } from '../middleware/resolveProjectParam.middleware'

const router = Router()

// Bulk actions (must be before :id routes)
router.post('/bulk-update', bulkUpdateProjects)
router.post('/import', importProjects)
router.get('/export', exportProjects)

// Project CRUD
router.post('/', createProject)
router.get('/', getProjects)
router.get('/:id', resolveProjectParam, getProject)
router.put('/:id', resolveProjectParam, updateProject)
router.delete('/:id', resolveProjectParam, deleteProject)

// Team management
router.get('/:id/members', resolveProjectParam, getProjectMembers)
router.post('/:id/members', resolveProjectParam, addProjectMember)
router.delete('/:id/members/:userId', resolveProjectParam, removeProjectMember)
router.post('/:id/invitations/accept', resolveProjectParam, acceptProjectInvitation)
router.post('/:id/invitations/decline', resolveProjectParam, declineProjectInvitation)

// Audit logs and analytics
router.get('/:id/audit-logs', resolveProjectParam, getProjectAuditLogs)
router.get('/:id/analytics', resolveProjectParam, getProjectAnalytics)

export default router
