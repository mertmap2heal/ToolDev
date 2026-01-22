import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import taskTemplateService from '../services/taskTemplate.service'

export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const template = await taskTemplateService.createTemplate(req.body)

    res.status(201).json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    console.error('Create template error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query

    const templates = await taskTemplateService.getTemplates(project_id as string | undefined)

    res.json({
      success: true,
      data: templates,
    })
  } catch (error: any) {
    console.error('Get templates error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const template = await taskTemplateService.getTemplate(id)

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    console.error('Get template error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const updateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const template = await taskTemplateService.updateTemplate(id, req.body)

    res.json({
      success: true,
      data: template,
    })
  } catch (error: any) {
    console.error('Update template error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await taskTemplateService.deleteTemplate(id)

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Delete template error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createTaskFromTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { project_id, ...overrides } = req.body

    const task = await taskTemplateService.createTaskFromTemplate(id, project_id, overrides)

    res.status(201).json({
      success: true,
      data: task,
    })
  } catch (error: any) {
    console.error('Create task from template error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
