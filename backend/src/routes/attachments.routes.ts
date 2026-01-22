import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { deleteAttachment } from '../controllers/attachment.controller'

const router = Router()

router.use(authenticateToken)

router.delete('/:id', deleteAttachment)

export default router
