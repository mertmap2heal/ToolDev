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

const router = Router()


// Bulk actions
router.post('/bulk-update', bulkUpdateProjects)
router.post('/import', importProjects)
router.get('/export', exportProjects)


// Project CRUD
router.post('/', createProject)
router.get('/', getProjects)
router.get('/:id', getProject)
router.put('/:id', updateProject)
router.delete('/:id', deleteProject)

// Team management
router.get('/:id/members', getProjectMembers)
router.post('/:id/members', addProjectMember)
router.delete('/:id/members/:userId', removeProjectMember)
router.post('/:id/invitations/accept', acceptProjectInvitation)
router.post('/:id/invitations/decline', declineProjectInvitation)

// Audit logs and analytics
router.get('/:id/audit-logs', getProjectAuditLogs)
router.get('/:id/analytics', getProjectAnalytics)

export default router
