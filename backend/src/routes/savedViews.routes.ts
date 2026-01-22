import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getSavedViews,
  createSavedView,
  getSavedView,
  updateSavedView,
  deleteSavedView,
} from '../controllers/savedView.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', getSavedViews)
router.post('/', createSavedView)
router.get('/:id', getSavedView)
router.patch('/:id', updateSavedView)
router.delete('/:id', deleteSavedView)

export default router
