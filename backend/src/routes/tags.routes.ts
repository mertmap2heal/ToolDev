import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import { requireBodyProjectMember } from '../middleware/requireTaskProjectMember.middleware'
import { getTags, createTag } from '../controllers/tag.controller'

const router = Router()

router.use(authenticateToken)

// SEC-2 (#375): tags are now project-scoped. List and create require
// project_id (query / body) and project membership. The schema change
// drops the global unique on `name` and replaces it with
// @@unique([projectId, name]).
router.get('/', requireBodyProjectMember('query'), getTags)
router.post('/', requireBodyProjectMember('body'), createTag)

export default router
