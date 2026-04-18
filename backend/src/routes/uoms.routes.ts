import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import {
  getUoms,
  getUom,
  createUom,
} from '../controllers/inventory/uom.controller'

const router = Router()

// Inventory has no per-tenant scoping in the schema yet (#165). Gate every
// endpoint behind requireAdmin until the module enters a subscription tier
// and gets company/project isolation.
router.use(authenticateToken)
router.use(requireAdmin)

router.get('/', getUoms)
router.get('/:id', getUom)
router.post('/', createUom)

export default router
