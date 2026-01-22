import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { customerService, CreateCustomerInput } from '../../services/inventory/customer.service'

export const getCustomers = async (req: AuthRequest, res: Response) => {
  try {
    const customers = await customerService.getCustomers()

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

    const customer = await customerService.getCustomer(id)

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

    const customer = await customerService.createCustomer(input)

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
