import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  requireBodyProjectMember,
  requireRuleProjectMember,
} from '../middleware/requireTaskProjectMember.middleware'
import { getRules, createRule, testRule, getRuns } from '../controllers/automation.controller'

const router = Router()

router.use(authenticateToken)

// SEC-2 (#375): all rule routes now require project membership. Lists and
// creates supply project_id explicitly; rule-id routes resolve projectId
// from AutomationRule. /runs also requires project_id (query) and -
// when filtered by rule_id - additionally checks rule membership.
router.get('/rules', requireBodyProjectMember('query'), getRules)
router.post('/rules', requireBodyProjectMember('body'), createRule)
router.post('/rules/:id/test', requireRuleProjectMember(), testRule)
router.get('/runs', requireBodyProjectMember('query'), getRuns)

export default router
