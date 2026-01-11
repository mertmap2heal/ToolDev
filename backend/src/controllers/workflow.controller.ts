import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { getWorkflowProgress as getWorkflowProgressService } from '../services/workflow.service'

export const getWorkflowProgress = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const progress = await getWorkflowProgressService(projectId)

    res.json({
      success: true,
      data: progress,
    })
  } catch (error) {
    console.error('Get workflow progress error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateWorkflowStep = async (req: AuthRequest, res: Response) => {
  try {
    res.json({
      success: true,
      message: 'Workflow step update - to be implemented',
    })
  } catch (error) {
    console.error('Update workflow step error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
