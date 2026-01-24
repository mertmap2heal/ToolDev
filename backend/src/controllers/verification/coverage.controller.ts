import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { coverageService } from '../../services/verification/coverage.service'

export const getMocSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const summary = await coverageService.getMocSummary(projectId)
    res.json({ success: true, data: summary })
  } catch (error: any) {
    console.error('Get MoC summary error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const getPlanCoverage = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, planId } = req.params
    const coverage = await coverageService.getPlanCoverage(planId)
    if (!coverage) {
      return res.status(404).json({ success: false, error: 'Test plan not found' })
    }
    res.json({ success: true, data: coverage })
  } catch (error: any) {
    console.error('Get plan coverage error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
