import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { documentationService } from '../services/documentation.service'

const router = Router()

router.use(authenticateToken)

router.post('/generate', async (req, res) => {
  try {
    const { projectId, format, sections } = req.body

    if (!projectId) {
      return res.status(400).json({
        success: false,
        error: 'Project ID is required',
      })
    }

    const content = await documentationService.generateDocument({
      projectId,
      format: format || 'markdown',
      sections: sections || ['all'],
    })

    res.json({
      success: true,
      data: {
        content,
        format: format || 'markdown',
      },
    })
  } catch (error: any) {
    console.error('Generate documentation error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

export default router
