import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { deleteRelation } from '../controllers/dependency.controller'

const router = Router()

router.use(authenticateToken)

router.delete('/:id', deleteRelation)

export default router
