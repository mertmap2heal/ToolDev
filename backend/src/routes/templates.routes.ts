import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

// Placeholder routes for requirement templates
// TODO: Implement requirement template functionality

router.get('/', async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Requirement templates functionality coming soon',
  })
})

router.get('/:projectId', async (req, res) => {
  res.json({
    success: true,
    data: [],
    message: 'Requirement templates functionality coming soon',
  })
})

export default router
