import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import taskAnalyticsService from '../services/taskAnalytics.service'

export const getTaskStatistics = async (req: AuthRequest, res: Response) => {
  try {
    const {
      project_id,
      start_date,
      end_date,
      user_id,
    } = req.query

    const filters = {
      projectId: project_id as string | undefined,
      startDate: start_date ? new Date(start_date as string) : undefined,
      endDate: end_date ? new Date(end_date as string) : undefined,
      userId: user_id as string | undefined,
    }

    const statistics = await taskAnalyticsService.getTaskStatistics(filters)

    res.json({
      success: true,
      data: statistics,
    })
  } catch (error: any) {
    console.error('Get task statistics error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getCompletionTrends = async (req: AuthRequest, res: Response) => {
  try {
    const {
      project_id,
      start_date,
      end_date,
    } = req.query

    const dateRange = start_date && end_date
      ? {
          start: new Date(start_date as string),
          end: new Date(end_date as string),
        }
      : undefined

    const trends = await taskAnalyticsService.getCompletionTrends(
      project_id as string | undefined,
      dateRange
    )

    res.json({
      success: true,
      data: trends,
    })
  } catch (error: any) {
    console.error('Get completion trends error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getTeamPerformance = async (req: AuthRequest, res: Response) => {
  try {
    const {
      project_id,
      start_date,
      end_date,
    } = req.query

    const dateRange = start_date && end_date
      ? {
          start: new Date(start_date as string),
          end: new Date(end_date as string),
        }
      : undefined

    const performance = await taskAnalyticsService.getTeamPerformance(
      project_id as string | undefined,
      dateRange
    )

    res.json({
      success: true,
      data: performance,
    })
  } catch (error: any) {
    console.error('Get team performance error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getWorkloadAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const { project_id } = req.query

    const workload = await taskAnalyticsService.getWorkloadAnalysis(
      project_id as string | undefined
    )

    res.json({
      success: true,
      data: workload,
    })
  } catch (error: any) {
    console.error('Get workload analysis error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
