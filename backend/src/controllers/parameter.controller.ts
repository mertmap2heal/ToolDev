import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function buildParameterWhere(projectId: string, query: Record<string, string | undefined>) {
  const where: Record<string, unknown> = { projectId }
  if (query.search) {
    const s = query.search.trim().toLowerCase()
    where.OR = [
      { name: { contains: s, mode: 'insensitive' } },
      { description: { contains: s, mode: 'insensitive' } },
      { dataType: { contains: s, mode: 'insensitive' } },
    ]
  }
  if (query.status) where.status = query.status
  if (query.ownerType) where.ownerType = query.ownerType
  if (query.folderId !== undefined && query.folderId !== '') {
    if (query.folderId === '__none__') where.folderId = null
    else where.folderId = query.folderId
  }
  return where
}

export const getParameters = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { search, status, ownerType, folderId, tags, sort = 'updatedAt', order = 'desc' } = req.query as Record<string, string>

    const where = buildParameterWhere(projectId, { search, status, ownerType, folderId, tags })
    // Prisma does not support array_contains on Json; filter tags in memory if needed
    const parameters = await prisma.parameter.findMany({
      where: Object.keys(where).length > 1 ? where : { projectId },
      include: {
        sourceFunction: { select: { id: true, functionId: true, name: true } },
        sourceParameter: { select: { id: true, name: true } },
      },
      orderBy: { [sort === 'name' ? 'name' : sort === 'createdAt' ? 'createdAt' : 'updatedAt']: order === 'asc' ? 'asc' : 'desc' },
    })

    let filtered = parameters
    if (tags) {
      const tagList = (tags as string).split(',').map((t) => t.trim()).filter(Boolean)
      if (tagList.length) {
        filtered = parameters.filter((p) => {
          const t = p.tags as string[] | null
          if (!t || !Array.isArray(t)) return false
          return tagList.some((tag) => t.includes(tag))
        })
      }
    }

    res.json({ success: true, data: filtered })
  } catch (error) {
    console.error('Get parameters error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params

    const parameter = await prisma.parameter.findUnique({
      where: { id },
      include: {
        sourceFunction: { select: { id: true, functionId: true, name: true } },
        sourceParameter: { select: { id: true, name: true } },
        derivedParameters: { select: { id: true, name: true } },
      },
    })

    if (!parameter) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    res.json({ success: true, data: parameter })
  } catch (error) {
    console.error('Get parameter error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const updateParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params
    const body = req.body as Record<string, unknown>
    const {
      name,
      description,
      dataType,
      defaultValue,
      unit,
      tolerance,
      minValue,
      maxValue,
      status,
      ownerType,
      tags,
      folderId,
      sourceParameterId,
      formula,
      sourceFunctionId,
    } = body

    const parameter = await prisma.parameter.findUnique({ where: { id } })
    if (!parameter) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    const updateData: Record<string, unknown> = {}
    if (description !== undefined) updateData.description = description
    if (dataType !== undefined) updateData.dataType = dataType
    if (defaultValue !== undefined) updateData.defaultValue = defaultValue
    if (unit !== undefined) updateData.unit = unit
    if (tolerance !== undefined) updateData.tolerance = tolerance
    if (minValue !== undefined) updateData.minValue = minValue
    if (maxValue !== undefined) updateData.maxValue = maxValue
    if (status !== undefined) updateData.status = status
    if (ownerType !== undefined) updateData.ownerType = ownerType
    if (tags !== undefined) updateData.tags = tags
    if (folderId !== undefined) updateData.folderId = folderId === '' ? null : folderId
    if (sourceParameterId !== undefined) updateData.sourceParameterId = sourceParameterId === '' ? null : sourceParameterId
    if (formula !== undefined) updateData.formula = formula
    if (sourceFunctionId !== undefined) updateData.sourceFunctionId = sourceFunctionId === '' ? null : sourceFunctionId
    if (name !== undefined) updateData.name = name

    const updatedParameter = await prisma.parameter.update({
      where: { id },
      data: updateData,
      include: {
        sourceFunction: { select: { id: true, functionId: true, name: true } },
        sourceParameter: { select: { id: true, name: true } },
      },
    })

    const snapshot = {
      defaultValue: updatedParameter.defaultValue,
      unit: updatedParameter.unit,
      tolerance: updatedParameter.tolerance,
      minValue: updatedParameter.minValue,
      maxValue: updatedParameter.maxValue,
      status: updatedParameter.status,
      version: updatedParameter.version,
      updatedAt: updatedParameter.updatedAt,
    }
    const lastVersion = await prisma.parameterVersion.findFirst({
      where: { parameterId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (lastVersion?.version ?? 0) + 1
    await prisma.parameterVersion.create({
      data: {
        parameterId: id,
        version: nextVersion,
        snapshot: snapshot as object,
      },
    })

    res.json({ success: true, data: updatedParameter })
  } catch (error: any) {
    console.error('Update parameter error:', error)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A parameter with this name already exists in this project',
      })
    }
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const createParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const body = req.body as Record<string, unknown>
    const {
      name,
      description,
      dataType,
      defaultValue,
      unit,
      tolerance,
      minValue,
      maxValue,
      status,
      ownerType,
      tags,
      folderId,
      sourceParameterId,
      formula,
      sourceFunctionId,
    } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Parameter name is required' })
    }

    const parameter = await prisma.parameter.create({
      data: {
        projectId,
        name: (name as string).trim(),
        description: (description as string)?.trim() ?? null,
        dataType: (dataType as string)?.trim() ?? null,
        defaultValue: (defaultValue as string)?.trim() ?? null,
        unit: (unit as string)?.trim() ?? null,
        tolerance: (tolerance as string)?.trim() ?? null,
        minValue: (minValue as string)?.trim() ?? null,
        maxValue: (maxValue as string)?.trim() ?? null,
        status: (status as string) ?? 'draft',
        ownerType: (ownerType as string) ?? null,
        ...(Array.isArray(tags) ? { tags: tags as object } : {}),
        folderId: (folderId as string) || null,
        sourceParameterId: (sourceParameterId as string) || null,
        formula: (formula as string)?.trim() ?? null,
        sourceFunctionId: (sourceFunctionId as string) || null,
      },
      include: {
        sourceFunction: { select: { id: true, functionId: true, name: true } },
        sourceParameter: { select: { id: true, name: true } },
      },
    })

    await prisma.parameterVersion.create({
      data: {
        parameterId: parameter.id,
        version: 1,
        snapshot: {
          defaultValue: parameter.defaultValue,
          unit: parameter.unit,
          tolerance: parameter.tolerance,
          status: parameter.status,
          version: parameter.version,
        },
      },
    })

    res.status(201).json({ success: true, data: parameter })
  } catch (error: any) {
    console.error('Create parameter error:', error)
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'A parameter with this name already exists in this project',
      })
    }
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const resolveParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const parameter = await prisma.parameter.findFirst({
      where: { id, projectId },
    })

    if (!parameter) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    const value = parameter.defaultValue ?? ''
    const parts: string[] = [value]
    if (parameter.tolerance) parts.push(`±${parameter.tolerance}`)
    if (parameter.unit) parts.push(parameter.unit)
    const resolvedValue = parts.join(' ').trim()

    res.json({
      success: true,
      data: {
        id: parameter.id,
        name: parameter.name,
        value: parameter.defaultValue ?? '',
        unit: parameter.unit,
        tolerance: parameter.tolerance,
        minValue: parameter.minValue,
        maxValue: parameter.maxValue,
        resolvedDisplay: resolvedValue || value,
      },
    })
  } catch (error) {
    console.error('Resolve parameter error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/** GET /parameters/:projectId/resolve - returns all parameters as id -> resolved value map for text replacement */
export const resolveAllParameters = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params

    const parameters = await prisma.parameter.findMany({
      where: { projectId },
      select: { id: true, name: true, defaultValue: true, unit: true, tolerance: true, minValue: true, maxValue: true },
    })

    const map = parameters.map((p) => {
      const value = p.defaultValue ?? ''
      const parts: string[] = [value]
      if (p.tolerance) parts.push(`±${p.tolerance}`)
      if (p.unit) parts.push(p.unit)
      return {
        id: p.id,
        name: p.name,
        value: p.defaultValue ?? '',
        unit: p.unit,
        tolerance: p.tolerance,
        minValue: p.minValue,
        maxValue: p.maxValue,
        resolvedDisplay: parts.join(' ').trim() || value,
      }
    })

    res.json({ success: true, data: map })
  } catch (error) {
    console.error('Resolve all parameters error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getParameterVersions = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: parameterId } = req.params

    const parameter = await prisma.parameter.findFirst({
      where: { id: parameterId, projectId },
    })
    if (!parameter) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    const versions = await prisma.parameterVersion.findMany({
      where: { parameterId },
      orderBy: { version: 'desc' },
    })

    res.json({ success: true, data: versions })
  } catch (error) {
    console.error('Get parameter versions error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getParameterImpact = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id: parameterId } = req.params

    const parameter = await prisma.parameter.findFirst({
      where: { id: parameterId, projectId },
    })
    if (!parameter) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    const placeholder = `{{param:${parameterId}}}`
    const requirements = await prisma.requirement.findMany({
      where: {
        projectId,
        deletedAt: null,
        OR: [
          { title: { contains: placeholder } },
          { description: { contains: placeholder } },
        ],
      },
      select: { id: true, requirementId: true, title: true },
    })

    const traceLinks = await prisma.traceLink.findMany({
      where: {
        projectId,
        OR: [
          { sourceType: 'parameter', sourceId: parameterId },
          { targetType: 'parameter', targetId: parameterId },
        ],
      },
    })

    const componentIds = new Set<string>()
    const functionIds = new Set<string>()
    traceLinks.forEach((l) => {
      if (l.sourceType === 'pbs_component' || l.targetType === 'pbs_component') {
        componentIds.add(l.sourceType === 'pbs_component' ? l.sourceId : l.targetId)
      }
      if (l.sourceType === 'function' || l.targetType === 'function') {
        functionIds.add(l.sourceType === 'function' ? l.sourceId : l.targetId)
      }
    })

    const components = componentIds.size > 0
      ? await prisma.component.findMany({
          where: { id: { in: Array.from(componentIds) } },
          select: { id: true, name: true },
        })
      : []
    const functions = functionIds.size > 0
      ? await prisma.systemFunction.findMany({
          where: { id: { in: Array.from(functionIds) } },
          select: { id: true, name: true, functionId: true },
        })
      : []

    res.json({
      success: true,
      data: {
        parameterId,
        parameterName: parameter.name,
        requirements,
        traceLinks: traceLinks.map((l) => ({
          id: l.id,
          sourceType: l.sourceType,
          sourceId: l.sourceId,
          targetType: l.targetType,
          targetId: l.targetId,
          linkType: l.linkType,
        })),
        components,
        functions,
      },
    })
  } catch (error) {
    console.error('Get parameter impact error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const bulkUpdateParameters = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { ids, updates } = req.body as { ids: string[]; updates: Record<string, unknown> }

    if (!Array.isArray(ids) || ids.length === 0 || !updates || typeof updates !== 'object') {
      return res.status(400).json({ success: false, error: 'ids (array) and updates (object) are required' })
    }

    const allowed = ['status', 'folderId', 'ownerType', 'tags']
    const data: Record<string, unknown> = {}
    for (const key of allowed) {
      if (updates[key] !== undefined) data[key] = updates[key] === '' ? null : updates[key]
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ success: false, error: 'No allowed fields to update' })
    }

    await prisma.parameter.updateMany({
      where: { id: { in: ids }, projectId },
      data,
    })

    const parameters = await prisma.parameter.findMany({
      where: { id: { in: ids }, projectId },
      include: { sourceFunction: { select: { id: true, functionId: true, name: true } } },
    })

    res.json({ success: true, data: parameters })
  } catch (error) {
    console.error('Bulk update parameters error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
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
