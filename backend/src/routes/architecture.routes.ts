import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { projectIdParam } from '../middleware/resolveProjectParam.middleware'

const router = Router()

router.use(authenticateToken)
router.param('projectId', projectIdParam)

router.get('/:projectId', (req, res) => {
  res.json({ message: 'Architecture routes - to be implemented' })
})

export default router
