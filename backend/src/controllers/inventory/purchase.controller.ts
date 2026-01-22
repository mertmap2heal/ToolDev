import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { purchaseService, CreatePurchaseOrderInput, CreateGoodsReceiptInput } from '../../services/inventory/purchase.service'
import { inventoryService } from '../../services/inventory/inventory.service'
import { generateIdempotencyKey } from '../../utils/idempotency'

export const getPurchaseOrders = async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      supplierId: req.query.supplierId as string,
      status: req.query.status as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    }

    const result = await purchaseService.getPurchaseOrders(filters)

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error fetching purchase orders:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch purchase orders',
    })
  }
}

export const getPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const po = await purchaseService.getPurchaseOrder(id)

    res.json({
      success: true,
      data: po,
    })
  } catch (error: any) {
    console.error('Error fetching purchase order:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Purchase order not found',
    })
  }
}

export const createPurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreatePurchaseOrderInput = {
      supplierId: req.body.supplierId,
      orderedAt: req.body.orderedAt ? new Date(req.body.orderedAt) : undefined,
      expectedAt: req.body.expectedAt ? new Date(req.body.expectedAt) : undefined,
      notes: req.body.notes,
      lines: req.body.lines || [],
    }

    if (!input.supplierId || !input.lines || input.lines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: supplierId, lines',
      })
    }

    const po = await purchaseService.createPurchaseOrder(input)

    res.status(201).json({
      success: true,
      data: po,
    })
  } catch (error: any) {
    console.error('Error creating purchase order:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create purchase order',
    })
  }
}

export const approvePurchaseOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const po = await purchaseService.approvePurchaseOrder(id)

    res.json({
      success: true,
      data: po,
    })
  } catch (error: any) {
    console.error('Error approving purchase order:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to approve purchase order',
    })
  }
}

export const getGoodsReceipts = async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      purchaseOrderId: req.query.purchaseOrderId as string,
      status: req.query.status as string,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    }

    const result = await purchaseService.getGoodsReceipts(filters)

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error fetching goods receipts:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch goods receipts',
    })
  }
}

export const getGoodsReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const receipt = await purchaseService.getGoodsReceipt(id)

    res.json({
      success: true,
      data: receipt,
    })
  } catch (error: any) {
    console.error('Error fetching goods receipt:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Goods receipt not found',
    })
  }
}

export const createGoodsReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateGoodsReceiptInput = {
      purchaseOrderId: req.body.purchaseOrderId,
      receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : undefined,
      notes: req.body.notes,
      lines: req.body.lines || [],
    }

    if (!input.lines || input.lines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: lines',
      })
    }

    const receipt = await purchaseService.createGoodsReceipt(input)

    res.status(201).json({
      success: true,
      data: receipt,
    })
  } catch (error: any) {
    console.error('Error creating goods receipt:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create goods receipt',
    })
  }
}

export const postGoodsReceipt = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const idempotencyKey = req.body.idempotencyKey || generateIdempotencyKey('receipt', id)

    await inventoryService.postReceipt({
      receiptId: id,
      idempotencyKey,
    })

    const receipt = await purchaseService.getGoodsReceipt(id)

    res.json({
      success: true,
      data: receipt,
      message: 'Goods receipt posted to inventory successfully',
    })
  } catch (error: any) {
    console.error('Error posting goods receipt:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to post goods receipt',
    })
  }
}
