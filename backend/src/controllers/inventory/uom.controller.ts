import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { uomService, CreateUomInput } from '../../services/inventory/uom.service'

export const getUoms = async (req: AuthRequest, res: Response) => {
  try {
    const uoms = await uomService.getUoms()

    res.json({
      success: true,
      data: uoms,
    })
  } catch (error: any) {
    console.error('Error fetching UOMs:', error)
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch UOMs',
    })
  }
}

export const getUom = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const uom = await uomService.getUom(id)

    res.json({
      success: true,
      data: uom,
    })
  } catch (error: any) {
    console.error('Error fetching UOM:', error)
    res.status(404).json({
      success: false,
      error: error.message || 'UOM not found',
    })
  }
}

export const createUom = async (req: AuthRequest, res: Response) => {
  try {
    const input: CreateUomInput = {
      code: req.body.code,
      name: req.body.name,
      description: req.body.description,
    }

    if (!input.code || !input.name) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: code, name',
      })
    }

    const uom = await uomService.createUom(input)

    res.status(201).json({
      success: true,
      data: uom,
    })
  } catch (error: any) {
    console.error('Error creating UOM:', error)
    res.status(400).json({
      success: false,
      error: error.message || 'Failed to create UOM',
    })
  }
}
