import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { PrismaClient } from '@prisma/client'
import {
  exportParameters as formatExport,
  getExportMeta,
  SUPPORTED_EXPORT_FORMATS,
  ExportParameter,
} from '../services/parameterExport.service'
import {
  importParameters as parseImport,
  detectFormat,
} from '../services/parameterImport.service'
import {
  createGitLabRepo,
  pushAllFormats as pushAllFormatsGitLab,
  getLatestCommit as getLatestCommitGitLab,
  getRepoInfo as getRepoInfoGitLab,
  generateSubmoduleInstructions as genInstructionsGitLab,
  validateGitLabToken,
  protectGitLabBranch,
  unprotectGitLabBranch,
  GitLabConfig,
} from '../services/gitlab.service'
import {
  createGitHubRepo,
  pushAllFormatsGitHub,
  getLatestCommitGitHub,
  getRepoInfoGitHub,
  generateSubmoduleInstructionsGitHub,
  validateGitHubToken,
  protectGitHubBranch,
} from '../services/github.service'
import {
  createBitbucketRepo,
  pushAllFormatsBitbucket,
  getLatestCommitBitbucket,
  getRepoInfoBitbucket,
  generateSubmoduleInstructionsBitbucket,
  validateBitbucketToken,
  protectBitbucketBranch,
  BitbucketConfig,
} from '../services/bitbucket.service'
import {
  createAzureRepo,
  pushAllFormatsAzure,
  getLatestCommitAzure,
  getRepoInfoAzure,
  generateSubmoduleInstructionsAzure,
  validateAzureToken,
  protectAzureBranch,
  AzureDevOpsConfig,
} from '../services/azuredevops.service'

const prisma = new PrismaClient()

async function generateParameterId(projectId: string): Promise<string> {
  const prefix = 'PARAM'
  const all = await prisma.parameter.findMany({
    where: { projectId },
    select: { parameterId: true },
  })
  let maxNumber = 0
  for (const p of all) {
    if (p.parameterId && /^PARAM-\d+$/.test(p.parameterId)) {
      const m = p.parameterId.match(/-(\d+)$/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > maxNumber) maxNumber = n
      }
    }
  }
  return `${prefix}-${(maxNumber + 1).toString().padStart(3, '0')}`
}

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

/**
 * Auto-increment the minor version for approved parameters when substantive
 * fields change. Format: "X.Y" → "X.Y+1". Falls back gracefully for other formats.
 */
function incrementMinorVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)$/)
  if (match) return `${match[1]}.${parseInt(match[2], 10) + 1}`
  const intMatch = version.match(/^(\d+)$/)
  if (intMatch) return `${parseInt(intMatch[1], 10)}.1`
  return `${version}.1` // unknown format — append suffix
}

/** Fields whose change on an approved parameter triggers a version bump. */
const VERSION_BUMP_FIELDS = new Set([
  'name', 'defaultValue', 'dataType', 'unit', 'tolerance',
  'minValue', 'maxValue', 'formula', 'description', 'enumValues', 'dimensions',
])

/** Build full auditable snapshot for ParameterVersion (name, description, value fields, status, etc.). */
function buildParameterVersionSnapshot(p: {
  name: string
  description?: string | null
  dataType?: string | null
  defaultValue?: string | null
  unit?: string | null
  tolerance?: string | null
  minValue?: string | null
  maxValue?: string | null
  version?: string | null
  status?: string | null
  ownerType?: string | null
  formula?: string | null
  tags?: unknown
  updatedAt: Date
}) {
  return {
    name: p.name,
    description: p.description ?? null,
    dataType: p.dataType ?? null,
    defaultValue: p.defaultValue ?? null,
    unit: p.unit ?? null,
    tolerance: p.tolerance ?? null,
    minValue: p.minValue ?? null,
    maxValue: p.maxValue ?? null,
    version: p.version ?? null,
    status: p.status ?? null,
    ownerType: p.ownerType ?? null,
    formula: p.formula ?? null,
    tags: p.tags ?? null,
    updatedAt: p.updatedAt,
  }
}

const PARAM_PLACEHOLDER_REGEX = /\{\{\s*param\s*:\s*([a-f0-9-]{36})\s*\}\}/gi

/** Aggregate requirement usage counts per parameter id from requirement title/description. */
function aggregateParameterUsageCounts(
  requirements: { id: string; title: string; description: string }[]
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of requirements) {
    const text = `${r.title ?? ''} ${r.description ?? ''}`
    let m: RegExpExecArray | null
    const re = new RegExp(PARAM_PLACEHOLDER_REGEX.source, 'gi')
    while ((m = re.exec(text)) !== null) {
      if (m[1]) {
        const id = m[1].toLowerCase()
        counts.set(id, (counts.get(id) ?? 0) + 1)
      }
    }
  }
  return counts
}

export const getParameters = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { search, status, ownerType, folderId, tags, sort = 'updatedAt', order = 'desc', includeUsageCounts } = req.query as Record<string, string>

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

    if (includeUsageCounts === 'true' || includeUsageCounts === '1') {
      const reqs = await prisma.requirement.findMany({
        where: {
          projectId,
          deletedAt: null,
          OR: [
            { title: { contains: '{{param:' } },
            { description: { contains: '{{param:' } },
          ],
        },
        select: { id: true, title: true, description: true },
      })
      const usageCounts = aggregateParameterUsageCounts(reqs)
      const withCounts = filtered.map((p) => ({
        ...p,
        requirementCount: usageCounts.get(p.id.toLowerCase()) ?? 0,
      }))
      return res.json({ success: true, data: withCounts })
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
      enumValues,
      dimensions,
      sourceFunctionId,
      parameterId: parameterIdFromBody,
    } = body

    const parameter = await prisma.parameter.findUnique({ where: { id } })
    if (!parameter) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    const updateData: Record<string, unknown> = {}
    if (parameterIdFromBody !== undefined) {
      const pid = (parameterIdFromBody as string)?.trim() || null
      if (pid && pid !== parameter.parameterId) {
        const existing = await prisma.parameter.findFirst({
          where: { projectId: parameter.projectId, parameterId: pid },
        })
        if (existing) {
          return res.status(400).json({
            success: false,
            error: `Another parameter in this project already has ID "${pid}"`,
          })
        }
        updateData.parameterId = pid
      } else if (pid === '' || pid === null) {
        updateData.parameterId = null
      }
    }
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
    if (enumValues !== undefined) updateData.enumValues = enumValues === '' ? null : enumValues
    if (dimensions !== undefined) updateData.dimensions = dimensions === '' ? null : dimensions
    if (sourceFunctionId !== undefined) updateData.sourceFunctionId = sourceFunctionId === '' ? null : sourceFunctionId
    if (name !== undefined) updateData.name = name

    // Auto-increment minor version whenever a substantive field changes,
    // regardless of status (draft, approved, or obsolete).
    // Metadata-only changes (tags, folder, ownerType, status, etc.) do NOT bump.
    const substantiveChange = Object.keys(updateData).some(k => VERSION_BUMP_FIELDS.has(k))
    if (substantiveChange) {
      updateData.version = incrementMinorVersion(parameter.version)
    }

    const updatedParameter = await prisma.parameter.update({
      where: { id },
      data: updateData,
      include: {
        sourceFunction: { select: { id: true, functionId: true, name: true } },
        sourceParameter: { select: { id: true, name: true } },
      },
    })

    const snapshot = buildParameterVersionSnapshot(updatedParameter)
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
        createdById: req.userId ?? undefined,
      },
    })

    const placeholder = `{{param:${id}}}`
    const requirementCount = await prisma.requirement.count({
      where: {
        projectId: updatedParameter.projectId,
        deletedAt: null,
        OR: [
          { title: { contains: placeholder } },
          { description: { contains: placeholder } },
        ],
      },
    })

    res.json({ success: true, data: updatedParameter, requirementCount })
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
      enumValues,
      dimensions,
      sourceFunctionId,
      parameterId: providedParameterId,
    } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Parameter name is required' })
    }

    let parameterId: string | null = (providedParameterId as string)?.trim() || null
    if (!parameterId) {
      parameterId = await generateParameterId(projectId)
    } else {
      const existing = await prisma.parameter.findFirst({
        where: { projectId, parameterId },
      })
      if (existing) {
        return res.status(400).json({
          success: false,
          error: `A parameter with ID "${parameterId}" already exists in this project`,
        })
      }
    }

    const parameter = await prisma.parameter.create({
      data: {
        projectId,
        parameterId,
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
        enumValues: (enumValues as string)?.trim() || null,
        dimensions: (dimensions as string)?.trim() || null,
        sourceFunctionId: (sourceFunctionId as string) || null,
      },
      include: {
        sourceFunction: { select: { id: true, functionId: true, name: true } },
        sourceParameter: { select: { id: true, name: true } },
      },
    })

    const snapshot = buildParameterVersionSnapshot(parameter)
    await prisma.parameterVersion.create({
      data: {
        parameterId: parameter.id,
        version: 1,
        snapshot: snapshot as object,
        createdById: req.userId ?? undefined,
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
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
      },
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

// ---------------------------------------------------------------------------
// Export parameters — GET /:projectId/export/:format
// ---------------------------------------------------------------------------
export async function exportParametersHandler(req: AuthRequest, res: Response) {
  try {
    const { projectId, format } = req.params

    if (!SUPPORTED_EXPORT_FORMATS.includes(format as typeof SUPPORTED_EXPORT_FORMATS[number])) {
      return res.status(400).json({
        success: false,
        error: `Unsupported format "${format}". Supported: ${SUPPORTED_EXPORT_FORMATS.join(', ')}`,
      })
    }

    const dbParams = await prisma.parameter.findMany({
      where: { projectId },
      orderBy: [{ parameterId: 'asc' }, { name: 'asc' }],
    })

    const params: ExportParameter[] = dbParams.map(p => ({
      parameterId: p.parameterId,
      name: p.name,
      description: p.description,
      dataType: p.dataType,
      defaultValue: p.defaultValue,
      unit: p.unit,
      tolerance: p.tolerance,
      minValue: p.minValue,
      maxValue: p.maxValue,
      status: p.status,
      version: p.version,
      tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
      formula: p.formula,
    }))

    const meta = getExportMeta(format)
    const content = formatExport(format, params)
    res.setHeader('Content-Type', meta.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${meta.filename}"`)
    res.send(content)
  } catch (error) {
    console.error('Export parameters error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ---------------------------------------------------------------------------
// Import parameters — POST /:projectId/import
// Body: { format?: string, filename?: string, content: string }
// ---------------------------------------------------------------------------
export async function importParametersHandler(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const { format, filename, content } = req.body as {
      format?: string
      filename?: string
      content: string
    }

    if (!content) {
      return res.status(400).json({ success: false, error: 'Missing "content" in request body' })
    }

    const resolvedFormat = format ?? (filename ? detectFormat(filename, content) : null)
    if (!resolvedFormat) {
      return res.status(400).json({
        success: false,
        error: 'Could not detect format. Provide "format" (csv | json | c_header | matlab)',
      })
    }

    const { parsed, warnings } = parseImport(resolvedFormat, content)

    if (parsed.length === 0) {
      return res.status(422).json({ success: false, error: 'No parameters found in file', warnings })
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (const p of parsed) {
      try {
        const existing = await prisma.parameter.findFirst({
          where: { projectId, name: p.name },
        })

        if (existing) {
          // Update only fields that differ
          const updatePayload: Record<string, unknown> = {
            description:  p.description  ?? existing.description,
            dataType:     p.dataType     ?? existing.dataType,
            defaultValue: p.defaultValue ?? existing.defaultValue,
            unit:         p.unit         ?? existing.unit,
            tolerance:    p.tolerance    ?? existing.tolerance,
            minValue:     p.minValue     ?? existing.minValue,
            maxValue:     p.maxValue     ?? existing.maxValue,
            formula:      p.formula      ?? existing.formula,
          }
          if (p.tags) updatePayload.tags = p.tags
          await prisma.parameter.update({
            where: { id: existing.id },
            data: updatePayload,
          })
          skipped++ // counted as "updated"
        } else {
          const newParameterId = await generateParameterId(projectId)
          await prisma.parameter.create({
            data: {
              projectId,
              parameterId: newParameterId,
              name: p.name,
              description:  p.description,
              dataType:     p.dataType,
              defaultValue: p.defaultValue,
              unit:         p.unit,
              tolerance:    p.tolerance,
              minValue:     p.minValue,
              maxValue:     p.maxValue,
              formula:      p.formula,
              tags:         p.tags ?? [],
              status:       'draft',
            },
          })
          imported++
        }
      } catch (err) {
        errors.push(`"${p.name}": ${(err as Error).message}`)
      }
    }

    res.json({
      success: true,
      data: { imported, updated: skipped, errors, warnings },
      message: `Import complete: ${imported} created, ${skipped} updated${errors.length ? `, ${errors.length} errors` : ''}`,
    })
  } catch (error) {
    console.error('Import parameters error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type GitPlatform = 'gitlab' | 'github' | 'bitbucket' | 'azuredevops'

function mapDbParams(dbParams: Awaited<ReturnType<typeof prisma.parameter.findMany>>): ExportParameter[] {
  return dbParams.map(p => ({
    parameterId: p.parameterId, name: p.name, description: p.description,
    dataType: p.dataType, defaultValue: p.defaultValue, unit: p.unit,
    tolerance: p.tolerance, minValue: p.minValue, maxValue: p.maxValue,
    status: p.status, version: p.version,
    tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
    formula: p.formula,
  }))
}

// ---------------------------------------------------------------------------
// Git Token Validation — POST /:projectId/git/validate-token
// Verifies credentials against the platform API and returns the username.
// ---------------------------------------------------------------------------
export async function gitValidateTokenHandler(req: AuthRequest, res: Response) {
  try {
    const { platform, baseUrl, token, username, org, project } = req.body as {
      platform: GitPlatform
      baseUrl: string
      token: string
      username?: string
      org?: string
      project?: string
    }

    if (!platform || !baseUrl || !token) {
      return res.status(400).json({ success: false, error: 'platform, baseUrl, and token are required' })
    }

    let result: { valid: boolean; username?: string; error?: string }

    switch (platform) {
      case 'gitlab':
        result = await validateGitLabToken({ baseUrl, token })
        break
      case 'github':
        result = await validateGitHubToken({ baseUrl, token })
        break
      case 'bitbucket':
        if (!username) return res.status(400).json({ success: false, error: 'username is required for Bitbucket' })
        result = await validateBitbucketToken({ baseUrl, username, appPassword: token })
        break
      case 'azuredevops':
        if (!org || !project) return res.status(400).json({ success: false, error: 'org and project are required for Azure DevOps' })
        result = await validateAzureToken({ baseUrl, token, org, project })
        break
      default:
        return res.status(400).json({ success: false, error: `Unknown platform: ${platform}` })
    }

    if (result.valid) {
      res.json({ success: true, data: { valid: true, username: result.username } })
    } else {
      res.status(401).json({ success: false, error: result.error ?? 'Invalid token' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

// ---------------------------------------------------------------------------
// Git Publish Setup — POST /:projectId/git/setup
// Creates a new repository on the specified platform and pushes selected formats.
// ---------------------------------------------------------------------------
export async function gitPublishSetupHandler(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const {
      platform, baseUrl, token, repoName, description, visibility,
      // GitLab extras
      namespaceId,
      // Bitbucket extras
      username, workspace,
      // Azure DevOps extras
      org, project,
      // Format selection
      selectedFormats,
      // Tag filtering
      selectedTags,
    } = req.body as {
      platform: GitPlatform
      baseUrl: string
      token: string
      repoName: string
      description?: string
      visibility?: 'private' | 'internal' | 'public'
      namespaceId?: number
      username?: string
      workspace?: string
      org?: string
      project?: string
      selectedFormats?: string[]
      selectedTags?: string[]
    }

    if (!platform || !baseUrl || !token || !repoName) {
      return res.status(400).json({ success: false, error: 'platform, baseUrl, token and repoName are required' })
    }

    const dbParams = await prisma.parameter.findMany({ where: { projectId }, orderBy: { name: 'asc' } })
    const allParams = mapDbParams(dbParams)
    const params = selectedTags?.length
      ? allParams.filter(p => p.tags?.some(t => selectedTags.includes(t)))
      : allParams

    const projectRecord = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true } })
    const projectDesc = description ?? `Engineering parameter set for ${projectRecord?.name ?? projectId}`
    const formats = selectedFormats ?? SUPPORTED_EXPORT_FORMATS as unknown as string[]

    let repoId: string | number = ''
    let repoUrl = ''
    let httpUrl = ''
    let sshUrl = ''
    let defaultBranch = 'main'
    let commitSha = ''
    let pushedAt = ''
    let instructions: { https: string; ssh: string; updateCmd: string }

    switch (platform) {
      case 'gitlab': {
        const config: GitLabConfig = { baseUrl, token }
        const repo = await createGitLabRepo(config, {
          name: repoName,
          description: projectDesc,
          visibility,
          namespaceId,
        })
        const push = await pushAllFormatsGitLab(config, repo.id, params, defaultBranch, undefined, formats)
        repoId = repo.id; repoUrl = repo.webUrl; httpUrl = repo.httpUrl; sshUrl = repo.sshUrl
        defaultBranch = repo.defaultBranch; commitSha = push.commitSha; pushedAt = push.pushedAt
        instructions = genInstructionsGitLab(repo)
        await protectGitLabBranch(config, repo.id, repo.defaultBranch)
        break
      }
      case 'github': {
        const config = { baseUrl, token }
        const repo = await createGitHubRepo(config, { name: repoName, description: projectDesc, isPrivate: visibility !== 'public' })
        const push = await pushAllFormatsGitHub(config, repo, params, formats, repo.defaultBranch)
        repoId = `${repo.owner}/${repo.name}`; repoUrl = repo.webUrl; httpUrl = repo.httpUrl; sshUrl = repo.sshUrl
        defaultBranch = repo.defaultBranch; commitSha = push.commitSha; pushedAt = push.pushedAt
        instructions = generateSubmoduleInstructionsGitHub(repo)
        await protectGitHubBranch(config, repo.owner, repo.name, repo.defaultBranch)
        break
      }
      case 'bitbucket': {
        if (!username || !workspace) {
          return res.status(400).json({ success: false, error: 'username and workspace are required for Bitbucket' })
        }
        const config: BitbucketConfig = { baseUrl, username, appPassword: token }
        const repo = await createBitbucketRepo(config, { workspace, slug: repoName, description: projectDesc, isPrivate: visibility !== 'public' })
        const push = await pushAllFormatsBitbucket(config, repo, params, formats)
        repoId = repo.fullName; repoUrl = repo.webUrl; httpUrl = repo.httpUrl; sshUrl = repo.sshUrl
        defaultBranch = repo.defaultBranch; commitSha = push.commitSha; pushedAt = push.pushedAt
        instructions = generateSubmoduleInstructionsBitbucket(repo)
        await protectBitbucketBranch(config, workspace, repoName, repo.defaultBranch)
        break
      }
      case 'azuredevops': {
        if (!org || !project) {
          return res.status(400).json({ success: false, error: 'org and project are required for Azure DevOps' })
        }
        const config: AzureDevOpsConfig = { baseUrl, token, org, project }
        const repo = await createAzureRepo(config, { name: repoName })
        const push = await pushAllFormatsAzure(config, repo.id, repo.defaultBranch, params, formats)
        repoId = repo.id; repoUrl = repo.webUrl; httpUrl = repo.httpUrl; sshUrl = repo.sshUrl
        defaultBranch = repo.defaultBranch; commitSha = push.commitSha; pushedAt = push.pushedAt
        instructions = generateSubmoduleInstructionsAzure(repo)
        await protectAzureBranch(config, project, repo.id, repo.defaultBranch)
        break
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown platform: ${platform}` })
    }

    res.json({
      success: true,
      data: {
        platform,
        repoId: String(repoId),
        repoUrl,
        httpUrl,
        sshUrl,
        defaultBranch,
        commitSha,
        pushedAt,
        parameterCount: params.length,
        selectedFormats: formats,
        instructions,
      },
      message: `Repository created on ${platform} with ${params.length} parameters in ${formats.length} formats`,
    })
  } catch (error) {
    console.error('Git publish setup error:', error)
    res.status(500).json({ success: false, error: (error as Error).message ?? 'Internal server error' })
  }
}

// ---------------------------------------------------------------------------
// Git Publish Sync — POST /:projectId/git/sync
// Pushes latest parameters to an existing repository.
// ---------------------------------------------------------------------------
export async function gitPublishSyncHandler(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const {
      platform, baseUrl, token, repoId, branch, selectedFormats, selectedTags,
      // Platform-specific
      username, workspace, org, project,
    } = req.body as {
      platform: GitPlatform
      baseUrl: string
      token: string
      repoId: string
      branch?: string
      selectedFormats?: string[]
      selectedTags?: string[]
      username?: string
      workspace?: string
      org?: string
      project?: string
    }

    if (!platform || !baseUrl || !token || !repoId) {
      return res.status(400).json({ success: false, error: 'platform, baseUrl, token and repoId are required' })
    }

    const dbParams = await prisma.parameter.findMany({ where: { projectId }, orderBy: { name: 'asc' } })
    const allParams = mapDbParams(dbParams)
    const params = selectedTags?.length
      ? allParams.filter(p => p.tags?.some(t => selectedTags.includes(t)))
      : allParams
    const formats = selectedFormats ?? SUPPORTED_EXPORT_FORMATS as unknown as string[]

    let commitSha = ''
    let pushedAt = ''

    switch (platform) {
      case 'gitlab': {
        const numericId = parseInt(repoId, 10)
        const config: GitLabConfig = { baseUrl, token }
        const targetBranch = branch ?? 'main'
        // Temporarily lift branch protection so the tool can push, then re-protect
        await unprotectGitLabBranch(config, numericId, targetBranch)
        const push = await pushAllFormatsGitLab(config, numericId, params, targetBranch, undefined, formats)
        await protectGitLabBranch(config, numericId, targetBranch)
        commitSha = push.commitSha; pushedAt = push.pushedAt
        break
      }
      case 'github': {
        // repoId is "owner/repo"
        const [owner, repoName] = repoId.split('/')
        const config = { baseUrl, token }
        // Get repo info to pass to push
        const repoInfo = await getRepoInfoGitHub(config, owner, repoName)
        const push = await pushAllFormatsGitHub(config, repoInfo, params, formats, branch ?? repoInfo.defaultBranch)
        commitSha = push.commitSha; pushedAt = push.pushedAt
        break
      }
      case 'bitbucket': {
        if (!username || !workspace) {
          return res.status(400).json({ success: false, error: 'username and workspace are required for Bitbucket' })
        }
        const config: BitbucketConfig = { baseUrl, username, appPassword: token }
        const repoInfo = await getRepoInfoBitbucket(config, workspace, repoId)
        const push = await pushAllFormatsBitbucket(config, repoInfo, params, formats)
        commitSha = push.commitSha; pushedAt = push.pushedAt
        break
      }
      case 'azuredevops': {
        if (!org || !project) {
          return res.status(400).json({ success: false, error: 'org and project are required for Azure DevOps' })
        }
        const config: AzureDevOpsConfig = { baseUrl, token, org, project }
        const repoInfo = await getRepoInfoAzure(config, repoId)
        const push = await pushAllFormatsAzure(config, repoId, repoInfo.defaultBranch, params, formats, branch)
        commitSha = push.commitSha; pushedAt = push.pushedAt
        break
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown platform: ${platform}` })
    }

    res.json({
      success: true,
      data: { commitSha, pushedAt, parameterCount: params.length },
      message: `${params.length} parameters synced to ${platform}`,
    })
  } catch (error) {
    console.error('Git publish sync error:', error)
    res.status(500).json({ success: false, error: (error as Error).message ?? 'Internal server error' })
  }
}

// ---------------------------------------------------------------------------
// Git Publish Status — GET /:projectId/git/status
// Query: platform, baseUrl, token, repoId, branch?, username?, workspace?, org?, project?
// ---------------------------------------------------------------------------
export async function gitPublishStatusHandler(req: AuthRequest, res: Response) {
  try {
    const {
      platform, baseUrl, token, repoId, branch,
      username, workspace, org, project,
    } = req.query as Record<string, string>

    if (!platform || !baseUrl || !token || !repoId) {
      return res.status(400).json({ success: false, error: 'platform, baseUrl, token and repoId are required' })
    }

    let latestCommit: { sha: string; createdAt: string; message: string; webUrl: string }
    let repoInfo: { name: string; webUrl: string; httpUrl: string; sshUrl: string }

    switch (platform as GitPlatform) {
      case 'gitlab': {
        const numericId = parseInt(repoId, 10)
        const config: GitLabConfig = { baseUrl, token }
        const [commit, info] = await Promise.all([
          getLatestCommitGitLab(config, numericId, branch ?? 'main'),
          getRepoInfoGitLab(config, numericId),
        ])
        latestCommit = commit; repoInfo = info
        break
      }
      case 'github': {
        const [owner, repoName] = repoId.split('/')
        const config = { baseUrl, token }
        const [commit, info] = await Promise.all([
          getLatestCommitGitHub(config, owner, repoName, branch ?? 'main'),
          getRepoInfoGitHub(config, owner, repoName),
        ])
        latestCommit = commit; repoInfo = info
        break
      }
      case 'bitbucket': {
        if (!username || !workspace) {
          return res.status(400).json({ success: false, error: 'username and workspace are required' })
        }
        const config: BitbucketConfig = { baseUrl, username, appPassword: token }
        const [commit, info] = await Promise.all([
          getLatestCommitBitbucket(config, workspace, repoId),
          getRepoInfoBitbucket(config, workspace, repoId),
        ])
        latestCommit = commit; repoInfo = info
        break
      }
      case 'azuredevops': {
        if (!org || !project) {
          return res.status(400).json({ success: false, error: 'org and project are required' })
        }
        const config: AzureDevOpsConfig = { baseUrl, token, org, project }
        const [commit, info] = await Promise.all([
          getLatestCommitAzure(config, repoId, branch ?? 'main'),
          getRepoInfoAzure(config, repoId),
        ])
        latestCommit = commit; repoInfo = info
        break
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown platform: ${platform}` })
    }

    res.json({ success: true, data: { latestCommit, repoInfo } })
  } catch (error) {
    console.error('Git publish status error:', error)
    res.status(500).json({ success: false, error: (error as Error).message ?? 'Internal server error' })
  }
}
