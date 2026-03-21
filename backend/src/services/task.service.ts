import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'


// Access Control Placeholder (future):
// RBAC/permissions will be implemented later.
// For MVP, all authenticated users can access all tasks.

export interface CreateTaskDto {
  projectId?: string
  title: string
  descriptionRich?: string
  status?: string
  priority?: string
  startDate?: Date
  dueDate?: Date
  estimateMinutes?: number
  blocked?: boolean
  blockedReason?: string
  parentTaskId?: string
  tagIds?: string[]
}

export interface UpdateTaskDto extends Partial<CreateTaskDto> {}

export interface ListTasksFilters {
  projectId?: string
  assignedToUserId?: string
  search?: string
  status?: string
  priority?: string
  dueFrom?: Date
  dueTo?: Date
  createdFrom?: Date
  createdTo?: Date
  tag?: string
  blocked?: boolean
  hasAttachments?: boolean
  hasComments?: boolean
  overdue?: boolean
  hasDependencies?: boolean
  sort?: string
  groupBy?: string
  page?: number
  pageSize?: number
}

export class TaskService {
  async createTask(data: CreateTaskDto, correlationId?: string): Promise<any> {
    // Validate blocked_reason if blocked
    if (data.blocked && !data.blockedReason) {
      throw new Error('blocked_reason is required when blocked is true')
    }

    // Validate title
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('title is required')
    }

    const corrId = correlationId || randomUUID()

    // Create task
    const task = await prisma.task.create({
      data: {
        projectId: data.projectId || null,
        title: data.title,
        descriptionRich: data.descriptionRich || '',
        status: data.status || 'BACKLOG',
        priority: data.priority || 'MEDIUM',
        startDate: data.startDate || null,
        dueDate: data.dueDate || null,
        estimateMinutes: data.estimateMinutes || null,
        blocked: data.blocked || false,
        blockedReason: data.blockedReason || null,
        parentTaskId: data.parentTaskId || null,
        sortOrder: 0,
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // Link tags if provided
    if (data.tagIds && data.tagIds.length > 0) {
      await Promise.all(
        data.tagIds.map((tagId) =>
          prisma.taskTagLink.create({
            data: {
              taskId: task.id,
              tagId,
            },
          })
        )
      )
    }

    // Write audit log
    await prisma.taskAuditLog.create({
      data: {
        entityType: 'TASK',
        entityId: task.id,
        action: 'CREATE',
        afterJson: JSON.stringify(task),
        correlationId: corrId,
      },
    })

    // Write activity feed
    await prisma.activityFeed.create({
      data: {
        taskId: task.id,
        eventType: 'task_created',
        payloadJson: JSON.stringify({ taskId: task.id, title: task.title }),
        correlationId: corrId,
      },
    })

    // Trigger automation
    const { default: automationService } = await import('./automation.service')
    await automationService.triggerAutomation('task_created', task, {}, corrId).catch((err) => {
      console.error('Automation trigger error:', err)
      // Don't fail task creation if automation fails
    })

    // Get full task with relations
    return this.getTask(task.id)
  }

  async updateTask(
    taskId: string,
    data: UpdateTaskDto,
    correlationId?: string
  ): Promise<any> {
    // Validate blocked_reason if blocked
    if (data.blocked && !data.blockedReason) {
      throw new Error('blocked_reason is required when blocked is true')
    }

    const corrId = correlationId || randomUUID()

    // Get current task for audit log
    const beforeTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    if (!beforeTask) {
      throw new Error('Task not found')
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        ...(data.projectId !== undefined && { projectId: data.projectId || null }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.descriptionRich !== undefined && { descriptionRich: data.descriptionRich }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.startDate !== undefined && { startDate: data.startDate || null }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate || null }),
        ...(data.estimateMinutes !== undefined && { estimateMinutes: data.estimateMinutes || null }),
        ...(data.blocked !== undefined && { blocked: data.blocked }),
        ...(data.blockedReason !== undefined && { blockedReason: data.blockedReason || null }),
        ...(data.parentTaskId !== undefined && { parentTaskId: data.parentTaskId || null }),
      },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
      },
    })

    // Update tags if provided
    if (data.tagIds !== undefined) {
      // Remove existing tags
      await prisma.taskTagLink.deleteMany({
        where: { taskId },
      })

      // Add new tags
      if (data.tagIds.length > 0) {
        await Promise.all(
          data.tagIds.map((tagId) =>
            prisma.taskTagLink.create({
              data: {
                taskId,
                tagId,
              },
            })
          )
        )
      }
    }

    // Write audit log
    await prisma.taskAuditLog.create({
      data: {
        entityType: 'TASK',
        entityId: taskId,
        action: 'UPDATE',
        beforeJson: JSON.stringify(beforeTask),
        afterJson: JSON.stringify(updatedTask),
        correlationId: corrId,
      },
    })

    // Write activity feed for status changes
    if (data.status && data.status !== beforeTask.status) {
      await prisma.activityFeed.create({
        data: {
          taskId,
          eventType: 'status_changed',
          payloadJson: JSON.stringify({
            taskId,
            fromStatus: beforeTask.status,
            toStatus: data.status,
          }),
          correlationId: corrId,
        },
      })

      // Trigger automation
      const { default: automationService } = await import('./automation.service')
      const updatedTask = await this.getTask(taskId)
      await automationService.triggerAutomation('status_changed', updatedTask, {
        fromStatus: beforeTask.status,
        toStatus: data.status,
      }, corrId).catch((err) => {
        console.error('Automation trigger error:', err)
      })
    }

    return this.getTask(taskId)
  }

  async getTask(taskId: string): Promise<any> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        tags: {
          include: {
            tag: true,
          },
        },
        checklists: {
          include: {
            items: true,
          },
          orderBy: {
            sortOrder: 'asc',
          },
        },
        comments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        attachments: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        links: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        relationsFrom: {
          include: {
            toTask: {
              select: {
                id: true,
                title: true,
                status: true,
                dueDate: true,
              },
            },
          },
        },
        relationsTo: {
          include: {
            fromTask: {
              select: {
                id: true,
                title: true,
                status: true,
                dueDate: true,
              },
            },
          },
        },
        children: {
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!task) {
      throw new Error('Task not found')
    }

    return task
  }

  /**
   * List tasks with advanced filtering, sorting, and pagination
   * Supports server-side pagination for performance with large datasets (10k+ tasks)
   */
  async listTasks(filters: ListTasksFilters): Promise<{ tasks: any[]; total: number }> {
    const {
      projectId,
      assignedToUserId,
      search,
      status,
      priority,
      dueFrom,
      dueTo,
      createdFrom,
      createdTo,
      tag,
      blocked,
      hasAttachments,
      hasComments,
      overdue,
      hasDependencies,
      sort = 'updatedAt:desc',
      page = 1,
      pageSize = 50,
    } = filters

    const where: any = {}

    if (projectId) {
      where.projectId = projectId
    }

    if (assignedToUserId) {
      where.assignedToUserId = assignedToUserId
    }

    if (status) {
      where.status = status
    }

    if (priority) {
      where.priority = priority
    }

    if (blocked !== undefined) {
      where.blocked = blocked
    }

    if (dueFrom || dueTo) {
      where.dueDate = {}
      if (dueFrom) {
        where.dueDate.gte = new Date(dueFrom)
      }
      if (dueTo) {
        where.dueDate.lte = new Date(dueTo)
      }
    }

    if (createdFrom || createdTo) {
      where.createdAt = {}
      if (createdFrom) {
        where.createdAt.gte = new Date(createdFrom)
      }
      if (createdTo) {
        where.createdAt.lte = new Date(createdTo)
      }
    }

    if (overdue) {
      where.dueDate = {
        ...where.dueDate,
        lt: new Date(),
      }
      where.status = {
        not: 'DONE',
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { descriptionRich: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (tag) {
      where.tags = {
        some: {
          tag: {
            name: {
              contains: tag,
              mode: 'insensitive',
            },
          },
        },
      }
    }

    if (hasAttachments) {
      where.attachments = {
        some: {},
      }
    }

    if (hasComments) {
      where.comments = {
        some: {},
      }
    }

    if (hasDependencies) {
      where.OR = [
        { relationsFrom: { some: {} } },
        { relationsTo: { some: {} } },
      ]
    }

    // Parse sort
    const [sortField, sortOrder] = sort.split(':')
    const orderBy: any = {}
    if (sortField === 'dueDate') {
      orderBy.dueDate = sortOrder === 'asc' ? 'asc' : 'desc'
    } else if (sortField === 'priority') {
      const priorityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 }
      // For priority, we'll need to handle this differently
      orderBy.priority = sortOrder === 'asc' ? 'asc' : 'desc'
    } else {
      orderBy.updatedAt = sortOrder === 'asc' ? 'asc' : 'desc'
    }

    const skip = (page - 1) * pageSize

    // Use Promise.all for parallel execution to optimize performance
    // Indexes on projectId, status, priority, dueDate ensure fast queries
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
          _count: {
            select: {
              attachments: true,
              comments: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ])

    return { tasks, total }
  }

  async deleteTask(taskId: string, correlationId?: string): Promise<void> {
    const corrId = correlationId || randomUUID()

    // Get task for audit log
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      throw new Error('Task not found')
    }

    // Soft delete - we'll add a deletedAt field later, for now just delete
    // In production, you might want to set a deleted flag instead
    await prisma.task.delete({
      where: { id: taskId },
    })

    // Write audit log
    await prisma.taskAuditLog.create({
      data: {
        entityType: 'TASK',
        entityId: taskId,
        action: 'DELETE',
        beforeJson: JSON.stringify(task),
        correlationId: corrId,
      },
    })

    // Write activity feed
    await prisma.activityFeed.create({
      data: {
        taskId,
        eventType: 'task_deleted',
        payloadJson: JSON.stringify({ taskId, title: task.title }),
        correlationId: corrId,
      },
    })
  }

  async duplicateTask(
    taskId: string,
    options: { includeSubtasks?: boolean; includeAttachments?: boolean },
    correlationId?: string
  ): Promise<any> {
    const corrId = correlationId || randomUUID()

    const originalTask = await this.getTask(taskId)

    const newTask = await this.createTask(
      {
        projectId: originalTask.projectId,
        title: `${originalTask.title} (Copy)`,
        descriptionRich: originalTask.descriptionRich,
        status: 'BACKLOG',
        priority: originalTask.priority,
        startDate: originalTask.startDate,
        dueDate: originalTask.dueDate,
        estimateMinutes: originalTask.estimateMinutes,
        blocked: false,
        tagIds: originalTask.tags.map((t: any) => t.tagId),
      },
      corrId
    )

    // Copy subtasks if requested
    if (options.includeSubtasks && originalTask.children) {
      for (const child of originalTask.children) {
        await this.createTask(
          {
            projectId: originalTask.projectId,
            title: child.title,
            status: child.status,
            priority: child.priority,
            dueDate: child.dueDate,
            parentTaskId: newTask.id,
          },
          corrId
        )
      }
    }

    // Copy attachments if requested (this would require file copying in production)
    if (options.includeAttachments && originalTask.attachments) {
      // For MVP, we'll just create references - in production, copy files
      for (const attachment of originalTask.attachments) {
        await prisma.taskAttachment.create({
          data: {
            taskId: newTask.id,
            fileName: attachment.fileName,
            storageKey: attachment.storageKey,
            fileUrl: attachment.fileUrl,
            sizeBytes: attachment.sizeBytes,
            mimeType: attachment.mimeType,
          },
        })
      }
    }

    return this.getTask(newTask.id)
  }
}

export default new TaskService()
