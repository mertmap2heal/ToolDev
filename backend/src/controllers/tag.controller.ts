import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'

// SEC-2 (#375): tags are project-scoped. project_id is asserted by the
// route-level `requireBodyProjectMember` middleware; the controller scopes
// every query by it.

export const getTags = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = (req.query.project_id ?? req.query.projectId) as string
    const tags = await prisma.taskTag.findMany({
      where: { projectId },
      orderBy: {
        name: 'asc',
      },
    })

    res.json({
      success: true,
      data: tags,
    })
  } catch (error: any) {
    console.error('Get tags error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createTag = async (req: AuthRequest, res: Response) => {
  try {
    const { name, color } = req.body
    const projectId = (req.body.project_id ?? req.body.projectId) as string

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tag name is required',
      })
    }

    const tag = await prisma.taskTag.create({
      data: {
        name: name.trim(),
        color: color || null,
        projectId,
      },
    })

    res.status(201).json({
      success: true,
      data: tag,
    })
  } catch (error: any) {
    console.error('Create tag error:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Tag with this name already exists',
      })
    }
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const linkTagToTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id, tagId } = req.params

    // SEC-2 (#375): verify the tag belongs to the same project as the task
    // before linking, so a foreign tenant's tag cannot be attached to this
    // tenant's task.
    const [task, tag] = await Promise.all([
      prisma.task.findUnique({
        where: { id },
        select: { projectId: true },
      }),
      prisma.taskTag.findUnique({
        where: { id: tagId },
        select: { projectId: true },
      }),
    ])
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' })
    }
    if (!tag) {
      return res.status(404).json({ success: false, error: 'Tag not found' })
    }
    if (tag.projectId && tag.projectId !== task.projectId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: tag belongs to a different project',
      })
    }

    await prisma.taskTagLink.create({
      data: {
        taskId: id,
        tagId,
      },
    })

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Link tag to task error:', error)
    if (error.code === 'P2002') {
      return res.status(400).json({
        success: false,
        error: 'Tag is already linked to this task',
      })
    }
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const unlinkTagFromTask = async (req: AuthRequest, res: Response) => {
  try {
    const { id, tagId } = req.params

    await prisma.taskTagLink.delete({
      where: {
        taskId_tagId: {
          taskId: id,
          tagId,
        },
      },
    })

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Unlink tag from task error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
