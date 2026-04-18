import { Response } from 'express'
import * as service from '../services/adminUserRole.service'
import type { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

/** GET /admin/user-roles - list assignments. Optional query: ?userId=... */
export const list = async (req: AuthRequest, res: Response) => {
  try {
    const callerId = req.userId
    if (!callerId) {
      res.status(401).json({ success: false, error: 'Unauthorized' })
      return
    }
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined

    // #288: non-SUPERIOR_ADMIN sees only assignments for users in their
    // own company. SUPERIOR_ADMIN retains full visibility.
    const me = await prisma.user.findUnique({
      where: { id: callerId },
      select: { company: true, role: true },
    })
    const isSuperior = me?.role === 'SUPERIOR_ADMIN'
    const callerCompany = me?.company ?? null

    const data = await service.listAssignments(
      userId,
      isSuperior ? undefined : callerCompany,
    )
    res.json({ success: true, data })
  } catch (e) {
    console.error('Admin user-role list error:', e)
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}

/** POST /admin/user-roles - assign admin role to user. Body: { userId, adminRoleId } */
export const assign = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, adminRoleId } = req.body ?? {}
    if (typeof userId !== 'string' || !userId.trim()) {
      res.status(400).json({ success: false, error: 'userId is required' })
      return
    }
    if (typeof adminRoleId !== 'string' || !adminRoleId.trim()) {
      res.status(400).json({ success: false, error: 'adminRoleId is required' })
      return
    }
    const assignedBy = req.user?.userId ?? req.userId ?? null
    const data = await service.assignRole(userId, adminRoleId, assignedBy)
    res.status(201).json({ success: true, data })
  } catch (e) {
    const err = e as Error & { code?: string; target?: string }
    if (err.code === 'DUPLICATE') {
      res.status(409).json({ success: false, error: err.message })
      return
    }
    if (err.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, error: err.message })
      return
    }
    console.error('Admin user-role assign error:', e)
    res.status(500).json({ success: false, error: err.message })
  }
}

/** DELETE /admin/user-roles?userId=...&adminRoleId=... - revoke */
export const revoke = async (req: AuthRequest, res: Response) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : undefined
    const adminRoleId = typeof req.query.adminRoleId === 'string' ? req.query.adminRoleId : undefined
    if (!userId || !adminRoleId) {
      res.status(400).json({
        success: false,
        error: 'userId and adminRoleId query parameters are required',
      })
      return
    }
    const removed = await service.revokeRole(userId, adminRoleId)
    if (!removed) {
      res.status(404).json({ success: false, error: 'Assignment not found' })
      return
    }
    res.json({ success: true, data: { userId, adminRoleId } })
  } catch (e) {
    console.error('Admin user-role revoke error:', e)
    res.status(500).json({ success: false, error: (e as Error).message })
  }
}
