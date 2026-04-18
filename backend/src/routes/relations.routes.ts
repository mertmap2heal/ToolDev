import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireTaskProjectMember } from '../middleware/requireTaskProjectMember.middleware'
import { deleteRelation } from '../controllers/dependency.controller'

const router = Router()

router.use(authenticateToken)

router.delete('/:id', requireTaskProjectMember('relation'), deleteRelation)

export default router
