import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getUoms,
  getUom,
  createUom,
} from '../controllers/inventory/uom.controller'

const router = Router()

router.use(authenticateToken)

router.get('/', getUoms)
router.get('/:id', getUom)
router.post('/', createUom)

export default router
