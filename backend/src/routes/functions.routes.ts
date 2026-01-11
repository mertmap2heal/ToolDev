import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', (req, res) => {
  res.json({ message: 'Functions routes - to be implemented' })
})

export default router
