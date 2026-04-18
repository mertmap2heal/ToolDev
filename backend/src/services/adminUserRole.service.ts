/**
 * Admin user-role (AdminRole) assignment service.
 * Persists admin permission-role assignments in the UserAdminRole junction table.
 */
import { prisma } from '../lib/prisma'

export interface AdminUserRoleAssignment {
  id: string
  userId: string
  adminRoleId: string
  assignedAt: Date
  assignedBy: string | null
}

/**
 * List admin user-role assignments. Optionally filter by userId AND/OR by
 * the caller's companyKey (pass `undefined` for no company filter — used
 * for SUPERIOR_ADMIN and the controller-owned tenant filter in #288).
 */
export async function listAssignments(
  userId?: string,
  callerCompany?: string | null,
): Promise<AdminUserRoleAssignment[]> {
  const where: { userId?: string; user?: { company: string | null } } = {}
  if (userId) where.userId = userId
  if (callerCompany !== undefined) {
    where.user = { company: callerCompany }
  }
  return prisma.userAdminRole.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    orderBy: { assignedAt: 'asc' },
  })
}

/** List admin role ids assigned to a single user. */
export async function listRolesForUser(userId: string): Promise<string[]> {
  const rows = await prisma.userAdminRole.findMany({
    where: { userId },
    select: { adminRoleId: true },
  })
  return rows.map((r) => r.adminRoleId)
}

/** Assign an admin role to a user. Throws on duplicate (handled by controller -> 409). */
export async function assignRole(
  userId: string,
  adminRoleId: string,
  assignedBy: string | null
): Promise<AdminUserRoleAssignment> {
  // Validate existence to give a clear 404/400 vs a raw FK error.
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!user) {
    throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND', target: 'user' })
  }
  const role = await prisma.adminRole.findUnique({ where: { id: adminRoleId }, select: { id: true } })
  if (!role) {
    throw Object.assign(new Error('Admin role not found'), { code: 'NOT_FOUND', target: 'role' })
  }

  const existing = await prisma.userAdminRole.findUnique({
    where: { userId_adminRoleId: { userId, adminRoleId } },
  })
  if (existing) {
    throw Object.assign(new Error('User already has this admin role'), { code: 'DUPLICATE' })
  }

  return prisma.userAdminRole.create({
    data: { userId, adminRoleId, assignedBy },
  })
}

/** Revoke an admin role from a user. Returns true if a row was deleted. */
export async function revokeRole(userId: string, adminRoleId: string): Promise<boolean> {
  const result = await prisma.userAdminRole.deleteMany({
    where: { userId, adminRoleId },
  })
  return result.count > 0
}
