import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import automationService from '../services/automation.service'
import taskService from '../services/task.service'
import { prisma } from '../lib/prisma'

// SEC-2 (#375): project_id is asserted by the route-level middleware
// (`requireBodyProjectMember` / `requireRuleProjectMember`), so the
// controller can trust the value here and use it to scope every query.

export const getRules = async (req: AuthRequest, res: Response) => {
  try {
    const projectId = (req.query.project_id ?? req.query.projectId) as string
    const rules = await automationService.getRules(projectId)

    res.json({
      success: true,
      data: rules,
    })
  } catch (error: any) {
    console.error('Get automation rules error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createRule = async (req: AuthRequest, res: Response) => {
  try {
    const { name, trigger_type, conditions_json, actions_json, project_id, projectId: projectIdAlt } = req.body
    const projectId: string = project_id ?? projectIdAlt

    if (!name || !trigger_type || !conditions_json || !actions_json) {
      return res.status(400).json({
        success: false,
        error: 'name, trigger_type, conditions_json, and actions_json are required',
      })
    }

    const rule = await automationService.createRule({
      name,
      triggerType: trigger_type,
      conditionsJson: conditions_json,
      actionsJson: actions_json,
      projectId,
    })

    res.status(201).json({
      success: true,
      data: rule,
    })
  } catch (error: any) {
    console.error('Create automation rule error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const testRule = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { task_id } = req.body

    if (!task_id) {
      return res.status(400).json({
        success: false,
        error: 'task_id is required',
      })
    }

    // SEC-2 (#375): rule access was already gated by the route-level
    // `requireRuleProjectMember` middleware. Now ensure the task we are
    // running the rule against also belongs to the same project so a
    // crafted task_id from another tenant cannot be evaluated by this
    // rule.
    const rule = await prisma.automationRule.findUnique({
      where: { id },
      select: { projectId: true },
    })
    if (!rule) {
      return res.status(404).json({ success: false, error: 'Automation rule not found' })
    }
    const task = await taskService.getTask(task_id)
    if (!task) {
      return res.status(404).json({ success: false, error: 'Task not found' })
    }
    if (rule.projectId && task.projectId && rule.projectId !== task.projectId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied: rule and task belong to different projects',
      })
    }
    const { shouldExecute, actions } = await automationService.evaluateRule(id, task, {})

    res.json({
      success: true,
      data: {
        shouldExecute,
        actions: shouldExecute ? actions : [],
      },
    })
  } catch (error: any) {
    console.error('Test automation rule error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getRuns = async (req: AuthRequest, res: Response) => {
  try {
    const { rule_id, limit } = req.query
    const projectId = (req.query.project_id ?? req.query.projectId) as string

    // SEC-2 (#375): runs must filter by the project AND, if rule_id is
    // supplied, verify the rule belongs to the same project. Membership
    // is already enforced by `requireBodyProjectMember('query')`.
    if (rule_id) {
      const rule = await prisma.automationRule.findUnique({
        where: { id: rule_id as string },
        select: { projectId: true },
      })
      if (!rule) {
        return res.status(404).json({ success: false, error: 'Automation rule not found' })
      }
      if (rule.projectId !== projectId) {
        return res.status(403).json({
          success: false,
          error: 'Access denied: rule belongs to a different project',
        })
      }
    }

    const runs = await prisma.automationRun.findMany({
      where: rule_id
        ? { ruleId: rule_id as string }
        : { rule: { projectId } },
      orderBy: {
        triggeredAt: 'desc',
      },
      take: limit ? parseInt(limit as string, 10) : 50,
    })

    res.json({
      success: true,
      data: runs,
    })
  } catch (error: any) {
    console.error('Get automation runs error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
