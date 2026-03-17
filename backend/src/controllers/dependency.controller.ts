import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import dependencyService from '../services/dependency.service'

export const getRelations = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const relations = await dependencyService.getRelations(id)

    res.json({
      success: true,
      data: relations,
    })
  } catch (error: any) {
    console.error('Get relations error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const createRelation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { target_task_id, relation_type } = req.body
    const idempotencyKey = req.headers['idempotency-key'] as string
    const correlationId = idempotencyKey || undefined

    if (!target_task_id || !relation_type) {
      return res.status(400).json({
        success: false,
        error: 'target_task_id and relation_type are required',
      })
    }

    const relation = await dependencyService.createRelation(id, target_task_id, relation_type, correlationId)

    res.status(201).json({
      success: true,
      data: relation,
    })
  } catch (error: any) {
    console.error('Create relation error:', error)

    if (error?.message?.includes('circular dependency') || error?.message?.includes('cycle')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    if (error?.message?.includes('cannot be related to itself')) {
      return res.status(400).json({
        success: false,
        error: error.message,
      })
    }

    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const deleteRelation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await dependencyService.deleteRelation(id)

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Delete relation error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

export const getDependencyWarnings = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const warnings = await dependencyService.getDependencyWarnings(id)

    res.json({
      success: true,
      data: warnings,
    })
  } catch (error: any) {
    console.error('Get dependency warnings error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
