import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { getRules, createRule, testRule, getRuns } from '../controllers/automation.controller'

const router = Router()

router.use(authenticateToken)

router.get('/rules', getRules)
router.post('/rules', createRule)
router.post('/rules/:id/test', testRule)
router.get('/runs', getRuns)

export default router
