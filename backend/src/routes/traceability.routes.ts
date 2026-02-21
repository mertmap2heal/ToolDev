import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'
import { traceabilityService } from '../services/traceability.service'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

// Get all trace links for a project (supports ?sourceId= &targetId= &sourceType= &targetType= for filtering)
router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const filters = req.query?.sourceId || req.query?.targetId || req.query?.sourceType || req.query?.targetType
      ? {
          sourceId: req.query.sourceId as string | undefined,
          targetId: req.query.targetId as string | undefined,
          sourceType: req.query.sourceType as string | undefined,
          targetType: req.query.targetType as string | undefined,
        }
      : undefined
    const links = await traceabilityService.getTraceLinks(projectId, filters)

    res.json({
      success: true,
      data: links,
    })
  } catch (error: any) {
    console.error('Get trace links error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

// Get traceability graph for visualization
router.get('/:projectId/graph', async (req, res) => {
  try {
    const { projectId } = req.params
    const graph = await traceabilityService.getTraceabilityGraph(projectId)

    res.json({
      success: true,
      data: graph,
    })
  } catch (error: any) {
    console.error('Get traceability graph error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

// Get suspect links only
router.get('/:projectId/suspect', async (req, res) => {
  try {
    const { projectId } = req.params
    const links = await traceabilityService.getSuspectLinks(projectId)

    res.json({
      success: true,
      data: links,
    })
  } catch (error: any) {
    console.error('Get suspect links error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

// Create a new trace link
router.post('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const { sourceType, sourceId, targetType, targetId, linkType, direction, rationale } = req.body

    if (!sourceType || !sourceId || !targetType || !targetId || !linkType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      })
    }

    const link = await traceabilityService.createTraceLink(
      projectId,
      sourceType,
      sourceId,
      targetType,
      targetId,
      linkType,
      direction,
      rationale,
      (req as any).user?.id
    )

    res.status(201).json({
      success: true,
      data: link,
    })
  } catch (error: any) {
    console.error('Create trace link error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

// Clear suspect flag on a link (mark as reviewed)
router.put('/:projectId/links/:linkId/clear-suspect', async (req, res) => {
  try {
    const { projectId, linkId } = req.params
    const { comment } = req.body || {}
    const link = await traceabilityService.clearSuspectLink(
      projectId,
      linkId,
      (req as any).user?.id,
      comment
    )

    res.json({
      success: true,
      data: link,
    })
  } catch (error: any) {
    console.error('Clear suspect link error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

// Mark all downstream links as suspect (called when a requirement is updated)
router.post('/:projectId/mark-suspect/:sourceId', async (req, res) => {
  try {
    const { projectId, sourceId } = req.params
    const count = await traceabilityService.markDownstreamLinksSuspect(projectId, sourceId)

    res.json({
      success: true,
      message: `Marked ${count} downstream link(s) as suspect`,
      count,
    })
  } catch (error: any) {
    console.error('Mark suspect links error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

// Delete a trace link
router.delete('/:projectId/links/:linkId', async (req, res) => {
  try {
    const { projectId, linkId } = req.params
    await traceabilityService.deleteTraceLink(
      projectId,
      linkId,
      (req as any).user?.id
    )

    res.json({
      success: true,
      message: 'Trace link deleted successfully',
    })
  } catch (error: any) {
    console.error('Delete trace link error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

export default router
