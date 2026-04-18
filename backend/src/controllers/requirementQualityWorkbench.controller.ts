import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { requirementQualityWorkbenchService } from '../services/requirementQualityWorkbench.service'

export const listQualityDismissals = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.userId!
    const rows = await requirementQualityWorkbenchService.listDismissals(projectId, userId)
    res.json({ success: true, data: rows })
  } catch (error: any) {
    console.error('listQualityDismissals error:', error)
    res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
}

export const upsertQualityDismissals = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.userId!
    const items = req.body?.items as Array<{ requirementId: string; issueKey: string; reason?: string | null }>
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'items array required' })
    }
    await requirementQualityWorkbenchService.upsertDismissals(projectId, userId, items)
    res.json({ success: true })
  } catch (error: any) {
    console.error('upsertQualityDismissals error:', error)
    res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
}

export const deleteQualityDismissal = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.userId!
    const requirementId = req.query.requirementId as string
    const issueKey = req.query.issueKey as string
    if (!requirementId || !issueKey) {
      return res.status(400).json({ success: false, error: 'requirementId and issueKey query params required' })
    }
    const count = await requirementQualityWorkbenchService.deleteDismissal(
      projectId,
      userId,
      requirementId,
      decodeURIComponent(issueKey)
    )
    res.json({ success: true, data: { deleted: count } })
  } catch (error: any) {
    console.error('deleteQualityDismissal error:', error)
    res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
}

export const deleteAllDismissalsForRequirement = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, requirementId } = req.params
    const userId = req.userId!
    const count = await requirementQualityWorkbenchService.deleteAllForRequirement(
      projectId,
      userId,
      requirementId
    )
    res.json({ success: true, data: { deleted: count } })
  } catch (error: any) {
    console.error('deleteAllDismissalsForRequirement error:', error)
    res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
}

export const clearAllDismissalsForProject = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.userId!
    const count = await requirementQualityWorkbenchService.clearAllForProject(projectId, userId)
    res.json({ success: true, data: { deleted: count } })
  } catch (error: any) {
    console.error('clearAllDismissalsForProject error:', error)
    res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
}

export const bulkSkipWarnings = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const userId = req.userId!
    const requirementId = req.body?.requirementId as string
    if (!requirementId) {
      return res.status(400).json({ success: false, error: 'requirementId required' })
    }
    const result = await requirementQualityWorkbenchService.bulkSkipWarnings(projectId, userId, requirementId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    console.error('bulkSkipWarnings error:', error)
    const msg = error?.message || 'Internal server error'
    if (msg === 'Requirement not found') {
      return res.status(404).json({ success: false, error: msg })
    }
    res.status(500).json({ success: false, error: msg })
  }
}
