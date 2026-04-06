import { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as service from '../services/exportJob.service'
import { linkageAuditService } from '../services/linkageAudit.service'

export const list = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const items = await service.list(projectId)
    res.json({ success: true, data: items })
  } catch (error: any) {
    console.error('List export jobs error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getOne = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const item = await service.getOne(projectId, id)
    if (!item) return res.status(404).json({ success: false, error: 'Export job not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const body = req.body as { format?: string; totalCount?: number; label?: string }
    const item = await service.create(
      projectId,
      {
        format: (body.format ?? 'pdf') as any,
        totalCount: body.totalCount ?? 0,
        label: body.label,
      },
      req.userId
    )

    // Audit: export started (project-wide)
    await linkageAuditService.log({
      projectId,
      entityType: 'PROJECT',
      entityId: projectId,
      action: 'REQUIREMENTS_EXPORT_STARTED',
      oldValue: null,
      newValue: {
        kind: 'export_job',
        exportJobId: item.id,
        format: item.format,
        totalCount: item.totalCount,
        label: item.label ?? null,
      },
      performedByUserId: req.userId,
    })

    res.status(201).json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const body = req.body as { status?: string; progress?: number; doneCount?: number; error?: string }
    const before = await service.getOne(projectId, id)
    const item = await service.update(projectId, id, {
      status: body.status as any,
      progress: body.progress,
      doneCount: body.doneCount,
      error: body.error,
    })
    if (!item) return res.status(404).json({ success: false, error: 'Export job not found' })

    // Audit: export completed / failed (project-wide)
    if (before?.status !== item.status && (item.status === 'done' || item.status === 'failed')) {
      await linkageAuditService.log({
        projectId,
        entityType: 'PROJECT',
        entityId: projectId,
        action: item.status === 'done' ? 'REQUIREMENTS_EXPORT_COMPLETED' : 'REQUIREMENTS_EXPORT_FAILED',
        oldValue: before,
        newValue: item,
        performedByUserId: req.userId,
      })
    }

    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const deleted = await service.remove(projectId, id)
    if (!deleted) return res.status(404).json({ success: false, error: 'Export job not found' })
    res.json({ success: true, data: deleted })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const clearCompleted = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const result = await service.clearCompleted(projectId)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
