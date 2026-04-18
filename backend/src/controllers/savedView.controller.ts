import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { isAdminUser } from '../lib/adminAuth'

/**
 * TaskSavedView access-control helpers (#294).
 *
 * Saved views are either personal (userId set, projectId null) or
 * project-scoped (projectId set). The endpoints are not mounted under
 * :projectId so projectIdParam does not run. Each handler must verify:
 *   - personal view: view.userId === caller.userId
 *   - project view: caller is a member of view.projectId
 *   - admin: sees everything (kept for support tooling).
 */

async function isMemberOfProject(userId: string, projectId: string): Promise<boolean> {
  const [member, owner] = await Promise.all([
    prisma.projectMember.findFirst({
      where: { projectId, userId },
      select: { projectId: true },
    }),
    prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    }),
  ])
  return Boolean(member || owner)
}

async function callerCanAccessView(
  view: { userId: string | null; projectId: string | null },
  callerId: string,
): Promise<boolean> {
  if (view.projectId) return isMemberOfProject(callerId, view.projectId)
  if (view.userId) return view.userId === callerId
  // Neither projectId nor userId — treat as orphaned; only admins see it.
  return false
}

export const getSavedViews = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const rawProjectId = req.query.project_id
    const projectId = typeof rawProjectId === 'string' && rawProjectId.length > 0 ? rawProjectId : null

    const isAdmin = await isAdminUser(userId)

    let where: { projectId: string | null; userId?: string }
    if (projectId) {
      if (!isAdmin && !(await isMemberOfProject(userId, projectId))) {
        return res.status(403).json({ success: false, error: 'Not a project member' })
      }
      where = { projectId }
    } else {
      // Null-project views are personal. Non-admin only sees their own.
      where = isAdmin ? { projectId: null } : { projectId: null, userId }
    }

    const views = await prisma.taskSavedView.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    res.json({ success: true, data: views })
  } catch (error: any) {
    console.error('Get saved views error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { project_id, name, view_type, query_json, columns_json, sort_json, group_json } = req.body

    if (!name || !view_type) {
      return res.status(400).json({
        success: false,
        error: 'name and view_type are required',
      })
    }

    // If a projectId is supplied, the caller must be a member of that project.
    // Null projectId creates a personal view owned by the caller.
    let projectIdToStore: string | null = null
    if (project_id) {
      if (!(await isMemberOfProject(userId, project_id))) {
        return res.status(403).json({ success: false, error: 'Not a project member' })
      }
      projectIdToStore = project_id
    }

    const view = await prisma.taskSavedView.create({
      data: {
        projectId: projectIdToStore,
        userId, // #294: always record the creator so future reads can scope
        name,
        viewType: view_type,
        queryJson: query_json || null,
        columnsJson: columns_json || null,
        sortJson: sort_json || null,
        groupJson: group_json || null,
      },
    })

    res.status(201).json({
      success: true,
      data: view,
    })
  } catch (error: any) {
    console.error('Create saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { id } = req.params

    const view = await prisma.taskSavedView.findUnique({ where: { id } })

    if (!view) {
      return res.status(404).json({
        success: false,
        error: 'Saved view not found',
      })
    }

    const isAdmin = await isAdminUser(userId)
    if (!isAdmin && !(await callerCanAccessView(view, userId))) {
      // Don't confirm existence to a non-authorized caller — return 404.
      return res.status(404).json({ success: false, error: 'Saved view not found' })
    }

    res.json({ success: true, data: view })
  } catch (error: any) {
    console.error('Get saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const updateSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { id } = req.params
    const { name, query_json, columns_json, sort_json, group_json } = req.body

    const existing = await prisma.taskSavedView.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Saved view not found' })
    }

    const isAdmin = await isAdminUser(userId)
    if (!isAdmin && !(await callerCanAccessView(existing, userId))) {
      return res.status(404).json({ success: false, error: 'Saved view not found' })
    }

    const view = await prisma.taskSavedView.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(query_json !== undefined && { queryJson: query_json }),
        ...(columns_json !== undefined && { columnsJson: columns_json }),
        ...(sort_json !== undefined && { sortJson: sort_json }),
        ...(group_json !== undefined && { groupJson: group_json }),
      },
    })

    res.json({ success: true, data: view })
  } catch (error: any) {
    console.error('Update saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteSavedView = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const { id } = req.params

    const existing = await prisma.taskSavedView.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Saved view not found' })
    }

    const isAdmin = await isAdminUser(userId)
    if (!isAdmin && !(await callerCanAccessView(existing, userId))) {
      return res.status(404).json({ success: false, error: 'Saved view not found' })
    }

    await prisma.taskSavedView.delete({ where: { id } })

    res.json({ success: true, data: null })
  } catch (error: any) {
    console.error('Delete saved view error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
