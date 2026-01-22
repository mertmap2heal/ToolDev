import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { warehouseService, CreateWarehouseInput, CreateLocationInput } from '../../services/inventory/warehouse.service'

export const getWarehouses = async (req: AuthRequest, res: Response) => {
  try {
    const warehouses = await warehouseService.getWarehouses()

    res.json({
      success: true,
      data: warehouses,
    })
  } catch (error: any) {
    console.error('Error fetching warehouses:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch warehouses',
    })
  }
}

export const getWarehouse = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const warehouse = await warehouseService.getWarehouse(id)

    res.json({
      success: true,
      data: warehouse,
    })
  } catch (error: any) {
    console.error('Error fetching warehouse:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Warehouse not found',
    })
  }
}

export const createWarehouse = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateWarehouseInput = {
      name: req.body.name,
      code: req.body.code,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode,
      country: req.body.country,
      negativeStockPolicy: req.body.negativeStockPolicy || 'STRICT',
    }

    if (!input.name || !input.code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, code',
      })
    }

    const warehouse = await warehouseService.createWarehouse(input)

    res.status(201).json({
      success: true,
      data: warehouse,
    })
  } catch (error: any) {
    console.error('Error creating warehouse:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create warehouse',
    })
  }
}

export const createLocation = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateLocationInput = {
      warehouseId: req.body.warehouseId,
      code: req.body.code,
      name: req.body.name,
      parentLocationId: req.body.parentLocationId,
      locationType: req.body.locationType,
      pickingPriority: req.body.pickingPriority,
    }

    if (!input.warehouseId || !input.code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: warehouseId, code',
      })
    }

    const location = await warehouseService.createLocation(input)

    res.status(201).json({
      success: true,
      data: location,
    })
  } catch (error: any) {
    console.error('Error creating location:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create location',
    })
  }
}

export const getLocationTree = async (req: AuthRequest, res: Response) => {
  try {
    const { warehouseId } = req.params

    const tree = await warehouseService.getLocationTree(warehouseId)

    res.json({
      success: true,
      data: tree,
    })
  } catch (error: any) {
    console.error('Error fetching location tree:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch location tree',
    })
  }
}

export const updateWarehouse = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input = {
      name: req.body.name,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode,
      country: req.body.country,
      negativeStockPolicy: req.body.negativeStockPolicy,
      isActive: req.body.isActive,
    }

    Object.keys(input).forEach((key) => {
      if (input[key as keyof typeof input] === undefined) {
        delete input[key as keyof typeof input]
      }
    })

    const warehouse = await warehouseService.updateWarehouse(id, input)

    res.json({
      success: true,
      data: warehouse,
    })
  } catch (error: any) {
    console.error('Error updating warehouse:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update warehouse',
    })
  }
}

export const deleteWarehouse = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await warehouseService.deleteWarehouse(id)

    res.json({
      success: true,
      message: 'Warehouse deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting warehouse:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete warehouse',
    })
  }
}

export const updateLocation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input = {
      code: req.body.code,
      name: req.body.name,
      parentLocationId: req.body.parentLocationId,
      locationType: req.body.locationType,
      pickingPriority: req.body.pickingPriority,
    }

    Object.keys(input).forEach((key) => {
      if (input[key as keyof typeof input] === undefined) {
        delete input[key as keyof typeof input]
      }
    })

    const location = await warehouseService.updateLocation(id, input)

    res.json({
      success: true,
      data: location,
    })
  } catch (error: any) {
    console.error('Error updating location:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update location',
    })
  }
}

export const deleteLocation = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await warehouseService.deleteLocation(id)

    res.json({
      success: true,
      message: 'Location deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting location:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete location',
    })
  }
}
