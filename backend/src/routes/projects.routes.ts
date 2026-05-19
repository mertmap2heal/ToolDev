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
  setProjectStrictMode,
} from '../controllers/project.controller'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { resolveProjectParam } from '../middleware/resolveProjectParam.middleware'
import { requireProjectMember } from '../middleware/requireProjectMember.middleware'
import { requireProjectOwnerOrAdmin } from '../middleware/requireProjectOwnerOrAdmin.middleware'
import {
  listProjectEngineeringRoles,
  listProjectUsersWithRoles,
  getMyProjectEngineeringRoles,
  assignProjectEngineeringRole,
  unassignProjectEngineeringRole,
} from '../controllers/projectStakeholderRoles.controller'
import { getDashboardSummary } from '../controllers/dashboardSummary.controller'

const router = Router()

// Bulk actions (must be before :id routes).  Gated to admins because they
// can mutate or exfiltrate every project (#152, #153, #154).
router.post('/bulk-update', authenticateToken, requireAdmin, bulkUpdateProjects)
router.post('/import', authenticateToken, importProjects)
router.get('/export', authenticateToken, requireAdmin, exportProjects)

// Portfolio dashboard aggregate (RF-2, #484). MUST register before the
// `/:id` routes or Express captures it as `:id="dashboard-summary"`. A
// per-user view — `authenticateToken` only; the service scopes to the
// caller's visible projects (no requireAdmin, no tenant leak).
router.get('/dashboard-summary', authenticateToken, getDashboardSummary)

// Project CRUD
router.post('/', authenticateToken, createProject)
router.get('/', authenticateToken, getProjects)

// Stakeholder / engineering roles (project-scoped) — auth + member required
router.get(
  '/:id/engineering-roles',
  authenticateToken,
  resolveProjectParam,
  requireProjectMember,
  listProjectEngineeringRoles
)
router.get(
  '/:id/users-with-roles',
  authenticateToken,
  resolveProjectParam,
  requireProjectMember,
  listProjectUsersWithRoles
)
router.get(
  '/:id/me/engineering-roles',
  authenticateToken,
  resolveProjectParam,
  requireProjectMember,
  getMyProjectEngineeringRoles
)
router.post(
  '/:id/engineering-roles/:roleId/assign',
  authenticateToken,
  resolveProjectParam,
  requireProjectOwnerOrAdmin,
  assignProjectEngineeringRole
)
router.post(
  '/:id/engineering-roles/:roleId/unassign',
  authenticateToken,
  resolveProjectParam,
  requireProjectOwnerOrAdmin,
  unassignProjectEngineeringRole
)

// Project read requires project membership; mutate/delete requires owner or admin (#152).
router.get('/:id', authenticateToken, resolveProjectParam, requireProjectMember, getProject)
router.put('/:id', authenticateToken, resolveProjectParam, requireProjectOwnerOrAdmin, updateProject)
router.delete('/:id', authenticateToken, resolveProjectParam, requireProjectOwnerOrAdmin, deleteProject)

// Regulated-mode toggle (ROADMAP R-6). Dedicated, audited write path for
// Project.strictMode — owner-or-admin only, reusing the same tenant-scoped
// middleware chain as PUT/DELETE /:id.
router.patch('/:id/strict-mode', authenticateToken, resolveProjectParam, requireProjectOwnerOrAdmin, setProjectStrictMode)

// Team management — reading membership requires membership (#153); writes require owner/admin.
router.get('/:id/members', authenticateToken, resolveProjectParam, requireProjectMember, getProjectMembers)
router.post('/:id/members', authenticateToken, resolveProjectParam, requireProjectOwnerOrAdmin, addProjectMember)
router.delete('/:id/members/:userId', authenticateToken, resolveProjectParam, requireProjectOwnerOrAdmin, removeProjectMember)
router.post('/:id/invitations/accept', authenticateToken, resolveProjectParam, acceptProjectInvitation)
router.post('/:id/invitations/decline', authenticateToken, resolveProjectParam, declineProjectInvitation)

// Audit logs and analytics — project-scoped reads, members only (#153).
router.get('/:id/audit-logs', authenticateToken, resolveProjectParam, requireProjectMember, getProjectAuditLogs)
router.get('/:id/analytics', authenticateToken, resolveProjectParam, requireProjectMember, getProjectAnalytics)

export default router
