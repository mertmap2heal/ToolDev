import { Response } from 'express'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth.middleware'

/**
 * #287: engineering-role assignments and the stakeholder directory must be
 * tenant-scoped. The role catalog is still global for now — adding a
 * companyKey column is a schema change tracked separately. What we can do
 * without a migration:
 *   - getUsersWithRoles filters out users from other companies (admin bypass
 *     for SUPERIOR_ADMIN)
 *   - assign / unassign reject userIds that do not belong to the caller's
 *     company (admin bypass for SUPERIOR_ADMIN)
 */
async function resolveCallerCompany(userId: string): Promise<{
  company: string | null
  isSuperior: boolean
}> {
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { company: true, role: true },
  })
  return {
    company: me?.company ?? null,
    isSuperior: me?.role === 'SUPERIOR_ADMIN',
  }
}


const PREDEFINED_ROLES = [
    'Systems Engineer',
    'Requirements Engineer',
    'Design Engineer',
    'Integration Engineer',
    'Test Engineer',
    'Verification Engineer',
    'Validation Engineer',
    'Configuration Manager',
    'Quality Assurance',
    'Project Manager',
    'Safety Engineer',
    'Software Engineer',
    'Hardware Engineer',
    'Systems Architect',
    'Test Manager',
    'Compliance Engineer',
]

/** Seed predefined engineering roles if table is empty */
async function seedIfEmpty(): Promise<void> {
    const count = await prisma.engineeringRole.count()
    if (count > 0) return
    for (const name of PREDEFINED_ROLES) {
        await prisma.engineeringRole.create({
            data: { name, isSystem: true },
        })
    }
}

/** GET /admin/engineering-roles — list all engineering roles with user count + assigned users */
export const getEngineeringRoles = async (_req: AuthRequest, res: Response) => {
    try {
        await seedIfEmpty()
        const roles = await prisma.engineeringRole.findMany({
            orderBy: { name: 'asc' },
            include: {
                users: {
                    include: {
                        user: { select: { id: true, name: true, email: true, company: true } },
                    },
                },
            },
        })
        const data = roles.map((r) => ({
            id: r.id,
            name: r.name,
            description: r.description,
            isSystem: r.isSystem,
            userCount: r.users.length,
            assignedUsers: r.users.map((ur) => ({
                id: ur.user.id,
                name: ur.user.name,
                email: ur.user.email,
            })),
        }))
        res.json({ success: true, data })
    } catch (error) {
        console.error('Engineering roles list error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
}

/** POST /admin/engineering-roles — create role. Body: { name, description? } */
export const createEngineeringRole = async (req: AuthRequest, res: Response) => {
    try {
        const { name, description } = req.body
        if (!name || typeof name !== 'string' || !name.trim()) {
            res.status(400).json({ success: false, error: 'Name is required' })
            return
        }
        const trimmed = name.trim()
        const existing = await prisma.engineeringRole.findUnique({ where: { name: trimmed } })
        if (existing) {
            res.status(400).json({ success: false, error: `Role "${trimmed}" already exists` })
            return
        }
        const role = await prisma.engineeringRole.create({
            data: {
                name: trimmed,
                description: description?.trim() || null,
                isSystem: false,
            },
        })
        res.status(201).json({
            success: true,
            data: {
                id: role.id,
                name: role.name,
                description: role.description,
                isSystem: role.isSystem,
                userCount: 0,
                assignedUsers: [],
            },
        })
    } catch (error) {
        console.error('Engineering role create error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
}

/** PUT /admin/engineering-roles/:id — update role. Body: { name?, description? } */
export const updateEngineeringRole = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params
        const { name, description } = req.body

        const role = await prisma.engineeringRole.findUnique({ where: { id } })
        if (!role) {
            res.status(404).json({ success: false, error: 'Role not found' })
            return
        }

        const data: { name?: string; description?: string | null } = {}
        if (name !== undefined && typeof name === 'string') {
            const trimmed = name.trim()
            if (!trimmed) {
                res.status(400).json({ success: false, error: 'Name cannot be empty' })
                return
            }
            if (trimmed !== role.name) {
                const existing = await prisma.engineeringRole.findUnique({ where: { name: trimmed } })
                if (existing) {
                    res.status(400).json({ success: false, error: `Role "${trimmed}" already exists` })
                    return
                }
                data.name = trimmed
            }
        }
        if (description !== undefined) {
            data.description = typeof description === 'string' ? description.trim() || null : null
        }

        const updated = await prisma.engineeringRole.update({ where: { id }, data })
        const userCount = await prisma.userEngineeringRole.count({ where: { roleId: id } })
        res.json({
            success: true,
            data: {
                id: updated.id,
                name: updated.name,
                description: updated.description,
                isSystem: updated.isSystem,
                userCount,
            },
        })
    } catch (error) {
        console.error('Engineering role update error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
}

/** DELETE /admin/engineering-roles/:id — delete role (only non-system, no active users) */
export const deleteEngineeringRole = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params
        const role = await prisma.engineeringRole.findUnique({
            where: { id },
            include: { users: { include: { user: { select: { id: true } } } } },
        })
        if (!role) {
            res.status(404).json({ success: false, error: 'Role not found' })
            return
        }
        if (role.isSystem) {
            res.status(400).json({ success: false, error: 'Cannot delete a predefined system role' })
            return
        }
        if (role.users.length > 0) {
            res.status(400).json({
                success: false,
                error: `Cannot delete role "${role.name}": ${role.users.length} user(s) still assigned. Remove assignments first.`,
            })
            return
        }
        await prisma.engineeringRole.delete({ where: { id } })
        res.json({ success: true, data: { id } })
    } catch (error) {
        console.error('Engineering role delete error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
}

/** POST /admin/engineering-roles/:id/assign — assign role to users. Body: { userIds: string[] } */
export const assignEngineeringRole = async (req: AuthRequest, res: Response) => {
    try {
        const callerId = req.userId
        if (!callerId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }
        const { id } = req.params
        const { userIds } = req.body
        if (!Array.isArray(userIds) || userIds.length === 0) {
            res.status(400).json({ success: false, error: 'userIds array is required' })
            return
        }
        const role = await prisma.engineeringRole.findUnique({ where: { id } })
        if (!role) {
            res.status(404).json({ success: false, error: 'Role not found' })
            return
        }

        // #287: reject any userId whose company !== caller's (SUPERIOR_ADMIN bypass).
        const { company: callerCompany, isSuperior } = await resolveCallerCompany(callerId)
        if (!isSuperior) {
            const targets = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, company: true },
            })
            const foreign = targets.filter((t) => (t.company ?? null) !== callerCompany)
            if (foreign.length > 0 || targets.length !== userIds.length) {
                res.status(403).json({
                    success: false,
                    error: 'Cannot assign roles to users outside your company',
                })
                return
            }
        }

        // Use createMany with skipDuplicates so re-assigns are idempotent
        await prisma.userEngineeringRole.createMany({
            data: userIds.map((userId: string) => ({ userId, roleId: id })),
            skipDuplicates: true,
        })
        const userCount = await prisma.userEngineeringRole.count({ where: { roleId: id } })
        res.json({ success: true, data: { roleId: id, userCount } })
    } catch (error) {
        console.error('Engineering role assign error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
}

/** POST /admin/engineering-roles/:id/unassign — remove role from users. Body: { userIds: string[] } */
export const unassignEngineeringRole = async (req: AuthRequest, res: Response) => {
    try {
        const callerId = req.userId
        if (!callerId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }
        const { id } = req.params
        const { userIds } = req.body
        if (!Array.isArray(userIds) || userIds.length === 0) {
            res.status(400).json({ success: false, error: 'userIds array is required' })
            return
        }

        // #287: non-SUPERIOR_ADMIN must only touch users in their own company.
        const { company: callerCompany, isSuperior } = await resolveCallerCompany(callerId)
        let allowedUserIds = userIds as string[]
        if (!isSuperior) {
            const targets = await prisma.user.findMany({
                where: { id: { in: userIds } },
                select: { id: true, company: true },
            })
            allowedUserIds = targets
                .filter((t) => (t.company ?? null) === callerCompany)
                .map((t) => t.id)
            if (allowedUserIds.length === 0) {
                res.status(403).json({
                    success: false,
                    error: 'Cannot unassign roles for users outside your company',
                })
                return
            }
        }

        await prisma.userEngineeringRole.deleteMany({
            where: { roleId: id, userId: { in: allowedUserIds } },
        })
        const userCount = await prisma.userEngineeringRole.count({ where: { roleId: id } })
        res.json({ success: true, data: { roleId: id, userCount } })
    } catch (error) {
        console.error('Engineering role unassign error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
}

/** GET /admin/users-with-roles — list all users with their engineering roles (for stakeholder directory) */
export const getUsersWithRoles = async (req: AuthRequest, res: Response) => {
    try {
        const callerId = req.userId
        if (!callerId) {
            res.status(401).json({ success: false, error: 'Unauthorized' })
            return
        }
        const { company: callerCompany, isSuperior } = await resolveCallerCompany(callerId)

        // #287: tenant-scope the directory. SUPERIOR_ADMIN keeps full view;
        // everyone else sees only users in their own company.
        const where = isSuperior ? {} : { company: callerCompany }
        const users = await prisma.user.findMany({
            where,
            select: {
                id: true,
                name: true,
                email: true,
                company: true,
                role: true,
                lastLoginAt: true,
                createdAt: true,
                updatedAt: true,
                engineeringRoles: {
                    include: {
                        role: { select: { id: true, name: true } },
                    },
                },
            },
            orderBy: { name: 'asc' },
        })

        const data = users
            .filter((u) => u.role !== 'SUPERIOR_ADMIN') // exclude platform admins
            .map((u) => ({
                id: u.id,
                name: u.name,
                email: u.email,
                company: u.company,
                status: 'Active' as const,
                engineeringRoles: u.engineeringRoles.map((ur) => ({
                    id: ur.role.id,
                    name: ur.role.name,
                })),
                lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
                createdAt: u.createdAt.toISOString(),
                updatedAt: u.updatedAt.toISOString(),
            }))

        res.json({ success: true, data })
    } catch (error) {
        console.error('Users with roles error:', error)
        res.status(500).json({ success: false, error: 'Internal server error' })
    }
}
