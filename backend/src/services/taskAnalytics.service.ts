import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface AnalyticsFilters {
  projectId?: string
  startDate?: Date
  endDate?: Date
  userId?: string
}

export class TaskAnalyticsService {
  async getTaskStatistics(filters: AnalyticsFilters) {
    const where: any = {}

    if (filters.projectId) {
      where.projectId = filters.projectId
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {}
      if (filters.startDate) {
        where.createdAt.gte = filters.startDate
      }
      if (filters.endDate) {
        where.createdAt.lte = filters.endDate
      }
    }

    if (filters.userId) {
      where.assignedToUserId = filters.userId
    }

    const tasks = await prisma.task.findMany({
      where,
    })

    const total = tasks.length
    const byStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byPriority = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const completed = tasks.filter((t) => t.status === 'DONE').length
    const inProgress = tasks.filter((t) => t.status === 'IN_PROGRESS').length
    const overdue = tasks.filter((t) => {
      if (!t.dueDate) return false
      return new Date(t.dueDate) < new Date() && t.status !== 'DONE'
    }).length

    return {
      total,
      completed,
      inProgress,
      overdue,
      byStatus,
      byPriority,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
    }
  }

  async getCompletionTrends(projectId?: string, dateRange?: { start: Date; end: Date }) {
    const where: any = {}

    if (projectId) {
      where.projectId = projectId
    }

    if (dateRange) {
      where.createdAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    // Group by date
    const trends: Record<string, { created: number; completed: number }> = {}

    tasks.forEach((task) => {
      const createdDate = new Date(task.createdAt).toISOString().split('T')[0]
      if (!trends[createdDate]) {
        trends[createdDate] = { created: 0, completed: 0 }
      }
      trends[createdDate].created++

      if (task.status === 'DONE') {
        const completedDate = new Date(task.updatedAt).toISOString().split('T')[0]
        if (!trends[completedDate]) {
          trends[completedDate] = { created: 0, completed: 0 }
        }
        trends[completedDate].completed++
      }
    })

    return Object.entries(trends)
      .map(([date, data]) => ({
        date,
        ...data,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  async getTeamPerformance(projectId?: string, dateRange?: { start: Date; end: Date }) {
    const where: any = {}

    if (projectId) {
      where.projectId = projectId
    }

    if (dateRange) {
      where.updatedAt = {
        gte: dateRange.start,
        lte: dateRange.end,
      }
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        assignedToUserId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    const userStats: Record<
      string,
      {
        userId: string
        total: number
        completed: number
        inProgress: number
        completionRate: number
      }
    > = {}

    tasks.forEach((task) => {
      const userId = task.assignedToUserId || 'unassigned'
      if (!userStats[userId]) {
        userStats[userId] = {
          userId,
          total: 0,
          completed: 0,
          inProgress: 0,
          completionRate: 0,
        }
      }

      userStats[userId].total++
      if (task.status === 'DONE') {
        userStats[userId].completed++
      }
      if (task.status === 'IN_PROGRESS') {
        userStats[userId].inProgress++
      }
    })

    // Calculate completion rates
    Object.values(userStats).forEach((stat) => {
      stat.completionRate = stat.total > 0 ? (stat.completed / stat.total) * 100 : 0
    })

    return Object.values(userStats)
  }

  async getWorkloadAnalysis(projectId?: string) {
    const where: any = {}

    if (projectId) {
      where.projectId = projectId
    }

    const tasks = await prisma.task.findMany({
      where,
      select: {
        id: true,
        assignedToUserId: true,
        estimateMinutes: true,
        status: true,
      },
    })

    const workload: Record<
      string,
      {
        userId: string
        totalTasks: number
        totalEstimatedMinutes: number
        completedTasks: number
        inProgressTasks: number
      }
    > = {}

    tasks.forEach((task) => {
      const userId = task.assignedToUserId || 'unassigned'
      if (!workload[userId]) {
        workload[userId] = {
          userId,
          totalTasks: 0,
          totalEstimatedMinutes: 0,
          completedTasks: 0,
          inProgressTasks: 0,
        }
      }

      workload[userId].totalTasks++
      if (task.estimateMinutes) {
        workload[userId].totalEstimatedMinutes += task.estimateMinutes
      }
      if (task.status === 'DONE') {
        workload[userId].completedTasks++
      }
      if (task.status === 'IN_PROGRESS') {
        workload[userId].inProgressTasks++
      }
    })

    return Object.values(workload).map((w) => ({
      ...w,
      totalEstimatedHours: w.totalEstimatedMinutes / 60,
    }))
  }
}

export default new TaskAnalyticsService()
