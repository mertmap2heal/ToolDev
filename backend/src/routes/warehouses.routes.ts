import { Router } from 'express'
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware'
import {
  getWarehouses,
  getWarehouse,
  createWarehouse,
  updateWarehouse,
  deleteWarehouse,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationTree,
} from '../controllers/inventory/warehouse.controller'

const router = Router()

// Inventory has no per-tenant scoping in the schema yet (#165). Gate every
// endpoint behind requireAdmin until the module enters a subscription tier
// and gets company/project isolation.
router.use(authenticateToken)
router.use(requireAdmin)

router.get('/', getWarehouses)
router.get('/:id', getWarehouse)
router.get('/:warehouseId/locations', getLocationTree)
router.post('/', createWarehouse)
router.patch('/:id', updateWarehouse)
router.delete('/:id', deleteWarehouse)
router.post('/locations', createLocation)
router.patch('/locations/:id', updateLocation)
router.delete('/locations/:id', deleteLocation)

export default router
