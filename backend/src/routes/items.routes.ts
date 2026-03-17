import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
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

router.use(authenticateToken)

router.get('/', getItems)
router.get('/:id', getItem)
router.get('/:id/stock', getItemStock)
router.get('/:id/ledger', getItemLedger)
router.post('/', createItem)
router.patch('/:id', updateItem)
router.delete('/:id', deleteItem)

export default router
