import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { supplierService, CreateSupplierInput } from '../../services/inventory/supplier.service'

export const getSuppliers = async (req: AuthRequest, res: Response) => {
  try {
    const suppliers = await supplierService.getSuppliers()

    res.json({
      success: true,
      data: suppliers,
    })
  } catch (error: any) {
    console.error('Error fetching suppliers:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch suppliers',
    })
  }
}

export const getSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const supplier = await supplierService.getSupplier(id)

    res.json({
      success: true,
      data: supplier,
    })
  } catch (error: any) {
    console.error('Error fetching supplier:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'Supplier not found',
    })
  }
}

export const createSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateSupplierInput = {
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

    const supplier = await supplierService.createSupplier(input)

    res.status(201).json({
      success: true,
      data: supplier,
    })
  } catch (error: any) {
    console.error('Error creating supplier:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create supplier',
    })
  }
}

export const updateSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const input: Partial<CreateSupplierInput> = {
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

    const supplier = await supplierService.updateSupplier(id, input)

    res.json({
      success: true,
      data: supplier,
    })
  } catch (error: any) {
    console.error('Error updating supplier:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to update supplier',
    })
  }
}

export const deleteSupplier = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    await supplierService.deleteSupplier(id)

    res.json({
      success: true,
      message: 'Supplier deleted successfully',
    })
  } catch (error: any) {
    console.error('Error deleting supplier:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to delete supplier',
    })
  }
}
