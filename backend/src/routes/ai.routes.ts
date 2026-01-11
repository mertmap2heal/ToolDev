import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { aiService } from '../services/ai.service'

const router = Router()

router.use(authenticateToken)

router.post('/guidance', async (req, res) => {
  try {
    const { projectId, stage, context, prompt } = req.body

    if (!projectId || !stage) {
      return res.status(400).json({
        success: false,
        error: 'Project ID and stage are required',
      })
    }

    const guidance = await aiService.getGuidance({
      projectId,
      stage,
      context: context || '',
      prompt: prompt || 'Provide guidance for this stage',
    })

    res.json({
      success: true,
      data: guidance,
    })
  } catch (error: any) {
    console.error('AI guidance error:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    })
  }
})

export default router
