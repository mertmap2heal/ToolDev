import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export interface CreateTimeLogDto {
  taskId: string
  userId: string
  durationMinutes: number
  description?: string
  loggedAt?: Date
  billable?: boolean
}

export interface TimeLogFilters {
  taskId?: string
  userId?: string
  projectId?: string
  startDate?: Date
  endDate?: Date
  billable?: boolean
}

export class TimeTrackingService {
  async logTime(data: CreateTimeLogDto) {
    return prisma.timeLog.create({
      data: {
        taskId: data.taskId,
        userId: data.userId,
        durationMinutes: data.durationMinutes,
        description: data.description,
        loggedAt: data.loggedAt || new Date(),
        billable: data.billable || false,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
          },
        },
      },
    })
  }

  async getTimeLogs(filters: TimeLogFilters) {
    const where: any = {}

    if (filters.taskId) {
      where.taskId = filters.taskId
    }

    if (filters.userId) {
      where.userId = filters.userId
    }

    if (filters.projectId) {
      where.task = {
        projectId: filters.projectId,
      }
    }

    if (filters.startDate || filters.endDate) {
      where.loggedAt = {}
      if (filters.startDate) {
        where.loggedAt.gte = filters.startDate
      }
      if (filters.endDate) {
        where.loggedAt.lte = filters.endDate
      }
    }

    if (filters.billable !== undefined) {
      where.billable = filters.billable
    }

    return prisma.timeLog.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            projectId: true,
          },
        },
      },
      orderBy: {
        loggedAt: 'desc',
      },
    })
  }

  async getTimeSummary(filters: TimeLogFilters) {
    const logs = await this.getTimeLogs(filters)

    const totalMinutes = logs.reduce((sum, log) => sum + log.durationMinutes, 0)
    const billableMinutes = logs
      .filter((log) => log.billable)
      .reduce((sum, log) => sum + log.durationMinutes, 0)

    return {
      totalMinutes,
      billableMinutes,
      nonBillableMinutes: totalMinutes - billableMinutes,
      totalHours: totalMinutes / 60,
      billableHours: billableMinutes / 60,
      logCount: logs.length,
    }
  }

  async deleteTimeLog(id: string) {
    return prisma.timeLog.delete({
      where: { id },
    })
  }

  async updateTimeLog(id: string, data: Partial<CreateTimeLogDto>) {
    return prisma.timeLog.update({
      where: { id },
      data: {
        durationMinutes: data.durationMinutes,
        description: data.description,
        loggedAt: data.loggedAt,
        billable: data.billable,
      },
    })
  }
}

export default new TimeTrackingService()
