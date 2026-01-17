import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { reqifService } from '../services/reqif.service'

/**
 * Export requirements to ReqIF format
 */
export const exportToReqIF = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { requirementIds } = req.query

    const ids = requirementIds
      ? (typeof requirementIds === 'string' ? requirementIds.split(',') : requirementIds)
      : undefined

    const reqifXml = await reqifService.exportToReqIF(projectId, ids as string[] | undefined)

    res.setHeader('Content-Type', 'application/xml')
    res.setHeader('Content-Disposition', `attachment; filename="requirements_${projectId}_${Date.now()}.reqif"`)
    res.send(reqifXml)
  } catch (error: any) {
    console.error('Export to ReqIF error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}

/**
 * Import requirements from ReqIF format
 */
export const importFromReqIF = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    if (!req.body || !req.body.reqifXml) {
      return res.status(400).json({
        success: false,
        error: 'ReqIF XML content is required',
      })
    }

    const result = await reqifService.importFromReqIF(projectId, req.body.reqifXml)

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Import from ReqIF error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
}
