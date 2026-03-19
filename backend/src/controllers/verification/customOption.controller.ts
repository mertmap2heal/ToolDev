import { Response } from 'express'
import { AuthRequest } from '../../middleware/auth.middleware'
import { prisma } from '../../lib/prisma'
import {
  capitalizeFirstLetter,
  getSystemDefaults,
  normalizeOptionValue,
  type CustomOptionType,
} from '../../services/verification/customOption.service'


/**
 * Get all options (system + custom) for a given option type
 */
export const getCustomOptions = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, optionType } = req.params

    const validOptionTypes = ['ENVIRONMENT_TYPE', 'COMPONENT_TYPE', 'INTERFACE_TYPE', 'PHASE', 'TESTING_TOOL', 'REQUIREMENT_LEVEL', 'RISK', 'COMPLEXITY', 'VERIFICATION_METHOD', 'SOURCE', 'BASELINE_TYPE', 'BASELINE_REVIEW_TYPE']
    if (!validOptionTypes.includes(optionType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid optionType',
      })
    }

    // Get system defaults
    const systemDefaults = getSystemDefaults(optionType as CustomOptionType)

    // Get custom options from database
    const customOptions = await prisma.verCustomOption.findMany({
      where: {
        projectId,
        optionType: optionType as CustomOptionType,
      },
      orderBy: {
        value: 'asc',
      },
    })

    // Combine system defaults (as objects) with custom options
    const systemOptions = systemDefaults.map((value) => ({
      id: `system-${value.toLowerCase()}`,
      projectId,
      optionType: optionType as CustomOptionType,
      value,
      isSystem: true,
      createdAt: new Date(0), // System options have no creation date
      updatedAt: new Date(0),
    }))

    // Merge and deduplicate (custom options override system if same value)
    const allOptionsMap = new Map<string, any>()
    systemOptions.forEach((opt) => {
      const key = normalizeOptionValue(opt.value)
      allOptionsMap.set(key, opt)
    })
    customOptions.forEach((opt) => {
      const key = normalizeOptionValue(opt.value)
      allOptionsMap.set(key, {
        id: opt.id,
        projectId: opt.projectId,
        optionType: opt.optionType,
        value: opt.value,
        isSystem: opt.isSystem,
        createdAt: opt.createdAt,
        updatedAt: opt.updatedAt,
      })
    })

    const allOptions = Array.from(allOptionsMap.values()).sort((a, b) =>
      a.value.localeCompare(b.value)
    )

    res.json({
      success: true,
      data: allOptions,
    })
  } catch (error: any) {
    console.error('Get custom options error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

/**
 * Add a new custom option
 */
export const addCustomOption = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { optionType, value } = req.body

    if (!optionType || !value) {
      return res.status(400).json({
        success: false,
        error: 'optionType and value are required',
      })
    }

    const validOptionTypes = ['ENVIRONMENT_TYPE', 'COMPONENT_TYPE', 'INTERFACE_TYPE', 'PHASE', 'TESTING_TOOL', 'REQUIREMENT_LEVEL', 'RISK', 'COMPLEXITY', 'VERIFICATION_METHOD', 'SOURCE', 'BASELINE_TYPE', 'BASELINE_REVIEW_TYPE']
    if (!validOptionTypes.includes(optionType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid optionType',
      })
    }

    // For baseline types use lowercase; for review types preserve (SRR, PDR, CDR); others capitalize
    const normalizedValue = (optionType === 'BASELINE_TYPE' || optionType === 'BASELINE_REVIEW_TYPE')
      ? value.trim()
      : capitalizeFirstLetter(value.trim())

    if (!normalizedValue || normalizedValue.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Value cannot be empty',
      })
    }

    // Check if option already exists (case-insensitive)
    const existing = await prisma.verCustomOption.findFirst({
      where: {
        projectId,
        optionType: optionType as CustomOptionType,
        value: {
          equals: normalizedValue,
          mode: 'insensitive',
        },
      },
    })

    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'This option already exists',
      })
    }

    // Check if it matches a system default (case-insensitive)
    const systemDefaults = getSystemDefaults(optionType as CustomOptionType)
    const isSystemDefault = systemDefaults.some(
      (sysVal) => normalizeOptionValue(sysVal) === normalizeOptionValue(normalizedValue)
    )

    if (isSystemDefault) {
      return res.status(400).json({
        success: false,
        error: 'This option already exists as a system default',
      })
    }

    // Create custom option
    const customOption = await prisma.verCustomOption.create({
      data: {
        projectId,
        optionType: optionType as CustomOptionType,
        value: normalizedValue,
        isSystem: false,
      },
    })

    res.status(201).json({
      success: true,
      data: customOption,
    })
  } catch (error: any) {
    console.error('Add custom option error:', error)
    if (error.code === 'P2002') {
      // Unique constraint violation
      return res.status(400).json({
        success: false,
        error: 'This option already exists',
      })
    }
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}

/**
 * Remove a custom option (only if isSystem = false)
 */
export const removeCustomOption = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const customOption = await prisma.verCustomOption.findFirst({
      where: {
        id,
        projectId,
      },
    })

    if (!customOption) {
      return res.status(404).json({
        success: false,
        error: 'Custom option not found',
      })
    }

    if (customOption.isSystem) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete system default options',
      })
    }

    await prisma.verCustomOption.delete({
      where: { id },
    })

    res.json({
      success: true,
      data: null,
    })
  } catch (error: any) {
    console.error('Remove custom option error:', error)
    res.status(500).json({
      success: false,
      error: error?.message || 'Internal server error',
    })
  }
}
