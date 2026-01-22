import { Router } from 'express'
import { authenticateToken } from '../middleware/auth.middleware'
import {
  getPurchaseOrders,
  getPurchaseOrder,
  createPurchaseOrder,
  approvePurchaseOrder,
  getGoodsReceipts,
  getGoodsReceipt,
  createGoodsReceipt,
  postGoodsReceipt,
} from '../controllers/inventory/purchase.controller'
import {
  getSuppliers,
  getSupplier,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/inventory/supplier.controller'
import {
  getCustomers,
  getCustomer,
  createCustomer,
} from '../controllers/inventory/customer.controller'

const router = Router()

router.use(authenticateToken)

// Suppliers
router.get('/suppliers', getSuppliers)
router.get('/suppliers/:id', getSupplier)
router.post('/suppliers', createSupplier)
router.patch('/suppliers/:id', updateSupplier)
router.delete('/suppliers/:id', deleteSupplier)

// Customers
router.get('/customers', getCustomers)
router.get('/customers/:id', getCustomer)
router.post('/customers', createCustomer)

// Purchase Orders
router.get('/purchase-orders', getPurchaseOrders)
router.get('/purchase-orders/:id', getPurchaseOrder)
router.post('/purchase-orders', createPurchaseOrder)
router.post('/purchase-orders/:id/approve', approvePurchaseOrder)

// Goods Receipts
router.get('/receipts', getGoodsReceipts)
router.get('/receipts/:id', getGoodsReceipt)
router.post('/receipts', createGoodsReceipt)
router.post('/receipts/:id/post', postGoodsReceipt)

export default router
