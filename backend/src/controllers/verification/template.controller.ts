import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { templateService } from '../../services/verification/template.service'

export const listTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const type = req.query.type as 'TEST_CASE' | 'TEST_PLAN' | undefined
    const includeArchived = req.query.includeArchived === 'true'

    const list = await templateService.list(projectId, { type, includeArchived })
    res.json({ success: true, data: list })
  } catch (error: any) {
    console.error('List templates error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const t = await templateService.get(projectId, id)
    res.json({ success: true, data: t })
  } catch (error: any) {
    console.error('Get template error:', error)
    if (error?.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { type, name } = req.body as { type: 'TEST_CASE' | 'TEST_PLAN'; name: string }
    if (!type || !name) {
      return res.status(400).json({ success: false, error: 'type and name are required' })
    }
    if (type !== 'TEST_CASE' && type !== 'TEST_PLAN') {
      return res.status(400).json({ success: false, error: 'type must be TEST_CASE or TEST_PLAN' })
    }
    const created = await templateService.create(projectId, { type, name })
    res.status(201).json({ success: true, data: created })
  } catch (error: any) {
    console.error('Create template error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const { name, contentJson } = req.body as { name?: string; contentJson?: any }
    const updated = await templateService.update(projectId, id, { name, contentJson })
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Update template error:', error)
    if (error?.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message })
    }
    if (error?.message?.includes('Only draft')) {
      return res.status(400).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const publishTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const updated = await templateService.publish(projectId, id)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Publish template error:', error)
    if (error?.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const duplicateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const duplicated = await templateService.duplicate(projectId, id)
    res.status(201).json({ success: true, data: duplicated })
  } catch (error: any) {
    console.error('Duplicate template error:', error)
    if (error?.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const archiveTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    const updated = await templateService.archive(projectId, id)
    res.json({ success: true, data: updated })
  } catch (error: any) {
    console.error('Archive template error:', error)
    if (error?.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params
    await templateService.softDelete(projectId, id)
    res.status(204).send()
  } catch (error: any) {
    console.error('Delete template error:', error)
    if (error?.message === 'Template not found') {
      return res.status(404).json({ success: false, error: error.message })
    }
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
