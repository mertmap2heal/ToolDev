import { Response } from 'express'
import { prisma } from '../lib/prisma'
import type { AuthRequest } from '../middleware/auth.middleware'

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

async function seedEngineeringRolesIfEmpty(): Promise<void> {
  const count = await prisma.engineeringRole.count()
  if (count > 0) return
  for (const name of PREDEFINED_ROLES) {
    await prisma.engineeringRole.create({
      data: { name, isSystem: true },
    })
  }
}

async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, role: true },
  })
  if (!user) return false
  if (user.role === 'SUPERIOR_ADMIN' || user.role === 'COMPANY_ADMIN') return true
  const list = process.env.ADMIN_EMAILS
  if (list && user.email) {
    const emails = list.split(',').map((e) => e.trim().toLowerCase())
    if (emails.includes(user.email.toLowerCase())) return true
  }
  return false
}

/** Accepted project member, or legacy project owner (userId on Project). */
async function getProjectAccessLevel(
  projectId: string,
  userId: string
): Promise<'none' | 'viewer' | 'member' | 'owner'> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true },
  })
  if (!project) return 'none'
  if (project.userId === userId) return 'owner'

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  })
  if (!member || member.status !== 'accepted') return 'none'
  if (member.role === 'owner') return 'owner'
  if (member.role === 'member') return 'member'
  if (member.role === 'viewer') return 'viewer'
  return 'none'
}

function canManageStakeholderRoles(level: 'none' | 'viewer' | 'member' | 'owner'): boolean {
  return level === 'owner' || level === 'member'
}

async function assertProjectView(req: AuthRequest, res: Response, projectId: string): Promise<boolean> {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return false
  }
  if (await isPlatformAdmin(userId)) return true
  const level = await getProjectAccessLevel(projectId, userId)
  if (level === 'none') {
    res.status(403).json({ success: false, error: 'Project access denied' })
    return false
  }
  return true
}

async function assertProjectManageRoles(req: AuthRequest, res: Response, projectId: string): Promise<boolean> {
  const userId = req.userId
  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized' })
    return false
  }
  if (await isPlatformAdmin(userId)) return true
  const level = await getProjectAccessLevel(projectId, userId)
  if (!canManageStakeholderRoles(level)) {
    res.status(403).json({ success: false, error: 'Insufficient permission to manage stakeholder roles' })
    return false
  }
  return true
}

/** Project user ids: accepted team members + project owner (if not already in set). */
async function getProjectUserIds(projectId: string): Promise<Set<string>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      teamMembers: { where: { status: 'accepted' }, select: { userId: true } },
    },
  })
  const ids = new Set<string>()
  if (!project) return ids
  ids.add(project.userId)
  for (const m of project.teamMembers) ids.add(m.userId)
  return ids
}

async function writeAudit(
  projectId: string,
  actorUserId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        projectId,
        userId: actorUserId,
        action,
        details: JSON.stringify(details),
      },
    })
  } catch (e) {
    console.error('AuditLog write failed:', e)
  }
}

/** GET /projects/:id/engineering-roles */
export const listProjectEngineeringRoles = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id
    if (!(await assertProjectView(req, res, projectId))) return

    await seedEngineeringRolesIfEmpty()
    const roles = await prisma.engineeringRole.findMany({
      orderBy: { name: 'asc' },
      include: {
        projectAssignments: {
          where: { projectId },
          select: { userId: true },
        },
      },
    })

    const data = roles.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isSystem: r.isSystem,
      userCount: r.projectAssignments.length,
      assignedUsers: [] as { id: string; name: string; email: string }[],
    }))

    const userIds = new Set<string>()
    for (const r of roles) {
      for (const a of r.projectAssignments) userIds.add(a.userId)
    }
    if (userIds.size > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true },
      })
      const byId = new Map(users.map((u) => [u.id, u]))
      for (let i = 0; i < roles.length; i++) {
        const r = roles[i]
        const assigned = r.projectAssignments.map((a) => byId.get(a.userId)).filter(Boolean) as {
          id: string
          name: string
          email: string
        }[]
        data[i].assignedUsers = assigned.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        }))
      }
    }

    res.json({ success: true, data })
  } catch (error) {
    console.error('listProjectEngineeringRoles:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** GET /projects/:id/users-with-roles — directory scoped to project members + project-scoped assignments */
export const listProjectUsersWithRoles = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id
    if (!(await assertProjectView(req, res, projectId))) return

    const allowedIds = await getProjectUserIds(projectId)
    if (allowedIds.size === 0) {
      res.json({ success: true, data: [] })
      return
    }

    const assignments = await prisma.projectUserEngineeringRole.findMany({
      where: { projectId, userId: { in: [...allowedIds] } },
      include: {
        role: { select: { id: true, name: true } },
      },
    })
    const rolesByUser = new Map<string, { id: string; name: string }[]>()
    for (const a of assignments) {
      const list = rolesByUser.get(a.userId) ?? []
      list.push({ id: a.role.id, name: a.role.name })
      rolesByUser.set(a.userId, list)
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: [...allowedIds] },
        NOT: { role: 'SUPERIOR_ADMIN' },
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { name: 'asc' },
    })

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      company: u.company,
      status: 'Active' as const,
      engineeringRoles: rolesByUser.get(u.id) ?? [],
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    }))

    res.json({ success: true, data })
  } catch (error) {
    console.error('listProjectUsersWithRoles:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** GET /projects/:id/me/engineering-roles */
export const getMyProjectEngineeringRoles = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id
    const userId = req.userId
    if (!userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    if (!(await assertProjectView(req, res, projectId))) return

    const rows = await prisma.projectUserEngineeringRole.findMany({
      where: { projectId, userId },
      include: { role: { select: { id: true, name: true } } },
    })
    const roles = rows.map((r) => ({ id: r.role.id, name: r.role.name }))
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { strictLifecycleGates: true },
    })
    res.json({
      success: true,
      data: {
        roles,
        strictLifecycleGates: project?.strictLifecycleGates ?? false,
      },
    })
  } catch (error) {
    console.error('getMyProjectEngineeringRoles:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** POST /projects/:id/engineering-roles/:roleId/assign body: { userIds: string[] } */
export const assignProjectEngineeringRole = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id
    const roleId = req.params.roleId
    const actorId = req.userId
    if (!actorId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    if (!(await assertProjectManageRoles(req, res, projectId))) return

    const { userIds } = req.body as { userIds?: string[] }
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, error: 'userIds array is required' })
      return
    }

    const role = await prisma.engineeringRole.findUnique({ where: { id: roleId } })
    if (!role) {
      res.status(404).json({ success: false, error: 'Role not found' })
      return
    }

    const allowedIds = await getProjectUserIds(projectId)
    const invalid = userIds.filter((id) => !allowedIds.has(id))
    if (invalid.length > 0) {
      res.status(400).json({
        success: false,
        error: 'All users must be project members',
        invalidUserIds: invalid,
      })
      return
    }

    await prisma.projectUserEngineeringRole.createMany({
      data: userIds.map((userId) => ({
        projectId,
        userId,
        roleId,
        assignedByUserId: actorId,
      })),
      skipDuplicates: true,
    })

    await writeAudit(projectId, actorId, 'stakeholder.role.assign', {
      roleId,
      roleName: role.name,
      userIds,
    })

    const userCount = await prisma.projectUserEngineeringRole.count({
      where: { projectId, roleId },
    })
    res.json({ success: true, data: { roleId, userCount } })
  } catch (error) {
    console.error('assignProjectEngineeringRole:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** POST /projects/:id/engineering-roles/:roleId/unassign body: { userIds: string[] } */
export const unassignProjectEngineeringRole = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = req.params.id
    const roleId = req.params.roleId
    const actorId = req.userId
    if (!actorId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    if (!(await assertProjectManageRoles(req, res, projectId))) return

    const { userIds } = req.body as { userIds?: string[] }
    if (!Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, error: 'userIds array is required' })
      return
    }

    const role = await prisma.engineeringRole.findUnique({ where: { id: roleId } })
    if (!role) {
      res.status(404).json({ success: false, error: 'Role not found' })
      return
    }

    await prisma.projectUserEngineeringRole.deleteMany({
      where: { projectId, roleId, userId: { in: userIds } },
    })

    await writeAudit(projectId, actorId, 'stakeholder.role.unassign', {
      roleId,
      roleName: role.name,
      userIds,
    })

    const userCount = await prisma.projectUserEngineeringRole.count({
      where: { projectId, roleId },
    })
    res.json({ success: true, data: { roleId, userCount } })
  } catch (error) {
    console.error('unassignProjectEngineeringRole:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}
