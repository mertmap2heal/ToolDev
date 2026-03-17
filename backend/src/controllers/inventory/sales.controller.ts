import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import {
  salesService,
  CreateCustomerInput,
  CreateSalesOrderInput,
  CreateShipmentInput,
} from '../../services/inventory/sales.service'

export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const customers = await salesService.getCustomers()

    res.json({
      success: true,
      data: customers,
    })
  } catch (error: any) {
    console.error('Error fetching customers:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customers',
    })
  }
}

export const getCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const customer = await salesService.getCustomer(id)

    res.json({
      success: true,
      data: customer,
    })
  } catch (error: any) {
    console.error('Error fetching customer:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Customer not found',
    })
  }
}

export const createCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateCustomerInput = {
      code: req.body.code,
      name: req.body.name,
      contactName: req.body.contactName,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode,
      country: req.body.country,
    }

    if (!input.code || !input.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: code, name',
      })
    }

    const customer = await salesService.createCustomer(input)

    res.status(201).json({
      success: true,
      data: customer,
    })
  } catch (error: any) {
    console.error('Error creating customer:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create customer',
    })
  }
}

export const updateCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input: Partial<CreateCustomerInput> = {
      name: req.body.name,
      contactName: req.body.contactName,
      email: req.body.email,
      phone: req.body.phone,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      zipCode: req.body.zipCode,
      country: req.body.country,
    }

    Object.keys(input).forEach((key) => {
      if (input[key as keyof typeof input] === undefined) {
        delete input[key as keyof typeof input]
      }
    })

    const customer = await salesService.updateCustomer(id, input)

    res.json({
      success: true,
      data: customer,
    })
  } catch (error: any) {
    console.error('Error updating customer:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update customer',
    })
  }
}

export const deleteCustomer = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await salesService.deleteCustomer(id)

    res.json({
      success: true,
      message: 'Customer deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting customer:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete customer',
    })
  }
}

export const getSalesOrders = async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      customerId: req.query.customerId as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    }

    const result = await salesService.getSalesOrders(filters)

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error fetching sales orders:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch sales orders',
    })
  }
}

export const getSalesOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const so = await salesService.getSalesOrder(id)

    res.json({
      success: true,
      data: so,
    })
  } catch (error: any) {
    console.error('Error fetching sales order:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Sales order not found',
    })
  }
}

export const createSalesOrder = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateSalesOrderInput = {
      customerId: req.body.customerId,
      orderedAt: req.body.orderedAt ? new Date(req.body.orderedAt) : undefined,
      requiredAt: req.body.requiredAt ? new Date(req.body.requiredAt) : undefined,
      notes: req.body.notes,
      lines: req.body.lines,
    }

    if (!input.customerId || !input.lines || input.lines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: customerId, lines',
      })
    }

    const so = await salesService.createSalesOrder(input)

    res.status(201).json({
      success: true,
      data: so,
    })
  } catch (error: any) {
    console.error('Error creating sales order:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create sales order',
    })
  }
}

export const approveSalesOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const so = await salesService.approveSalesOrder(id)

    res.json({
      success: true,
      data: so,
    })
  } catch (error: any) {
    console.error('Error approving sales order:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to approve sales order',
    })
  }
}

export const allocateSalesOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const so = await salesService.allocateReservations(id)

    res.json({
      success: true,
      data: so,
    })
  } catch (error: any) {
    console.error('Error allocating sales order:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to allocate sales order',
    })
  }
}

export const getShipments = async (req: AuthRequest, res: Response) => {
  try {
    const filters = {
      salesOrderId: req.query.salesOrderId as string | undefined,
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    }

    const result = await salesService.getShipments(filters)

    res.json({
      success: true,
      data: result,
    })
  } catch (error: any) {
    console.error('Error fetching shipments:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch shipments',
    })
  }
}

export const getShipment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const shipment = await salesService.getShipment(id)

    res.json({
      success: true,
      data: shipment,
    })
  } catch (error: any) {
    console.error('Error fetching shipment:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Shipment not found',
    })
  }
}

export const createShipment = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateShipmentInput = {
      salesOrderId: req.body.salesOrderId,
      shippedAt: req.body.shippedAt ? new Date(req.body.shippedAt) : undefined,
      notes: req.body.notes,
      lines: req.body.lines,
    }

    if (!input.salesOrderId || !input.lines || input.lines.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: salesOrderId, lines',
      })
    }

    const shipment = await salesService.createShipment(input)

    res.status(201).json({
      success: true,
      data: shipment,
    })
  } catch (error: any) {
    console.error('Error creating shipment:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create shipment',
    })
  }
}

export const postShipment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const idempotencyKey = req.body.idempotencyKey || `shipment-${id}-${Date.now()}`

    const shipment = await salesService.postShipment(id, idempotencyKey)

    res.json({
      success: true,
      data: shipment,
    })
  } catch (error: any) {
    console.error('Error posting shipment:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to post shipment',
    })
  }
}
