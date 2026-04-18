import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { reqifService } from '../services/reqif.service'

/**
 * Export requirements to ReqIF format
 */
export const exportToReqIF = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { requirementIds, parameterMode } = req.query

    const ids = requirementIds
      ? (typeof requirementIds === 'string' ? requirementIds.split(',') : requirementIds)
      : undefined
    const paramMode = (parameterMode === 'resolved' ? 'resolved' : 'name') as 'name' | 'resolved'

    const reqifXml = await reqifService.exportToReqIF(projectId, ids as string[] | undefined, paramMode)

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

// #298: hard cap on the XML payload to keep a single signed-in user from
// pinning the backend event loop via an 8 MB+ crafted ReqIF. The Express
// body limit (50 MB in server.ts) is too permissive for a synchronously
// parsed XML document — fast-xml-parser will expand that to hundreds of
// MB of heap during tree construction.
const MAX_REQIF_CHARS = 8 * 1024 * 1024 // 8 MB of XML text

/**
 * Import requirements from ReqIF format
 */
export const importFromReqIF = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const actorUserId = req.userId

    if (!req.body || !req.body.reqifXml) {
      return res.status(400).json({
        success: false,
        error: 'ReqIF XML content is required',
      })
    }

    if (typeof req.body.reqifXml !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'reqifXml must be a string',
      })
    }

    if (req.body.reqifXml.length > MAX_REQIF_CHARS) {
      return res.status(413).json({
        success: false,
        error: `ReqIF payload exceeds size limit (${MAX_REQIF_CHARS} chars)`,
      })
    }

    const result = await reqifService.importFromReqIF(projectId, req.body.reqifXml, actorUserId)

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
