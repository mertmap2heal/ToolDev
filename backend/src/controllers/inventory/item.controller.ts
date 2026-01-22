import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { itemService, CreateItemInput, UpdateItemInput, ItemFilters } from '../../services/inventory/item.service'

export const getItems = async (req: AuthRequest, res: Response) => {
  try {
    const filters: ItemFilters = {
      sku: req.query.sku as string,
      name: req.query.name as string,
      categoryId: req.query.categoryId as string,
      trackingPolicy: req.query.trackingPolicy as 'NONE' | 'LOT' | 'SERIAL',
      projectId: req.query.projectId as string,
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      page: req.query.page ? parseInt(req.query.page as string) : 1,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
    }

    const result = await itemService.getItems(filters)

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error fetching items:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch items',
    })
  }
}

export const getItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const item = await itemService.getItem(id)

    res.json({
      success: true,
      data: item,
    })
  } catch (error: any) {
    console.error('Error fetching item:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Item not found',
    })
  }
}

export const createItem = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateItemInput = {
      sku: req.body.sku,
      name: req.body.name,
      description: req.body.description,
      trackingPolicy: req.body.trackingPolicy || 'NONE',
      uomId: req.body.uomId,
      categoryId: req.body.categoryId,
      projectId: req.body.projectId,
      isActive: req.body.isActive !== undefined ? req.body.isActive : true,
    }

    // Validate required fields
    if (!input.sku || !input.name || !input.uomId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sku, name, uomId',
      })
    }

    const item = await itemService.createItem(input)

    res.status(201).json({
      success: true,
      data: item,
    })
  } catch (error: any) {
    console.error('Error creating item:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create item',
    })
  }
}

export const updateItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input: UpdateItemInput = {
      name: req.body.name,
      description: req.body.description,
      trackingPolicy: req.body.trackingPolicy,
      uomId: req.body.uomId,
      categoryId: req.body.categoryId,
      projectId: req.body.projectId,
      isActive: req.body.isActive,
    }

    // Remove undefined fields
    Object.keys(input).forEach((key) => {
      if (input[key as keyof UpdateItemInput] === undefined) {
        delete input[key as keyof UpdateItemInput]
      }
    })

    const item = await itemService.updateItem(id, input)

    res.json({
      success: true,
      data: item,
    })
  } catch (error: any) {
    console.error('Error updating item:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update item',
    })
  }
}

export const deleteItem = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await itemService.deleteItem(id)

    res.json({
      success: true,
      message: 'Item deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting item:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete item',
    })
  }
}

export const getItemStock = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const stock = await itemService.getItemStock(id)

    res.json({
      success: true,
      data: stock,
    })
  } catch (error: any) {
    console.error('Error fetching item stock:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Item not found',
    })
  }
}

export const getItemLedger = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const fromDate = req.query.fromDate ? new Date(req.query.fromDate as string) : undefined
    const toDate = req.query.toDate ? new Date(req.query.toDate as string) : undefined
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100

    const ledger = await itemService.getItemLedger(id, {
      fromDate,
      toDate,
      limit,
    })

    res.json({
      success: true,
      data: ledger,
    })
  } catch (error: any) {
    console.error('Error fetching item ledger:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Item not found',
    })
  }
}
