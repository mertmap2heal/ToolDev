import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
} from '../controllers/view.controller'

const router = Router()

router.use(authenticateToken)

router.get('/:projectId', getSavedViews)
router.post('/:projectId', createSavedView)
router.put('/:projectId/:viewId', updateSavedView)
router.delete('/:projectId/:viewId', deleteSavedView)

export default router
