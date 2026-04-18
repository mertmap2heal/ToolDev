import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import taskTemplateService from '../services/taskTemplate.service'
import { prisma } from '../lib/prisma'

/**
 * #292: taskTemplate routes only went through authenticateToken. This
 * controller enforces:
 *  - createTemplate: if projectId given, caller must be a project member.
 *    Only SUPERIOR_ADMIN may set isGlobal=true.
 *  - updateTemplate / deleteTemplate / getTemplate: caller must be a
 *    project member of the template's projectId, OR the template is
 *    isGlobal and the caller is SUPERIOR_ADMIN to mutate / anyone to read.
 *  - getTemplates: filter to caller's accessible templates.
 */

async function resolveCallerContext(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return {
    isSuperior: user?.role === 'SUPERIOR_ADMIN',
  }
}

async function isMemberOf(userId: string, projectId: string): Promise<boolean> {
  const [member, owner] = await Promise.all([
    prisma.projectMember.findFirst({
      where: { projectId, userId, status: 'accepted' },
      select: { id: true },
    }),
    prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true },
    }),
  ])
  return Boolean(member || owner)
}

export const createTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { isSuperior } = await resolveCallerContext(userId)
    const body = req.body ?? {}

    // Only SUPERIOR_ADMIN may create a global template — every tenant sees
    // globals in the template picker, so a rogue global is a cross-tenant
    // poisoning vector.
    if (body.isGlobal === true && !isSuperior) {
      return res.status(403).json({
        success: false,
        error: 'Only SUPERIOR_ADMIN can create a global template',
      })
    }

    // Non-global templates must be scoped to a project the caller is in.
    if (!body.isGlobal) {
      if (!body.projectId) {
        return res.status(400).json({
          success: false,
          error: 'projectId is required for a non-global template',
        })
      }
      if (!isSuperior && !(await isMemberOf(userId, body.projectId))) {
        return res.status(403).json({
          success: false,
          error: 'Not a member of this project',
        })
      }
    }

    const template = await taskTemplateService.createTemplate(body)

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
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { isSuperior } = await resolveCallerContext(userId)
    const { project_id } = req.query

    // If a specific project was requested, ensure the caller can see it.
    if (typeof project_id === 'string' && project_id.length > 0 && !isSuperior) {
      if (!(await isMemberOf(userId, project_id))) {
        return res.status(403).json({ success: false, error: 'Not a member of this project' })
      }
    }

    const templates = await taskTemplateService.getTemplates(
      typeof project_id === 'string' ? project_id : undefined,
    )

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

async function canAccessTemplate(
  userId: string,
  isSuperior: boolean,
  template: { projectId: string | null; isGlobal: boolean },
): Promise<boolean> {
  if (isSuperior) return true
  if (template.isGlobal) return true // anyone can read a global template
  if (template.projectId) return isMemberOf(userId, template.projectId)
  return false
}

export const getTemplate = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { id } = req.params

    const template = await taskTemplateService.getTemplate(id)

    if (!template) {
      return res.status(404).json({
        success: false,
        error: 'Template not found',
      })
    }

    const { isSuperior } = await resolveCallerContext(userId)
    if (!(await canAccessTemplate(userId, isSuperior, template))) {
      return res.status(404).json({ success: false, error: 'Template not found' })
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
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { id } = req.params
    const body = req.body ?? {}

    const existing = await taskTemplateService.getTemplate(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' })
    }

    const { isSuperior } = await resolveCallerContext(userId)

    // Project-scoped templates: caller must be a member. Global templates:
    // SUPERIOR_ADMIN only.
    if (existing.isGlobal) {
      if (!isSuperior) {
        return res.status(403).json({
          success: false,
          error: 'Only SUPERIOR_ADMIN can modify a global template',
        })
      }
    } else if (existing.projectId) {
      if (!isSuperior && !(await isMemberOf(userId, existing.projectId))) {
        return res.status(404).json({ success: false, error: 'Template not found' })
      }
    } else {
      return res.status(404).json({ success: false, error: 'Template not found' })
    }

    // Only SUPERIOR_ADMIN can toggle isGlobal.
    if (body.isGlobal !== undefined && body.isGlobal !== existing.isGlobal && !isSuperior) {
      return res.status(403).json({
        success: false,
        error: 'Only SUPERIOR_ADMIN can change template scope',
      })
    }

    const template = await taskTemplateService.updateTemplate(id, body)

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
    const userId = req.userId
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' })
    }
    const { id } = req.params

    const existing = await taskTemplateService.getTemplate(id)
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Template not found' })
    }

    const { isSuperior } = await resolveCallerContext(userId)

    if (existing.isGlobal) {
      if (!isSuperior) {
        return res.status(403).json({
          success: false,
          error: 'Only SUPERIOR_ADMIN can delete a global template',
        })
      }
    } else if (existing.projectId) {
      if (!isSuperior && !(await isMemberOf(userId, existing.projectId))) {
        return res.status(404).json({ success: false, error: 'Template not found' })
      }
    } else {
      return res.status(404).json({ success: false, error: 'Template not found' })
    }

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
