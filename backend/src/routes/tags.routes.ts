import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { getTags, createTag } from '../controllers/tag.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', getTags)
router.post('/', createTag)

export default router
