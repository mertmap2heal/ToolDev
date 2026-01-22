import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getSalesOrders,
  getSalesOrder,
  createSalesOrder,
  approveSalesOrder,
  allocateSalesOrder,
  getShipments,
  getShipment,
  createShipment,
  postShipment,
} from '../controllers/inventory/sales.controller'

const router = Router()

router.use(authenticateToken)

// Customers
router.get('/customers', getCustomers)
router.get('/customers/:id', getCustomer)
router.post('/customers', createCustomer)
router.patch('/customers/:id', updateCustomer)
router.delete('/customers/:id', deleteCustomer)

// Sales Orders
router.get('/sales-orders', getSalesOrders)
router.get('/sales-orders/:id', getSalesOrder)
router.post('/sales-orders', createSalesOrder)
router.post('/sales-orders/:id/approve', approveSalesOrder)
router.post('/sales-orders/:id/allocate', allocateSalesOrder)

// Shipments
router.get('/shipments', getShipments)
router.get('/shipments/:id', getShipment)
router.post('/shipments', createShipment)
router.post('/shipments/:id/post', postShipment)

export default router
