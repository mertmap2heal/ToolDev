import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import { extractParameters } from '../utils/parameterExtractor'

const prisma = new PrismaClient()

export const createFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { functionId, name, description, sourceReqId, status, owner, verificationMethod } = req.body

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Function name is required',
      })
    }

    if (!functionId) {
      return res.status(400).json({
        success: false,
        error: 'Function ID is required',
      })
    }

    // Check if functionId already exists
    const existingFunction = await prisma.systemFunction.findUnique({
      where: { functionId },
    })

    if (existingFunction) {
      return res.status(400).json({
        success: false,
        error: 'Function ID already exists. Please use a different ID.',
      })
    }

    const function_ = await prisma.systemFunction.create({
      data: {
        projectId,
        functionId,
        name,
        description: description || '',
        sourceReqId,
        status: status || 'draft',
        owner: owner || '',
        verificationMethod: verificationMethod || '',
      },
    })

    // Extract parameters from description and create them
    if (description) {
      const parameterNames = extractParameters(description)
      for (const paramName of parameterNames) {
        try {
          await prisma.parameter.upsert({
            where: {
              projectId_name: {
                projectId,
                name: paramName,
              },
            },
            update: {
              // If parameter exists, update sourceFunctionId if not set
              sourceFunctionId: function_.id,
            },
            create: {
              projectId,
              name: paramName,
              description: `Parameter extracted from function ${functionId}`,
              sourceFunctionId: function_.id,
            },
          })
        } catch (error) {
          // Log but don't fail the function creation if parameter creation fails
          console.error(`Failed to create parameter ${paramName}:`, error)
        }
      }
    }

    res.status(201).json({
      success: true,
      data: function_,
    })
  } catch (error: any) {
    console.error('Create function error:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Internal server error'
    if (error?.message) {
      errorMessage = error.message
      // Check for common Prisma errors
      if (error.message.includes('Unknown arg')) {
        errorMessage = 'Database schema mismatch. Please run: npx prisma db push'
      } else if (error.message.includes('Foreign key constraint')) {
        errorMessage = 'Invalid project ID'
      } else if (error.message.includes('Unique constraint')) {
        errorMessage = 'Function with this name already exists'
      }
    }
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    })
  }
}

export const getFunctions = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const functions = await prisma.systemFunction.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    })

    res.json({
      success: true,
      data: functions,
    })
  } catch (error) {
    console.error('Get functions error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const getFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const function_ = await prisma.systemFunction.findUnique({
      where: { id },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

    res.json({
      success: true,
      data: function_,
    })
  } catch (error) {
    console.error('Get function error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const updateFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const { functionId, name, description, sourceReqId, status, owner, verificationMethod } = req.body

    const function_ = await prisma.systemFunction.findUnique({
      where: { id },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

    // Check if functionId is being changed and if it already exists
    if (functionId && functionId !== function_.functionId) {
      const existingFunction = await prisma.systemFunction.findUnique({
        where: { functionId },
      })

      if (existingFunction) {
        return res.status(400).json({
          success: false,
          error: 'Function ID already exists. Please use a different ID.',
        })
      }
    }

    const updatedFunction = await prisma.systemFunction.update({
      where: { id },
      data: {
        functionId,
        name,
        description,
        sourceReqId,
        status,
        owner,
        verificationMethod,
      },
    })

    // Extract parameters from description and create/update them
    if (description) {
      const parameterNames = extractParameters(description)
      for (const paramName of parameterNames) {
        try {
          await prisma.parameter.upsert({
            where: {
              projectId_name: {
                projectId,
                name: paramName,
              },
            },
            update: {
              // Update sourceFunctionId to link to this function
              sourceFunctionId: updatedFunction.id,
            },
            create: {
              projectId,
              name: paramName,
              description: `Parameter extracted from function ${updatedFunction.functionId || updatedFunction.name}`,
              sourceFunctionId: updatedFunction.id,
            },
          })
        } catch (error) {
          // Log but don't fail the function update if parameter creation fails
          console.error(`Failed to create/update parameter ${paramName}:`, error)
        }
      }
    }

    res.json({
      success: true,
      data: updatedFunction,
    })
  } catch (error) {
    console.error('Update function error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}

export const deleteFunction = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const function_ = await prisma.systemFunction.findUnique({
      where: { id },
    })

    if (!function_) {
      return res.status(404).json({
        success: false,
        error: 'Function not found',
      })
    }

    // Find and delete all issues that reference this function
    const linkedIssues = await prisma.issue.findMany({
      where: {
        projectId: function_.projectId,
        relatedFunctionIds: {
          has: id,
        },
      },
    })

    // Delete all linked issues
    if (linkedIssues.length > 0) {
      await prisma.issue.deleteMany({
        where: {
          id: {
            in: linkedIssues.map((issue) => issue.id),
          },
        },
      })
    }

    // Delete the function
    await prisma.systemFunction.delete({
      where: { id },
    })

    res.json({
      success: true,
      message: `Function deleted successfully${linkedIssues.length > 0 ? ` along with ${linkedIssues.length} linked issue(s)` : ''}`,
    })
  } catch (error) {
    console.error('Delete function error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    })
  }
}
