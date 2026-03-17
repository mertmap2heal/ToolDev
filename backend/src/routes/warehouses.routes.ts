import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
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

router.use(authenticateToken)

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
