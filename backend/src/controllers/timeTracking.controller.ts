import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import timeTrackingService from '../services/timeTracking.service'

export const logTime = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!
    const { taskId, durationMinutes, description, loggedAt, billable } = req.body

    if (!taskId || !durationMinutes) {
      return res.status(400).json({
        success: false,
        error: 'taskId and durationMinutes are required',
      })
    }

    const timeLog = await timeTrackingService.logTime({
      taskId,
      userId,
      durationMinutes,
      description,
      loggedAt: loggedAt ? new Date(loggedAt) : undefined,
      billable: billable || false,
    })

    res.status(201).json({
      success: true,
      data: timeLog,
    })
  } catch (error: any) {
    console.error('Log time error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getTimeLogs = async (req: AuthRequest, res: Response) => {
  try {
    const {
      task_id,
      user_id,
      project_id,
      start_date,
      end_date,
      billable,
    } = req.query

    const filters = {
      taskId: task_id as string | undefined,
      userId: user_id as string | undefined,
      projectId: project_id as string | undefined,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      billable: billable === 'true' ? true : billable === 'false' ? false : undefined,
    }

    const logs = await timeTrackingService.getTimeLogs(filters)

    res.json({
      success: true,
      data: logs,
    })
  } catch (error: any) {
    console.error('Get time logs error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getTimeSummary = async (req: AuthRequest, res: Response) => {
  try {
    const {
      task_id,
      user_id,
      project_id,
      start_date,
      end_date,
      billable,
    } = req.query

    const filters = {
      taskId: task_id as string | undefined,
      userId: user_id as string | undefined,
      projectId: project_id as string | undefined,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      billable: billable === 'true' ? true : billable === 'false' ? false : undefined,
    }

    const summary = await timeTrackingService.getTimeSummary(filters)

    res.json({
      success: true,
      data: summary,
    })
  } catch (error: any) {
    console.error('Get time summary error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteTimeLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await timeTrackingService.deleteTimeLog(id)

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Delete time log error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const updateTimeLog = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { durationMinutes, description, loggedAt, billable } = req.body

    const timeLog = await timeTrackingService.updateTimeLog(id, {
      durationMinutes,
      description,
      loggedAt: loggedAt ? new Date(loggedAt) : undefined,
      billable,
    })

    res.json({
      success: true,
      data: timeLog,
    })
  } catch (error: any) {
    console.error('Update time log error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
