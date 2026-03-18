import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import {
  listParameterTypes,
  createParameterType,
  updateParameterType,
  deleteParameterType,
  countTypeUsage,
} from '../services/parameterType.service'

export const getParameterTypes = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const types = await listParameterTypes(projectId)
    res.json({ success: true, data: types })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export const createParameterTypeHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description, color, translations } = req.body as Record<string, unknown>
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'name is required' })
    }
    const t = await createParameterType(projectId, {
      name: name as string,
      description: description as string | undefined,
      color: color as string | undefined,
      translations: translations as Record<string, string> | undefined,
    })
    res.status(201).json({ success: true, data: t })
  } catch (error) {
    const msg = (error as Error).message
    if (msg.includes('Unique constraint')) {
      return res.status(409).json({ success: false, error: 'A type with this name already exists in this project' })
    }
    res.status(500).json({ success: false, error: msg })
  }
}

export const updateParameterTypeHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { name, description, color, translations } = req.body as Record<string, unknown>
    const t = await updateParameterType(id, projectId, {
      name: name as string | undefined,
      description: description as string | undefined,
      color: color as string | undefined,
      translations: translations as Record<string, string> | undefined,
    })
    res.json({ success: true, data: t })
  } catch (error) {
    const msg = (error as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Type not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export const deleteParameterTypeHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const usageCount = await countTypeUsage(projectId, id) // id is actually checked by service
    // Warn but still allow — deletion doesn't break existing parameters (dataType is a plain string)
    await deleteParameterType(id, projectId)
    res.json({ success: true, data: { usageCount } })
  } catch (error) {
    const msg = (error as Error).message
    if (msg === 'Not found') return res.status(404).json({ success: false, error: 'Type not found' })
    res.status(500).json({ success: false, error: msg })
  }
}

export const getParameterTypeUsage = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    // id here is the type name (for usage lookup by name)
    const count = await countTypeUsage(projectId, decodeURIComponent(id))
    res.json({ success: true, data: { count } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}
