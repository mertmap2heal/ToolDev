import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'

const prisma = new PrismaClient()

// Access Control Placeholder (future):
// RBAC/permissions will be implemented later.

export class DependencyService {
  async getRelations(taskId: string): Promise<any> {
    const [relationsFrom, relationsTo] = await Promise.all([
      prisma.taskRelation.findMany({
        where: { fromTaskId: taskId },
        include: {
          toTask: {
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
              blocked: true,
            },
          },
        },
      }),
      prisma.taskRelation.findMany({
        where: { toTaskId: taskId },
        include: {
          fromTask: {
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
              blocked: true,
            },
          },
        },
      }),
    ])

    return {
      from: relationsFrom,
      to: relationsTo,
    }
  }

  async createRelation(
    fromTaskId: string,
    toTaskId: string,
    relationType: string,
    correlationId?: string
  ): Promise<any> {
    if (fromTaskId === toTaskId) {
      throw new Error('A task cannot be related to itself')
    }

    // Check for cycles if relation type is BLOCKS
    if (relationType === 'BLOCKS' || relationType === 'BLOCKED_BY') {
      const wouldCreateCycle = await this.wouldCreateCycle(fromTaskId, toTaskId, relationType)
      if (wouldCreateCycle) {
        throw new Error('Creating this relation would create a circular dependency')
      }
    }

    const corrId = correlationId || randomUUID()

    // Handle BLOCKED_BY by reversing the relation
    const actualFromTaskId = relationType === 'BLOCKED_BY' ? toTaskId : fromTaskId
    const actualToTaskId = relationType === 'BLOCKED_BY' ? fromTaskId : toTaskId
    const actualRelationType = relationType === 'BLOCKED_BY' ? 'BLOCKS' : relationType

    const relation = await prisma.taskRelation.create({
      data: {
        fromTaskId: actualFromTaskId,
        toTaskId: actualToTaskId,
        relationType: actualRelationType,
      },
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
    })

    // Write activity feed
    await prisma.activityFeed.create({
      data: {
        taskId: fromTaskId,
        eventType: 'relation_added',
        payloadJson: JSON.stringify({
          relationId: relation.id,
          relationType: actualRelationType,
          targetTaskId: actualToTaskId,
        }),
        correlationId: corrId,
      },
    })

    return relation
  }

  async deleteRelation(relationId: string): Promise<void> {
    await prisma.taskRelation.delete({
      where: { id: relationId },
    })
  }

  async getDependencyWarnings(taskId: string): Promise<any[]> {
    const relations = await prisma.taskRelation.findMany({
      where: {
        fromTaskId: taskId,
        relationType: 'BLOCKS',
      },
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
    })

    const warnings: any[] = []
    const now = new Date()

    for (const relation of relations) {
      const blockingTask = relation.toTask
      if (blockingTask) {
        // Check if blocking task is overdue
        if (blockingTask.dueDate && new Date(blockingTask.dueDate) < now && blockingTask.status !== 'DONE') {
          warnings.push({
            type: 'overdue_blocker',
            message: `Blocking task "${blockingTask.title}" is overdue`,
            taskId: blockingTask.id,
            taskTitle: blockingTask.title,
            dueDate: blockingTask.dueDate,
          })
        }

        // Check if blocking task is blocked
        if (blockingTask.status === 'BLOCKED' || blockingTask.status === 'BACKLOG') {
          warnings.push({
            type: 'blocked_blocker',
            message: `Blocking task "${blockingTask.title}" is not in progress`,
            taskId: blockingTask.id,
            taskTitle: blockingTask.title,
            status: blockingTask.status,
          })
        }
      }
    }

    return warnings
  }

  /**
   * Cycle detection using DFS (Depth-First Search)
   * Prevents circular dependencies for BLOCKS relations
   */
  private async wouldCreateCycle(fromTaskId: string, toTaskId: string, relationType: string): Promise<boolean> {
    // DFS to check if adding this relation would create a cycle
    const visited = new Set<string>()
    const stack: string[] = [toTaskId]

    while (stack.length > 0) {
      const currentTaskId = stack.pop()!
      if (visited.has(currentTaskId)) continue
      visited.add(currentTaskId)

      // If we can reach fromTaskId from toTaskId, we have a cycle
      if (currentTaskId === fromTaskId) {
        return true
      }

      // Get all tasks that this task blocks
      const blockingRelations = await prisma.taskRelation.findMany({
        where: {
          fromTaskId: currentTaskId,
          relationType: 'BLOCKS',
        },
        select: {
          toTaskId: true,
        },
      })

      for (const rel of blockingRelations) {
        stack.push(rel.toTaskId)
      }
    }

    return false
  }
}

export default new DependencyService()
