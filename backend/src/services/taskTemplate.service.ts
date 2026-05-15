import { prisma } from '../lib/prisma'
import taskService from './task.service'


export interface CreateTemplateDto {
  name: string
  description?: string
  title: string
  descriptionRich?: string
  status?: string
  priority?: string
  estimateMinutes?: number
  tags?: string[]
  checklistItems?: any[]
  projectId?: string
  isGlobal?: boolean
}

export class TaskTemplateService {
  async createTemplate(data: CreateTemplateDto) {
    return prisma.taskTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        title: data.title,
        descriptionRich: data.descriptionRich,
        status: data.status,
        priority: data.priority,
        estimateMinutes: data.estimateMinutes,
        tags: data.tags || [],
        checklistItems: data.checklistItems ? JSON.stringify(data.checklistItems) : undefined,
        projectId: data.projectId,
        isGlobal: data.isGlobal || false,
      },
    })
  }

  async getTemplates(projectId?: string) {
    const where: any = {}

    if (projectId) {
      where.OR = [{ projectId }, { isGlobal: true }]
    } else {
      where.isGlobal = true
    }

    return prisma.taskTemplate.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async getTemplate(id: string) {
    return prisma.taskTemplate.findUnique({
      where: { id },
    })
  }

  async updateTemplate(id: string, data: Partial<CreateTemplateDto>) {
    const updateData: any = {}

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.title !== undefined) updateData.title = data.title
    if (data.descriptionRich !== undefined) updateData.descriptionRich = data.descriptionRich
    if (data.status !== undefined) updateData.status = data.status
    if (data.priority !== undefined) updateData.priority = data.priority
    if (data.estimateMinutes !== undefined) updateData.estimateMinutes = data.estimateMinutes
    if (data.tags !== undefined) updateData.tags = data.tags
    if (data.checklistItems !== undefined) updateData.checklistItems = JSON.stringify(data.checklistItems)
    if (data.isGlobal !== undefined) updateData.isGlobal = data.isGlobal

    return prisma.taskTemplate.update({
      where: { id },
      data: updateData,
    })
  }

  async deleteTemplate(id: string) {
    return prisma.taskTemplate.delete({
      where: { id },
    })
  }

  async createTaskFromTemplate(templateId: string, projectId?: string, overrides?: any) {
    const template = await this.getTemplate(templateId)
    if (!template) {
      throw new Error('Template not found')
    }

    const taskData = {
      projectId: projectId || template.projectId || undefined,
      title: overrides?.title || template.title,
      descriptionRich: overrides?.descriptionRich || template.descriptionRich || '',
      status: overrides?.status || template.status || 'BACKLOG',
      priority: overrides?.priority || template.priority || 'MEDIUM',
      estimateMinutes: overrides?.estimateMinutes || template.estimateMinutes || undefined,
    }

    // Use taskService to create the task
    const task = await taskService.createTask(taskData, undefined)

    // Handle tags if template has them. SEC-2 (#375): TaskTag is now
    // project-scoped; look up / create per (projectId, name).
    if (template.tags && template.tags.length > 0 && task.projectId) {
      for (const tagName of template.tags) {
        try {
          let tag = await prisma.taskTag.findUnique({
            where: {
              projectId_name: {
                projectId: task.projectId,
                name: tagName,
              },
            },
          })
          if (!tag) {
            tag = await prisma.taskTag.create({
              data: {
                name: tagName,
                projectId: task.projectId,
              },
            })
          }
          // Link tag to task
          await prisma.taskTagLink.create({
            data: {
              taskId: task.id,
              tagId: tag.id,
            },
          }).catch(() => {
            // Ignore if already linked
          })
        } catch (error) {
          // Continue if tag creation fails
          console.error('Error linking tag:', error)
        }
      }
    }

    return task
  }
}

export default new TaskTemplateService()
