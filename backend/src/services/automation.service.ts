import { prisma } from '../lib/prisma'
import { randomUUID } from 'crypto'


// Access Control Placeholder (future):
// RBAC/permissions will be implemented later.

export class AutomationService {
  // SEC-2 (#375): getRules now requires a projectId so the unfiltered
  // findMany cannot leak rules across tenants.
  async getRules(projectId: string): Promise<any[]> {
    return prisma.automationRule.findMany({
      where: {
        isActive: true,
        projectId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })
  }

  async createRule(data: {
    name: string
    triggerType: string
    conditionsJson: string
    actionsJson: string
    projectId: string
  }): Promise<any> {
    return prisma.automationRule.create({
      data: {
        name: data.name,
        triggerType: data.triggerType,
        conditionsJson: data.conditionsJson,
        actionsJson: data.actionsJson,
        projectId: data.projectId,
      },
    })
  }

  async evaluateRule(ruleId: string, task: any, triggerContext: any): Promise<{ shouldExecute: boolean; actions: any[] }> {
    const rule = await prisma.automationRule.findUnique({
      where: { id: ruleId },
    })

    if (!rule || !rule.isActive) {
      return { shouldExecute: false, actions: [] }
    }

    // Parse conditions
    const conditions = JSON.parse(rule.conditionsJson)

    // Evaluate conditions
    const shouldExecute = this.evaluateConditions(conditions, task, triggerContext)

    if (!shouldExecute) {
      return { shouldExecute: false, actions: [] }
    }

    // Parse actions
    const actions = JSON.parse(rule.actionsJson)

    return { shouldExecute: true, actions }
  }

  async executeActions(
    ruleId: string,
    taskId: string,
    actions: any[],
    correlationId?: string
  ): Promise<any> {
    const corrId = correlationId || randomUUID()
    const results: any[] = []

    for (const action of actions) {
      try {
        let result: any = null

        switch (action.type) {
          case 'set_status':
            result = await prisma.task.update({
              where: { id: taskId },
              data: { status: action.value },
            })
            break

          case 'set_priority':
            result = await prisma.task.update({
              where: { id: taskId },
              data: { priority: action.value },
            })
            break

          case 'add_tag': {
            // SEC-2 (#375): TaskTag is now project-scoped. Resolve project
            // from the task we are tagging so the (projectId, name) lookup
            // uses the correct scope.
            const taskForTag = await prisma.task.findUnique({
              where: { id: taskId },
              select: { projectId: true },
            })
            if (!taskForTag?.projectId) {
              results.push({ action, error: 'task has no projectId', success: false })
              break
            }
            // Find or create tag scoped to the task's project.
            let tag = await prisma.taskTag.findUnique({
              where: {
                projectId_name: {
                  projectId: taskForTag.projectId,
                  name: action.value,
                },
              },
            })
            if (!tag) {
              tag = await prisma.taskTag.create({
                data: {
                  name: action.value,
                  projectId: taskForTag.projectId,
                },
              })
            }
            // Link tag
            await prisma.taskTagLink.upsert({
              where: {
                taskId_tagId: {
                  taskId,
                  tagId: tag.id,
                },
              },
              create: {
                taskId,
                tagId: tag.id,
              },
              update: {},
            })
            break
          }

          case 'set_due_date_offset':
            const task = await prisma.task.findUnique({ where: { id: taskId } })
            if (task) {
              const offsetDays = parseInt(action.value, 10)
              const newDueDate = new Date()
              newDueDate.setDate(newDueDate.getDate() + offsetDays)
              result = await prisma.task.update({
                where: { id: taskId },
                data: { dueDate: newDueDate },
              })
            }
            break

          case 'post_comment':
            result = await prisma.taskComment.create({
              data: {
                taskId,
                bodyRich: action.value,
                authorName: 'System',
              },
            })
            break
        }

        results.push({ action, result, success: true })
      } catch (error: any) {
        results.push({ action, error: error.message, success: false })
      }
    }

    // Log automation run
    await prisma.automationRun.create({
      data: {
        ruleId,
        status: results.every((r) => r.success) ? 'SUCCESS' : 'FAILED',
        inputJson: JSON.stringify({ taskId }),
        outputJson: JSON.stringify(results),
        correlationId: corrId,
      },
    })

    return results
  }

  private evaluateConditions(conditions: any, task: any, triggerContext: any): boolean {
    if (!conditions || !conditions.operator) {
      return true
    }

    const { operator, conditions: subConditions } = conditions

    if (operator === 'AND') {
      return subConditions.every((cond: any) => this.evaluateCondition(cond, task, triggerContext))
    } else if (operator === 'OR') {
      return subConditions.some((cond: any) => this.evaluateCondition(cond, task, triggerContext))
    }

    return this.evaluateCondition(conditions, task, triggerContext)
  }

  private evaluateCondition(condition: any, task: any, triggerContext: any): boolean {
    const { field, operator, value } = condition

    let fieldValue: any
    switch (field) {
      case 'status':
        fieldValue = task.status
        break
      case 'priority':
        fieldValue = task.priority
        break
      case 'has_tag':
        fieldValue = task.tags?.some((t: any) => t.tag?.name === value)
        break
      case 'title_contains':
        fieldValue = task.title?.toLowerCase().includes(value?.toLowerCase())
        break
      case 'overdue':
        fieldValue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE'
        break
      default:
        return false
    }

    switch (operator) {
      case 'equals':
        return fieldValue === value
      case 'not_equals':
        return fieldValue !== value
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(value).toLowerCase())
      case 'is_true':
        return Boolean(fieldValue) === true
      case 'is_false':
        return Boolean(fieldValue) === false
      default:
        return false
    }
  }

  async triggerAutomation(
    triggerType: string,
    task: any,
    triggerContext: any,
    correlationId?: string
  ): Promise<void> {
    // SEC-2 (#375): scope rules to the task's own project so a foreign
    // project's rule cannot fire on this task. The trigger pathway is the
    // only place where projectId was not previously asserted.
    if (!task?.projectId) return
    const rules = await prisma.automationRule.findMany({
      where: {
        isActive: true,
        triggerType,
        projectId: task.projectId,
      },
    })

    for (const rule of rules) {
      const { shouldExecute, actions } = await this.evaluateRule(rule.id, task, triggerContext)
      if (shouldExecute) {
        await this.executeActions(rule.id, task.id, actions, correlationId)
      }
    }
  }
}

export default new AutomationService()
