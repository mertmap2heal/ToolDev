import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getTemplates = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const templates = await prisma.requirementTemplate.findMany({
      where: { projectId },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })

    res.json({
      success: true,
      data: templates.map((t) => ({
        ...t,
        templateFields: t.templateFields ? JSON.parse(t.templateFields) : {},
      })),
    })
  } catch (error: any) {
    console.error('Get templates error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const getTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, templateId } = req.params
    const template = await prisma.requirementTemplate.findFirst({
      where: {
        projectId,
        id: templateId,
      },
    })

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    res.json({
      success: true,
      data: {
        ...template,
        templateFields: template.templateFields ? JSON.parse(template.templateFields) : {},
      },
    })
  } catch (error: any) {
    console.error('Get template error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { name, description, requirementType, category, templateFields, isDefault } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Name is required',
      })
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.requirementTemplate.updateMany({
        where: { projectId, isDefault: true },
        data: { isDefault: false },
      })
    }

    const template = await prisma.requirementTemplate.create({
      data: {
        projectId,
        name,
        description: description || null,
        requirementType: requirementType || null,
        category: category || null,
        templateFields: templateFields ? JSON.stringify(templateFields) : null,
        isDefault: isDefault || false,
      },
    })

    res.status(201).json({
      success: true,
      data: {
        ...template,
        templateFields: template.templateFields ? JSON.parse(template.templateFields) : {},
      },
    })
  } catch (error: any) {
    console.error('Create template error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const updateTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, templateId } = req.params
    const updateData = req.body

    const existing = await prisma.requirementTemplate.findFirst({
      where: {
        projectId,
        id: templateId,
      },
    })

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    // If setting as default, unset other defaults
    if (updateData.isDefault === true) {
      await prisma.requirementTemplate.updateMany({
        where: { projectId, isDefault: true, id: { not: templateId } },
        data: { isDefault: false },
      })
    }

    const updated = await prisma.requirementTemplate.update({
      where: { id: existing.id },
      data: {
        name: updateData.name !== undefined ? updateData.name : undefined,
        description: updateData.description !== undefined ? (updateData.description || null) : undefined,
        requirementType: updateData.requirementType !== undefined ? (updateData.requirementType || null) : undefined,
        category: updateData.category !== undefined ? (updateData.category || null) : undefined,
        templateFields: updateData.templateFields !== undefined ? JSON.stringify(updateData.templateFields) : undefined,
        isDefault: updateData.isDefault !== undefined ? updateData.isDefault : undefined,
      },
    })

    res.json({
      success: true,
      data: {
        ...updated,
        templateFields: updated.templateFields ? JSON.parse(updated.templateFields) : {},
      },
    })
  } catch (error: any) {
    console.error('Update template error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

export const deleteTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, templateId } = req.params

    const template = await prisma.requirementTemplate.findFirst({
      where: {
        projectId,
        id: templateId,
      },
    })

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    await prisma.requirementTemplate.delete({
      where: { id: template.id },
    })

    res.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete template error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}
