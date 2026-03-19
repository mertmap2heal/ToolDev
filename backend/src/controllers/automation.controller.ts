import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import automationService from '../services/automation.service'
import taskService from '../services/task.service'
import { prisma } from '../lib/prisma'

export const getRules = async (req: AuthRequest, res: Response) => {
  try {
    const rules = await automationService.getRules()

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
    const { name, trigger_type, conditions_json, actions_json } = req.body

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

    const task = await taskService.getTask(task_id)
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

    const runs = await prisma.automationRun.findMany({
      where: rule_id ? { ruleId: rule_id as string } : undefined,
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
