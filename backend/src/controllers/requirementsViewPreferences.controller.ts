import { Response } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from '../middleware/auth.middleware'

const VIEW_TYPE = 'REQUIREMENTS_VIEW_PREFERENCES'

export const getRequirementsViewPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    const { projectId } = req.params
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const row = await prisma.taskSavedView.findFirst({
      where: {
        projectId,
        userId,
        viewType: VIEW_TYPE,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const prefsJson = row?.columnsJson || row?.queryJson || null
    const prefs = prefsJson ? (() => { try { return JSON.parse(prefsJson) } catch { return null } })() : null

    return res.json({ success: true, data: prefs })
  } catch (error: any) {
    console.error('Get requirements view preferences error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateRequirementsViewPreferences = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    const { projectId } = req.params
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' })

    const preferences = req.body?.preferences ?? req.body
    if (!preferences || typeof preferences !== 'object' || Array.isArray(preferences)) {
      return res.status(400).json({ success: false, error: 'preferences object required' })
    }

    const existing = await prisma.taskSavedView.findFirst({
      where: {
        projectId,
        userId,
        viewType: VIEW_TYPE,
      },
      orderBy: { updatedAt: 'desc' },
    })

    const data = {
      projectId,
      userId,
      name: 'Requirements view preferences',
      viewType: VIEW_TYPE,
      columnsJson: JSON.stringify(preferences),
    }

    const saved = existing
      ? await prisma.taskSavedView.update({ where: { id: existing.id }, data })
      : await prisma.taskSavedView.create({ data })

    return res.json({ success: true, data: saved })
  } catch (error: any) {
    console.error('Update requirements view preferences error:', error)
    return res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

