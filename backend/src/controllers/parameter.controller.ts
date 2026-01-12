import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const getParameters = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const parameters = await prisma.parameter.findMany({
      where: { projectId },
      include: {
        sourceFunction: {
          select: {
            id: true,
            functionId: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: parameters,
    })
  } catch (error) {
    console.error('Get parameters error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const parameter = await prisma.parameter.findUnique({
      where: { id },
      include: {
        sourceFunction: {
          select: {
            id: true,
            functionId: true,
            name: true,
          },
        },
      },
    })

    if (!parameter) {
      return res.status(404).json({
        success: false,
        error: 'Parameter not found',
      })
    }

    res.json({
      success: true,
      data: parameter,
    })
  } catch (error) {
    console.error('Get parameter error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { description, dataType, defaultValue, unit } = req.body

    const parameter = await prisma.parameter.findUnique({
      where: { id },
    })

    if (!parameter) {
      return res.status(404).json({
        success: false,
        error: 'Parameter not found',
      })
    }

    // Note: name is not updated as it's extracted from function description
    const updatedParameter = await prisma.parameter.update({
      where: { id },
      data: {
        description,
        dataType,
        defaultValue,
        unit,
      },
    })

    res.json({
      success: true,
      data: updatedParameter,
    })
  } catch (error: any) {
    console.error('Update parameter error:', error)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A parameter with this name already exists in this project',
      })
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const parameter = await prisma.parameter.findUnique({
      where: { id },
    })

    if (!parameter) {
      return res.status(404).json({
        success: false,
        error: 'Parameter not found',
      })
    }

    await prisma.parameter.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: 'Parameter deleted successfully',
    })
  } catch (error) {
    console.error('Delete parameter error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
