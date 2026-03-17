import { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as service from '../services/requirementExportTemplate.service'

export const list = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const items = await service.list(projectId)
    res.json({ success: true, data: items })
  } catch (error: any) {
    console.error('List export templates error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const listDeleted = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const items = await service.listDeleted(projectId)
    res.json({ success: true, data: items })
  } catch (error: any) {
    console.error('List deleted templates error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getOne = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const item = await service.getOne(projectId, id)
    if (!item) return res.status(404).json({ success: false, error: 'Template not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    console.error('Get export template error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const body = req.body as { name?: string; format?: string; payload?: unknown; visibility?: string }
    const item = await service.create(
      projectId,
      {
        name: body.name ?? '',
        format: (body.format ?? 'pdf') as any,
        payload: body.payload ?? {},
        visibility: body.visibility,
      },
      req.userId
    )
    res.status(201).json({ success: true, data: item })
  } catch (error: any) {
    if (error?.code === 'DUPLICATE_NAME') {
      return res.status(409).json({ success: false, error: error.message, code: error.code })
    }
    if (error?.code === 'VALIDATION') {
      return res.status(400).json({ success: false, error: error.message, code: error.code })
    }
    console.error('Create export template error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const body = req.body as { name?: string; format?: string; payload?: unknown; visibility?: string }
    const existing = await service.getOne(projectId, id)
    if (!existing) return res.status(404).json({ success: false, error: 'Template not found' })
    const item = await service.update(projectId, id, {
      name: body.name,
      format: body.format as any,
      payload: body.payload,
      visibility: body.visibility,
    })
    res.json({ success: true, data: item })
  } catch (error: any) {
    if (error?.code === 'DUPLICATE_NAME') {
      return res.status(409).json({ success: false, error: error.message, code: error.code })
    }
    if (error?.code === 'VALIDATION') {
      return res.status(400).json({ success: false, error: error.message, code: error.code })
    }
    console.error('Update export template error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const deleted = await service.remove(projectId, id, req.userId)
    if (!deleted) return res.status(404).json({ success: false, error: 'Template not found' })
    res.json({ success: true, data: { id: deleted.id } })
  } catch (error: any) {
    console.error('Delete export template error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const restore = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const item = await service.restore(projectId, id, req.userId)
    if (!item) return res.status(404).json({ success: false, error: 'Archived template not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    console.error('Restore export template error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const permanentDelete = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const deleted = await service.permanentDelete(projectId, id)
    if (!deleted) return res.status(404).json({ success: false, error: 'Archived template not found' })
    res.json({ success: true, data: deleted })
  } catch (error: any) {
    console.error('Permanent delete template error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
