import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { verificationService } from '../../services/verification/verification.service'
import { prisma } from '../../lib/prisma'

export const getSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const settings = await verificationService.getOrCreateSettings(projectId)
    res.json({ success: true, data: settings })
  } catch (error: any) {
    console.error('Get settings error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const updateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { allowedMocCodes, mocRulesByCriticality, lifecycleRules, namingRules, permissionsMap } = req.body
    const settings = await prisma.verSettings.upsert({
      where: { projectId },
      update: {
        allowedMocCodes: allowedMocCodes || undefined,
        mocRulesByCriticality: mocRulesByCriticality || undefined,
        lifecycleRules: lifecycleRules || undefined,
        namingRules: namingRules || undefined,
        permissionsMap: permissionsMap || undefined,
      },
      create: {
        projectId,
        allowedMocCodes: allowedMocCodes || [1, 2, 3, 4, 5, 6, 7, 8],
        mocRulesByCriticality: mocRulesByCriticality || {},
        lifecycleRules: lifecycleRules || {},
        namingRules: namingRules || { testCasePrefix: 'TC', testPlanPrefix: 'TP' },
        permissionsMap: permissionsMap || {},
      },
    })
    res.json({ success: true, data: settings })
  } catch (error: any) {
    console.error('Update settings error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}

export const validateSettings = async (req: AuthRequest, res: Response) => {
  try {
    const { lifecycleRules, namingRules } = req.body
    const errors: string[] = []
    // Basic validation
    if (lifecycleRules && typeof lifecycleRules !== 'object') {
      errors.push('lifecycleRules must be an object')
    }
    if (namingRules && typeof namingRules !== 'object') {
      errors.push('namingRules must be an object')
    }
    if (namingRules && !namingRules.testCasePrefix && !namingRules.testPlanPrefix) {
      errors.push('namingRules must have testCasePrefix or testPlanPrefix')
    }
    res.json({ success: errors.length === 0, errors })
  } catch (error: any) {
    console.error('Validate settings error:', error)
    res.status(500).json({ success: false, error: error?.message || 'Internal server error' })
  }
}
