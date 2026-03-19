import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import taskService from '../services/task.service'
import { prisma } from '../lib/prisma'

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || undefined

    const task = await taskService.createTask(req.body, correlationId)

    res.status(201).json({
      success: true,
      data: task,
    })
  } catch (error: any) {
    console.error('Create task error:', error)

    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

export const getTasks = async (req: AuthRequest, res: Response) => {
  try {
    const {
      project_id,
      assigned_to,
      search,
      status,
      priority,
      due_from,
      due_to,
      created_from,
      created_to,
      tag,
      blocked,
      has_attachments,
      has_comments,
      overdue,
      has_dependencies,
      sort,
      group_by,
      page,
      page_size,
    } = req.query

    const filters = {
      projectId: project_id as string | undefined,
      assignedToUserId: assigned_to as string | undefined,
      search: search as string | undefined,
      status: status as string | undefined,
      priority: priority as string | undefined,
      dueFrom: due_from ? new Date(due_from as string) : undefined,
      dueTo: due_to ? new Date(due_to as string) : undefined,
      createdFrom: created_from ? new Date(created_from as string) : undefined,
      createdTo: created_to ? new Date(created_to as string) : undefined,
      tag: tag as string | undefined,
      blocked: blocked === 'true' ? true : blocked === 'false' ? false : undefined,
      hasAttachments: has_attachments === 'true' ? true : undefined,
      hasComments: has_comments === 'true' ? true : undefined,
      overdue: overdue === 'true' ? true : undefined,
      hasDependencies: has_dependencies === 'true' ? true : undefined,
      sort: (sort as string) || 'updatedAt:desc',
      groupBy: group_by as string | undefined,
      page: page ? parseInt(page as string, 10) : 1,
      pageSize: page_size ? parseInt(page_size as string, 10) : 50,
    }

    const { tasks, total } = await taskService.listTasks(filters)

    const totalPages = Math.ceil(total / filters.pageSize)

    res.json({
      success: true,
      data: {
        items: tasks,
        total,
        page: filters.page,
        pageSize: filters.pageSize,
        totalPages,
      },
    })
  } catch (error: any) {
    console.error('Get tasks error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const task = await taskService.getTask(id)

    res.json({
      success: true,
      data: task,
    })
  } catch (error: any) {
    console.error('Get task error:', error)

    if (error?.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || undefined

    const task = await taskService.updateTask(id, req.body, correlationId)

    res.json({
      success: true,
      data: task,
    })
  } catch (error: any) {
    console.error('Update task error:', error)

    if (error?.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    if (error?.message?.includes('blocked_reason')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || undefined

    await taskService.deleteTask(id, correlationId)

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Delete task error:', error)

    if (error?.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const duplicateTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { include_subtasks, include_attachments } = req.body
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || undefined

    const task = await taskService.duplicateTask(
      id,
      {
        includeSubtasks: include_subtasks || false,
        includeAttachments: include_attachments || false,
      },
      correlationId
    )

    res.status(201).json({
      success: true,
      data: task,
    })
  } catch (error: any) {
    console.error('Duplicate task error:', error)

    if (error?.message === 'Task not found') {
      return res.status(404).json({
        success: false,
        error: 'Task not found',
      })
    }

    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const bulkUpdateTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { task_ids, updates } = req.body

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'task_ids array is required',
      })
    }

    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || undefined

    const updatedTasks = await Promise.all(
      task_ids.map((taskId: string) => taskService.updateTask(taskId, updates, correlationId))
    )

    res.json({
      success: true,
      data: updatedTasks,
    })
  } catch (error: any) {
    console.error('Bulk update tasks error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getActivity = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const activities = await prisma.activityFeed.findMany({
      where: { taskId: id },
      orderBy: {
        occurredAt: 'desc',
      },
      take: 100,
    })

    res.json({
      success: true,
      data: activities,
    })
  } catch (error: any) {
    console.error('Get activity error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getCalendarTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { project_id, start_date, end_date } = req.query

    const startDate = start_date ? new Date(start_date as string) : undefined
    const endDate = end_date ? new Date(end_date as string) : undefined

    // Build where clause
    const where: any = {}
    
    if (project_id) {
      where.projectId = project_id as string
    }

    // Filter by date range (use dueDate or startDate)
    if (startDate || endDate) {
      where.OR = [
        ...(startDate || endDate
          ? [
              {
                dueDate: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              },
              {
                startDate: {
                  ...(startDate ? { gte: startDate } : {}),
                  ...(endDate ? { lte: endDate } : {}),
                },
              },
            ]
          : []),
      ]
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        dueDate: true,
        startDate: true,
        priority: true,
        blocked: true,
        status: true,
      },
      orderBy: {
        dueDate: 'asc',
      },
    })

    // Transform tasks to calendar event format
    const events = tasks.map((task) => ({
      id: task.id,
      title: task.title,
      start: task.dueDate || task.startDate || new Date(),
      priority: task.priority || 'MEDIUM',
      blocked: task.blocked || false,
      status: task.status,
    }))

    res.json({
      success: true,
      data: events,
    })
  } catch (error: any) {
    console.error('Get calendar tasks error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
