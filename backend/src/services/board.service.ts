import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Access Control Placeholder (future):
// RBAC/permissions will be implemented later.

export class BoardService {
  async getColumns(projectId?: string): Promise<any[]> {
    const defaultStatuses = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']

    // Get existing columns or create defaults
    let columns = await prisma.boardColumn.findMany({
      where: {
        projectId: projectId || null,
      },
      orderBy: {
        sortOrder: 'asc',
      },
    })

    // If no columns exist, create defaults
    if (columns.length === 0) {
      columns = await Promise.all(
        defaultStatuses.map((status, index) =>
          prisma.boardColumn.create({
            data: {
              projectId: projectId || null,
              statusValue: status,
              name: this.getStatusDisplayName(status),
              sortOrder: index,
            },
          })
        )
      )
    }

    // Get task counts per status
    const taskCounts = await prisma.task.groupBy({
      by: ['status'],
      where: {
        projectId: projectId || null,
      },
      _count: {
        id: true,
      },
    })

    const countMap = new Map(taskCounts.map((tc) => [tc.status, tc._count.id]))

    // Combine columns with counts
    return columns.map((col) => ({
      ...col,
      taskCount: countMap.get(col.statusValue) || 0,
    }))
  }

  async updateColumn(
    columnId: string,
    updates: { wipLimit?: number; sortOrder?: number; name?: string }
  ): Promise<any> {
    return prisma.boardColumn.update({
      where: { id: columnId },
      data: updates,
    })
  }

  async moveTask(
    taskId: string,
    targetStatus: string,
    targetSortOrder?: number,
    correlationId?: string
  ): Promise<any> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    })

    if (!task) {
      throw new Error('Task not found')
    }

    // Get column WIP limit
    const column = await prisma.boardColumn.findFirst({
      where: {
        statusValue: targetStatus,
        projectId: task.projectId || null,
      },
    })

    // Check WIP limit
    if (column?.wipLimit) {
      const currentCount = await prisma.task.count({
        where: {
          status: targetStatus,
          projectId: task.projectId || null,
        },
      })

      if (currentCount >= column.wipLimit) {
        throw new Error(`WIP limit of ${column.wipLimit} reached for ${column.name}`)
      }
    }

    // Update task status and sort order
    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        status: targetStatus,
        sortOrder: targetSortOrder ?? task.sortOrder,
      },
    })

    // Write audit log
    const { randomUUID } = require('crypto')
    const corrId = correlationId || randomUUID()
    await prisma.taskAuditLog.create({
      data: {
        entityType: 'TASK',
        entityId: taskId,
        action: 'STATUS_CHANGE',
        beforeJson: JSON.stringify({ status: task.status, sortOrder: task.sortOrder }),
        afterJson: JSON.stringify({ status: targetStatus, sortOrder: targetSortOrder ?? task.sortOrder }),
        correlationId: corrId,
      },
    })

    // Write activity feed
    await prisma.activityFeed.create({
      data: {
        taskId,
        eventType: 'status_changed',
        payloadJson: JSON.stringify({
          taskId,
          fromStatus: task.status,
          toStatus: targetStatus,
        }),
        correlationId: corrId,
      },
    })

    return updatedTask
  }

  private getStatusDisplayName(status: string): string {
    const names: Record<string, string> = {
      BACKLOG: 'Backlog',
      TODO: 'Todo',
      IN_PROGRESS: 'In Progress',
      IN_REVIEW: 'In Review',
      DONE: 'Done',
    }
    return names[status] || status
  }
}

export default new BoardService()
