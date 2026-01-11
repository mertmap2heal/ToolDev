import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { traceabilityService } from '../services/traceability.service'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params
    const links = await traceabilityService.getTraceLinks(projectId)

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

export default router
