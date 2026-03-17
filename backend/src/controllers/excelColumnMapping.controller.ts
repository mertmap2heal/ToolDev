import { Response } from 'express'
import type { AuthRequest } from '../middleware/auth.middleware'
import * as service from '../services/excelColumnMapping.service'

export const list = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const items = await service.list(projectId)
    res.json({ success: true, data: items })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getOne = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const item = await service.getOne(projectId, id)
    if (!item) return res.status(404).json({ success: false, error: 'Mapping not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const create = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const body = req.body as { name?: string; description?: string; mappings?: any[] }
    const item = await service.create(
      projectId,
      {
        name: body.name ?? '',
        description: body.description,
        mappings: body.mappings ?? [],
      },
      req.userId
    )
    res.status(201).json({ success: true, data: item })
  } catch (error: any) {
    if (error?.code === 'DUPLICATE_NAME') return res.status(409).json({ success: false, error: error.message, code: error.code })
    if (error?.code === 'VALIDATION') return res.status(400).json({ success: false, error: error.message, code: error.code })
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const update = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const body = req.body as { name?: string; description?: string; mappings?: any[] }
    const item = await service.update(projectId, id, body)
    if (!item) return res.status(404).json({ success: false, error: 'Mapping not found' })
    res.json({ success: true, data: item })
  } catch (error: any) {
    if (error?.code === 'DUPLICATE_NAME') return res.status(409).json({ success: false, error: error.message, code: error.code })
    if (error?.code === 'VALIDATION') return res.status(400).json({ success: false, error: error.message, code: error.code })
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const remove = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const deleted = await service.remove(projectId, id)
    if (!deleted) return res.status(404).json({ success: false, error: 'Mapping not found' })
    res.json({ success: true, data: deleted })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
