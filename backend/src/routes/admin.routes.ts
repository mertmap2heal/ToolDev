import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import { getRoles, createRole, updateRole, getAuditLog } from '../controllers/admin.controller'
import {
    getEngineeringRoles,
    createEngineeringRole,
    updateEngineeringRole,
    deleteEngineeringRole,
    assignEngineeringRole,
    unassignEngineeringRole,
    getUsersWithRoles,
} from '../controllers/engineeringRoles.controller'

const router = Router()

router.use(authenticateToken, requireAdmin)

// Permission-based roles (AdminRole)
router.get('/roles', getRoles)
router.post('/roles', createRole)
router.put('/roles/:id', updateRole)

// Engineering roles (EngineeringRole)
router.get('/engineering-roles', getEngineeringRoles)
router.post('/engineering-roles', createEngineeringRole)
router.put('/engineering-roles/:id', updateEngineeringRole)
router.delete('/engineering-roles/:id', deleteEngineeringRole)
router.post('/engineering-roles/:id/assign', assignEngineeringRole)
router.post('/engineering-roles/:id/unassign', unassignEngineeringRole)

// Users with engineering roles (stakeholder directory)
router.get('/users-with-roles', getUsersWithRoles)

// Audit log
router.get('/audit-log', getAuditLog)

export default router
