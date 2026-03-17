import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import boardService from '../services/board.service'

export const getColumns = async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query
    const columns = await boardService.getColumns(project_id as string | undefined)

    res.json({
      success: true,
      data: columns,
    })
  } catch (error: any) {
    console.error('Get board columns error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const updateColumn = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { wip_limit, sort_order, name } = req.body

    const column = await boardService.updateColumn(id, {
      wipLimit: wip_limit,
      sortOrder: sort_order,
      name,
    })

    res.json({
      success: true,
      data: column,
    })
  } catch (error: any) {
    console.error('Update board column error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const moveTask = async (req: AuthRequest, res: Response) => {
  try {
    const { task_id, target_status, target_sort_order } = req.body
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || undefined

    if (!task_id || !target_status) {
      return res.status(400).json({
        success: false,
        error: 'task_id and target_status are required',
      })
    }

    const task = await boardService.moveTask(task_id, target_status, target_sort_order, correlationId)

    res.json({
      success: true,
      data: task,
    })
  } catch (error: any) {
    console.error('Move task error:', error)

    if (error?.message?.includes('WIP limit')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

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
