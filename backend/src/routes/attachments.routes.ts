import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireTaskProjectMember } from '../middleware/requireTaskProjectMember.middleware'
import { deleteAttachment } from '../controllers/attachment.controller'

const router = Router()

router.use(authenticateToken)

router.delete('/:id', requireTaskProjectMember('attachment'), deleteAttachment)

export default router
