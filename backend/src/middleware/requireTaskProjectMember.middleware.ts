import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma'
import { AuthRequest } from './auth.middleware'

/**
 * Enforces project membership for task-subsystem routes that identify a task by
 * `req.params.id` (e.g. `/tasks/:id`, `/tasks/:id/comments`, `/attachments/:id`,
 * `/relations/:id`).
 *
 * Resolves the task's projectId, then confirms the authenticated user has a
 * ProjectMember row for that project.
 *
 * Must be placed after authenticateToken.
 *
 * Responses:
 *  - 401 when no authenticated user
 *  - 404 when the task / attachment / relation does not exist
 *  - 403 when the user is not a project member (or the resource has no project)
 */
export function requireTaskProjectMember(
  resolver: 'task' | 'attachment' | 'relation' | 'column' = 'task'
) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      const { id } = req.params

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      if (!id) {
        res.status(400).json({ success: false, error: 'Resource id is required' })
        return
      }

      let projectId: string | null | undefined

      if (resolver === 'task') {
        const task = await prisma.task.findUnique({
          where: { id },
          select: { projectId: true },
        })
        if (!task) {
          res.status(404).json({ success: false, error: 'Task not found' })
          return
        }
        projectId = task.projectId
      } else if (resolver === 'attachment') {
        const attachment = await prisma.taskAttachment.findUnique({
          where: { id },
          select: { task: { select: { projectId: true } } },
        })
        if (!attachment) {
          res.status(404).json({ success: false, error: 'Attachment not found' })
          return
        }
        projectId = attachment.task?.projectId
      } else if (resolver === 'relation') {
        const relation = await prisma.taskRelation.findUnique({
          where: { id },
          select: { fromTask: { select: { projectId: true } } },
        })
        if (!relation) {
          res.status(404).json({ success: false, error: 'Relation not found' })
          return
        }
        projectId = relation.fromTask?.projectId
      } else if (resolver === 'column') {
        const column = await prisma.boardColumn.findUnique({
          where: { id },
          select: { projectId: true },
        })
        if (!column) {
          res.status(404).json({ success: false, error: 'Board column not found' })
          return
        }
        projectId = column.projectId
      }

      if (!projectId) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: resource has no project scope' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      })

      if (!member) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      next()
    } catch (err) {
      console.error('requireTaskProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/**
 * Enforces project membership using the task id in `req.body.task_id` (or
 * `req.body.taskId`). Used by `POST /board/move-task` where the task is
 * identified in the body rather than the URL.
 */
export function requireBodyTaskProjectMember(
  fields: string[] = ['task_id', 'taskId']
) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      let taskId: string | undefined
      for (const f of fields) {
        const raw = req.body?.[f]
        if (typeof raw === 'string' && raw.length > 0) {
          taskId = raw
          break
        }
      }

      if (!taskId) {
        res.status(400).json({ success: false, error: 'task_id is required' })
        return
      }

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      })
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' })
        return
      }
      if (!task.projectId) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: task has no project scope' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId: task.projectId, userId },
        select: { id: true },
      })

      if (!member) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      next()
    } catch (err) {
      console.error('requireBodyTaskProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

/**
 * Enforces project membership using `req.body.project_id` (or
 * `req.body.projectId`) — used for routes that create tasks / operate on a
 * project-scoped payload without a resource id (e.g. `POST /tasks`,
 * `GET /tasks?project_id=...`, board/calendar/analytics endpoints).
 *
 * `location` lets us read from query or body. When the project id is missing
 * the request is rejected with 400 — unscoped list/search across all projects
 * is the exact IDOR we are removing.
 */
export function requireBodyProjectMember(
  location: 'body' | 'query' = 'body',
  fields: string[] = ['project_id', 'projectId']
) {
  return async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user?.userId
      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized' })
        return
      }

      const source = location === 'body' ? req.body : req.query
      let projectId: string | undefined
      for (const f of fields) {
        const raw = source?.[f]
        if (typeof raw === 'string' && raw.length > 0) {
          projectId = raw
          break
        }
      }

      if (!projectId) {
        res
          .status(400)
          .json({ success: false, error: 'project_id is required for project-scoped task routes' })
        return
      }

      const member = await prisma.projectMember.findFirst({
        where: { projectId, userId },
        select: { id: true },
      })

      if (!member) {
        res
          .status(403)
          .json({ success: false, error: 'Access denied: not a member of this project' })
        return
      }

      next()
    } catch (err) {
      console.error('requireBodyProjectMember error:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}
