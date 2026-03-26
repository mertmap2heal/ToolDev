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
import {
  listProjectEngineeringRoles,
  listProjectUsersWithRoles,
  getMyProjectEngineeringRoles,
  assignProjectEngineeringRole,
  unassignProjectEngineeringRole,
} from '../controllers/projectStakeholderRoles.controller'

const router = Router()

// Bulk actions (must be before :id routes)
router.post('/bulk-update', bulkUpdateProjects)
router.post('/import', importProjects)
router.get('/export', exportProjects)

// Project CRUD
router.post('/', createProject)
router.get('/', getProjects)

// Stakeholder / engineering roles (project-scoped) — auth required
router.get(
  '/:id/engineering-roles',
  authenticateToken,
  resolveProjectParam,
  listProjectEngineeringRoles
)
router.get(
  '/:id/users-with-roles',
  authenticateToken,
  resolveProjectParam,
  listProjectUsersWithRoles
)
router.get(
  '/:id/me/engineering-roles',
  authenticateToken,
  resolveProjectParam,
  getMyProjectEngineeringRoles
)
router.post(
  '/:id/engineering-roles/:roleId/assign',
  authenticateToken,
  resolveProjectParam,
  assignProjectEngineeringRole
)
router.post(
  '/:id/engineering-roles/:roleId/unassign',
  authenticateToken,
  resolveProjectParam,
  unassignProjectEngineeringRole
)

router.get('/:id', resolveProjectParam, getProject)
router.put('/:id', resolveProjectParam, updateProject)
router.delete('/:id', resolveProjectParam, deleteProject)

// Team management
router.get('/:id/members', authenticateToken, resolveProjectParam, getProjectMembers)
router.post('/:id/members', authenticateToken, resolveProjectParam, addProjectMember)
router.delete('/:id/members/:userId', authenticateToken, resolveProjectParam, removeProjectMember)
router.post('/:id/invitations/accept', authenticateToken, resolveProjectParam, acceptProjectInvitation)
router.post('/:id/invitations/decline', authenticateToken, resolveProjectParam, declineProjectInvitation)

// Audit logs and analytics
router.get('/:id/audit-logs', resolveProjectParam, getProjectAuditLogs)
router.get('/:id/analytics', resolveProjectParam, getProjectAnalytics)

export default router
