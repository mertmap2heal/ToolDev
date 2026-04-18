import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import {
  getItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  getItemStock,
  getItemLedger,
} from '../controllers/inventory/item.controller'

const router = Router()

// Inventory has no per-tenant scoping in the schema yet (#165). Until the
// module enters a subscription tier and gets company/project isolation,
// every endpoint is gated to platform admins so regular users cannot read
// or mutate another tenant's inventory.
router.use(authenticateToken)
router.use(requireAdmin)

router.get('/', getItems)
router.get('/:id', getItem)
router.get('/:id/stock', getItemStock)
router.get('/:id/ledger', getItemLedger)
router.post('/', createItem)
router.patch('/:id', updateItem)
router.delete('/:id', deleteItem)

export default router
