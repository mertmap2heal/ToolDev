import { Prisma } from '@prisma/client'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { prisma } from '../lib/prisma'
import { allocateParameterId } from '../lib/paramId'
import {
  exportParameters as formatExport,
  exportParametersBinary,
  getExportMeta,
  SUPPORTED_EXPORT_FORMATS,
  BINARY_EXPORT_FORMATS,
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
  fetchFileFromGitLab,
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
  fetchFileFromGitHub,
} from '../services/github.service'
import {
  createBitbucketRepo,
  pushAllFormatsBitbucket,
  getLatestCommitBitbucket,
  getRepoInfoBitbucket,
  generateSubmoduleInstructionsBitbucket,
  validateBitbucketToken,
  protectBitbucketBranch,
  fetchFileFromBitbucket,
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
  fetchFileFromAzure,
  AzureDevOpsConfig,
} from '../services/azuredevops.service'


// ---------------------------------------------------------------------------
// SSRF protection — validateBaseUrl (#75)
// Called before every outbound HTTP request in git publish endpoints.
// ---------------------------------------------------------------------------

/**
 * Known public-cloud git platform URL prefixes that are always allowed.
 * Self-hosted instances pass allowCustom=true and get private-IP blocking instead.
 */
const KNOWN_GIT_HOSTS = [
  'https://gitlab.com',
  'https://api.github.com',
  'https://github.com',
  'https://bitbucket.org',
  'https://dev.azure.com',
  'https://visualstudio.com',
]

/**
 * Regex that matches private/loopback/link-local IP ranges and reserved hostnames
 * that should never be reachable from a server-side HTTP request in production.
 */
const PRIVATE_HOST_RE =
  /^(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|::1|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|192\.168\.\d+\.\d+|169\.254\.\d+\.\d+)/i

/**
 * Validate that a baseUrl is safe to use as an outbound HTTP target.
 *
 * Rules:
 *   1. Must parse as a valid URL.
 *   2. Protocol must be https: (not http:, file:, etc.).
 *   3. For well-known public platforms the URL must start with a known prefix.
 *   4. For self-hosted / custom instances (allowCustom=true) only the private-IP
 *      blocklist is applied — the URL does not need to match a known host.
 *
 * Throws an Error with a human-readable message on validation failure.
 */
function validateBaseUrl(baseUrl: string, allowCustom = false): void {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error(`Invalid baseUrl: "${baseUrl}" is not a valid URL`)
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`baseUrl must use HTTPS (got "${parsed.protocol}")`)
  }

  if (allowCustom) {
    // Self-hosted: block private/loopback/metadata addresses
    if (PRIVATE_HOST_RE.test(parsed.hostname)) {
      throw new Error(`baseUrl hostname "${parsed.hostname}" is a private or reserved address`)
    }
  } else {
    // Public cloud: must start with a known host prefix
    const isKnown = KNOWN_GIT_HOSTS.some((h) => baseUrl.startsWith(h))
    if (!isKnown) {
      throw new Error(
        `baseUrl "${parsed.hostname}" is not in the list of allowed git platforms. ` +
        `For self-hosted instances contact your administrator.`
      )
    }
  }
}

/**
 * Allocates the next PARAM-NNN identifier for a project.
 *
 * Uses a per-project Postgres advisory lock so concurrent creates cannot
 * read the same maximum and generate duplicate IDs.  Also avoids a full
 * table scan: the new implementation is O(log N) instead of O(N).
 *
 * @param tx  Optional transaction client.  When provided, the allocation joins
 *            the caller's transaction (advisory lock released at commit time).
 *            When omitted, a new transaction is opened automatically.
 */
async function generateParameterId(
  projectId: string,
  tx?: Prisma.TransactionClient
): Promise<string> {
  if (tx) {
    return allocateParameterId(tx, projectId)
  }
  return prisma.$transaction((inner) => allocateParameterId(inner, projectId))
}

function buildParameterWhere(
  projectId: string,
  query: Record<string, string | undefined>,
  opts: { hasItarAccess?: boolean; requestedAuthorType?: string } = {},
) {
  const where: Record<string, unknown> = { projectId }

  // ITAR filter (plan §2.1 item 18). Classification=itar rows are
  // invisible to users who lack ITAR access. The MCP server already
  // enforces this server-side; this layer does it for the REST API.
  // Intentionally silent (not a 403) so users without clearance are
  // not given a side-channel signal that the row exists.
  if (!opts.hasItarAccess) {
    where.classification = { not: 'itar' }
  }

  // authorType filter (plan §2.1 / AI provenance). Allows the UI to
  // ship a "recently AI-modified" saved view by passing e.g.
  //   authorType=ai_suggestion,ai_accepted,ai_applied
  if (opts.requestedAuthorType) {
    const parts = opts.requestedAuthorType.split(',').map((v) => v.trim()).filter(Boolean)
    if (parts.length > 0) {
      where.authorType = parts.length === 1 ? parts[0] : { in: parts }
    }
  }
  // Free-text search (alias: `q`). Searches name + description + dataType
  // with case-insensitive substring. Aerospace-scale projects should
  // prefer the paged endpoint with this filter so the network payload
  // stays small.
  const searchText = query.q ?? query.search
  if (searchText) {
    const s = searchText.trim()
    if (s) {
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { dataType: { contains: s, mode: 'insensitive' } },
      ]
    }
  }

  // Multi-value filters. Accept either `status=approved` or
  // `status=approved,draft` (comma-separated). Likewise dataType / unit.
  const parseMulti = (raw: string | undefined): string[] | null => {
    if (!raw) return null
    const parts = raw.split(',').map((v) => v.trim()).filter(Boolean)
    return parts.length > 0 ? parts : null
  }
  const statuses = parseMulti(query.status)
  if (statuses) where.status = statuses.length === 1 ? statuses[0] : { in: statuses }
  const dataTypes = parseMulti(query.dataType)
  if (dataTypes) where.dataType = dataTypes.length === 1 ? dataTypes[0] : { in: dataTypes }
  const units = parseMulti(query.unit)
  if (units) where.unit = units.length === 1 ? units[0] : { in: units }

  if (query.ownerType) where.ownerType = query.ownerType
  if (query.folderId !== undefined && query.folderId !== '') {
    if (query.folderId === '__none__') where.folderId = null
    else where.folderId = query.folderId
  }

  // hasFormula as a tri-state: "true" => must have formula, "false" =>
  // must not, anything else => no constraint.
  if (query.hasFormula === 'true') where.formula = { not: null }
  else if (query.hasFormula === 'false') where.formula = null

  return where
}

/**
 * Increment the MINOR part of a version string. "1.0" -> "1.1", "1.999" -> "1.1000".
 * Used for all non-approval changes (draft edits, imports).
 */
function incrementMinorVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)$/)
  if (match) return `${match[1]}.${parseInt(match[2], 10) + 1}`
  const intMatch = version.match(/^(\d+)$/)
  if (intMatch) return `${parseInt(intMatch[1], 10)}.1`
  return `${version}.1`
}

/**
 * Increment the MAJOR part of a version string and reset minor to 0.
 * "1.2" -> "2.0", "1.0" -> "2.0". Used when a parameter is approved.
 */
function incrementMajorVersion(version: string): string {
  const match = version.match(/^(\d+)/)
  const major = match ? parseInt(match[1], 10) : 1
  return `${major + 1}.0`
}

/** Extract major and minor integers from a version string like "1.2". */
function parseVersionParts(version: string): { major: number; minor: number } {
  const match = version.match(/^(\d+)\.(\d+)$/)
  if (match) return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10) }
  const intMatch = version.match(/^(\d+)$/)
  if (intMatch) return { major: parseInt(intMatch[1], 10), minor: 0 }
  return { major: 1, minor: 0 }
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
    const q = req.query as Record<string, string>
    const {
      q: qSearch,
      search,
      status,
      dataType,
      unit,
      ownerType,
      folderId,
      hasFormula,
      tags,
      authorType,
      sort = 'updatedAt',
      order = 'desc',
      includeUsageCounts,
    } = q

    // Role-gated ITAR access. Fine-grained per-project scope lands in a
    // follow-up; for now SUPERIOR_ADMIN + COMPANY_ADMIN see classified
    // rows so regulated customers have at least one access path while
    // the explicit scope feature is built. The JWT only carries userId
    // so we fetch the role per request (one extra query - acceptable
    // because list is idempotent and the read is cached by Postgres).
    const userId = req.user?.userId ?? req.user?.id
    const userRoleRow = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
      : null
    const hasItarAccess =
      userRoleRow?.role === 'SUPERIOR_ADMIN' || userRoleRow?.role === 'COMPANY_ADMIN'

    // Pagination — opt-in. Existing callers that pass no `page` param
    // get the legacy unbounded response so nothing breaks. New callers
    // supply `page` + `pageSize` and receive the paged wrapper.
    const rawPage = q.page != null ? parseInt(q.page, 10) : NaN
    const rawPageSize = q.pageSize != null ? parseInt(q.pageSize, 10) : NaN
    const paginated = Number.isFinite(rawPage) && rawPage >= 1
    const page = paginated ? rawPage : 1
    const pageSize = paginated
      ? Math.max(1, Math.min(Number.isFinite(rawPageSize) ? rawPageSize : 50, 500))
      : undefined

    const where = buildParameterWhere(
      projectId,
      {
        q: qSearch,
        search,
        status,
        dataType,
        unit,
        ownerType,
        folderId,
        hasFormula,
        tags,
      },
      { hasItarAccess, requestedAuthorType: authorType },
    )

    // Prisma does not support array_contains on Json, so tag filtering
    // still runs in memory after the query. When paginating, the count
    // becomes approximate if tags filter is active -- acceptable because
    // tags are rarely used as the primary filter.
    const orderField = sort === 'name' ? 'name' : sort === 'createdAt' ? 'createdAt' : 'updatedAt'
    const orderDir = order === 'asc' ? 'asc' : 'desc'

    const effectiveWhere = Object.keys(where).length > 1 ? where : { projectId }
    const include = {
      sourceFunction: { select: { id: true, functionId: true, name: true } },
      sourceParameter: { select: { id: true, name: true } },
    } as const
    // Stable secondary sort by id so paged responses never put the
    // same row on two adjacent pages when many rows share the primary
    // sort key (e.g. bulk-seeded rows with identical updatedAt).
    const orderBy = [
      { [orderField]: orderDir },
      { id: 'asc' },
    ] as unknown as Record<string, 'asc' | 'desc'>[]

    const [parameters, total] = paginated && pageSize !== undefined
      ? await Promise.all([
          prisma.parameter.findMany({
            where: effectiveWhere,
            include,
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.parameter.count({ where: effectiveWhere }),
        ])
      : [
          await prisma.parameter.findMany({
            where: effectiveWhere,
            include,
            orderBy,
          }),
          0,
        ]

    let filtered = parameters
    if (tags) {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean)
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
      filtered = filtered.map((p) => ({
        ...p,
        requirementCount: usageCounts.get(p.id.toLowerCase()) ?? 0,
      }))
    }

    if (paginated) {
      return res.json({
        success: true,
        data: filtered,
        total,
        page,
        pageSize,
      })
    }
    return res.json({ success: true, data: filtered })
  } catch (error) {
    console.error('Get parameters error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

/**
 * Facets endpoint — returns distinct values for the columns used as
 * filter pills. Called once on page load to populate the FilterBar.
 * Keeps the page from pulling down the full parameters list just to
 * discover which units / types / statuses exist.
 */
export const getParameterFacets = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const rows = await prisma.parameter.findMany({
      where: { projectId },
      select: { dataType: true, unit: true, status: true, tags: true },
    })
    const dataTypes = new Set<string>()
    const units = new Set<string>()
    const statuses = new Set<string>()
    const tagSet = new Set<string>()
    for (const row of rows) {
      if (row.dataType) dataTypes.add(row.dataType)
      if (row.unit) units.add(row.unit)
      if (row.status) statuses.add(row.status)
      const t = row.tags as string[] | null
      if (Array.isArray(t)) for (const tag of t) if (typeof tag === 'string' && tag) tagSet.add(tag)
    }
    res.json({
      success: true,
      data: {
        dataType: Array.from(dataTypes).sort(),
        unit: Array.from(units).sort(),
        status: Array.from(statuses).sort(),
        tag: Array.from(tagSet).sort(),
        total: rows.length,
      },
    })
  } catch (error) {
    console.error('Get parameter facets error:', error)
    res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

export const getParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const parameter = await prisma.parameter.findFirst({
      where: { id, projectId },
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
    const { projectId, id } = req.params
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
      platforms,
      sourceFunctionId,
      parameterId: parameterIdFromBody,
    } = body

    const parameter = await prisma.parameter.findFirst({ where: { id, projectId } })
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
    if (platforms !== undefined) updateData.platforms = Array.isArray(platforms) ? platforms : null
    if (sourceFunctionId !== undefined) updateData.sourceFunctionId = sourceFunctionId === '' ? null : sourceFunctionId
    if (name !== undefined) updateData.name = name

    // Version bump logic:
    // - Approving (status -> approved): bump MAJOR, reset minor -> "2.0"
    // - Any other substantive change: bump MINOR only -> "1.1", "1.2"
    const substantiveChange = Object.keys(updateData).some(k => VERSION_BUMP_FIELDS.has(k))
    const isApproving = status === 'approved' && parameter.status !== 'approved'
    if (isApproving) {
      updateData.version = incrementMajorVersion(parameter.version)
    } else if (substantiveChange) {
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
      select: { version: true, minorVersion: true },
    })
    const { major: newMajor, minor: newMinor } = parseVersionParts(updatedParameter.version)
    await prisma.parameterVersion.create({
      data: {
        parameterId: id,
        version: newMajor,
        minorVersion: newMinor,
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
      platforms,
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
        platforms: Array.isArray(platforms) ? (platforms as Prisma.InputJsonValue) : Prisma.DbNull,
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
        minorVersion: 0,
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

export const bulkDeleteParameters = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params
    const { ids } = req.body as { ids: string[] }

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: 'ids (array) is required' })
    }

    await prisma.parameter.deleteMany({ where: { id: { in: ids }, projectId } })
    res.json({ success: true, message: `${ids.length} parameters deleted` })
  } catch (error) {
    console.error('Bulk delete parameters error:', error)
    res.status(500).json({ success: false, error: (error as Error).message })
  }
}

export const deleteParameter = async (req: AuthRequest, res: Response) => {
  try {
    const { projectId, id } = req.params

    const parameter = await prisma.parameter.findFirst({
      where: { id, projectId },
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
    const isBinary = (BINARY_EXPORT_FORMATS as readonly string[]).includes(format)
    const content = isBinary
      ? await exportParametersBinary(format, params)
      : formatExport(format, params)
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

    // -------------------------------------------------------------------------
    // Resolve bare parameter-name references in formulas to {{param:ID}} syntax.
    // e.g.  "base_mass * 9.81"  →  "{{param:abc123}} * 9.81"
    // This makes formulas portable and evaluable after import.
    // -------------------------------------------------------------------------
    const hasFormulaWithNames = parsed.some(p => {
      if (!p.formula) return false
      // Check if the formula contains any word character sequences (bare names)
      // that are NOT already in {{param:ID}} format
      return /\b[a-zA-Z_][a-zA-Z0-9_]*\b/.test(p.formula.replace(/\{\{param:[^}]+\}\}/g, ''))
    })
    if (hasFormulaWithNames) {
      // Fetch all project parameters for name→id resolution
      const allProjectParams = await prisma.parameter.findMany({
        where: { projectId },
        select: { id: true, name: true },
      })
      // Also include params being imported (synthetic IDs for forward refs within batch)
      const nameToId = new Map<string, string>()
      for (const ep of allProjectParams) nameToId.set(ep.name, ep.id)
      // Imported params that don't exist yet use synthetic IDs (will be resolved post-create)
      // We leave those for now — only resolve against existing params in this pass

      for (const p of parsed) {
        if (!p.formula) continue
        // Sort names by descending length to avoid partial matches
        const sortedNames = [...nameToId.keys()].sort((a, b) => b.length - a.length)
        let formula = p.formula
        for (const name of sortedNames) {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          // Only replace bare identifiers (not inside {{param:...}} already)
          formula = formula.replace(
            new RegExp(`(?<!\\{\\{param:[^}]*)\\b${escaped}\\b`, 'g'),
            `{{param:${nameToId.get(name)}}}`
          )
        }
        p.formula = formula
      }
    }

    // Cycle detection among imported formula parameters
    const formulaParams = parsed.filter(p => p.formula)
    if (formulaParams.length > 1) {
      // Build name->id map using synthetic IDs for imported params
      const nameToId = new Map(formulaParams.map((p, i) => [p.name, `__import_${i}`]))
      // Also include existing DB params that have formulas
      const existingWithFormulas = await prisma.parameter.findMany({
        where: { projectId, formula: { not: null } },
        select: { id: true, name: true, formula: true },
      })
      // Merge: imported params override existing if same name
      const allForCycle = [
        ...existingWithFormulas
          .filter(e => !formulaParams.some(p => p.name === e.name))
          .map(e => ({ id: e.id, formula: e.formula ?? undefined })),
        ...formulaParams.map((p, i) => ({
          id: nameToId.get(p.name) ?? `__import_${i}`,
          formula: p.formula,
        })),
      ]
      // Simple DFS cycle detector (same logic as frontend evaluateFormula.ts detectCycles)
      const refRe = /\{\{param:([a-z0-9]+)\}\}/gi
      const extractRefs = (f: string) => { const ids: string[] = []; let m; const re = new RegExp(refRe.source, 'gi'); while ((m = re.exec(f))) if (!ids.includes(m[1])) ids.push(m[1]); return ids }
      const deps = new Map(allForCycle.map(p => [p.id, extractRefs(p.formula ?? '')]))
      const visited = new Set<string>(); const inStack = new Set<string>()
      const cyclesFound: string[] = []
      const dfs = (id: string, path: string[]) => {
        if (inStack.has(id)) { const loop = path.slice(path.indexOf(id)).concat(id); const label = loop.join(' → '); if (!cyclesFound.includes(label)) cyclesFound.push(label); return }
        if (visited.has(id)) return
        visited.add(id); inStack.add(id)
        for (const dep of deps.get(id) ?? []) dfs(dep, [...path, id])
        inStack.delete(id)
      }
      for (const id of deps.keys()) dfs(id, [])
      if (cyclesFound.length > 0) warnings.push(...cyclesFound.map(c => `Circular dependency detected: ${c}`))
    }

    // Wrap all writes in a single transaction so that a mid-batch failure rolls
    // back every row already processed — no partial-import state (#78).
    const { imported, updated } = await prisma.$transaction(async (tx) => {
      let imported = 0
      let skipped = 0

      for (const p of parsed) {
        const existing = await tx.parameter.findFirst({
          where: { projectId, name: p.name },
        })

        if (existing) {
          // Compute new field values
          const newDesc     = p.description  ?? existing.description
          const newType     = p.dataType     ?? existing.dataType
          const newValue    = p.defaultValue ?? existing.defaultValue
          const newUnit     = p.unit         ?? existing.unit
          const newTol      = p.tolerance    ?? existing.tolerance
          const newMin      = p.minValue     ?? existing.minValue
          const newMax      = p.maxValue     ?? existing.maxValue
          const newFormula  = p.formula      ?? existing.formula
          const newStatus   = p.status       ?? existing.status
          const newTags     = p.tags         ?? (existing.tags as string[] | null)

          // Skip if nothing changed
          const unchanged =
            newDesc    === existing.description &&
            newType    === existing.dataType &&
            newValue   === existing.defaultValue &&
            newUnit    === existing.unit &&
            newTol     === existing.tolerance &&
            newMin     === existing.minValue &&
            newMax     === existing.maxValue &&
            newFormula === existing.formula &&
            newStatus  === existing.status &&
            JSON.stringify(newTags) === JSON.stringify(existing.tags)

          if (unchanged) {
            skipped++
            continue
          }

          // CSV import is never an approval action — force draft to protect
          // the approval workflow (only authorised users should approve).
          const wasApproved = existing.status === 'approved'
          const effectiveStatus = wasApproved ? 'draft' : (newStatus ?? existing.status)

          // Compute new version string: bump minor (imports are non-approval changes)
          const newVersionStr = incrementMinorVersion(existing.version)
          const { major: newMajor, minor: newMinor } = parseVersionParts(newVersionStr)

          const updatedParameter = await tx.parameter.update({
            where: { id: existing.id },
            data: {
              description:  newDesc,
              dataType:     newType,
              defaultValue: newValue,
              unit:         newUnit,
              tolerance:    newTol,
              minValue:     newMin,
              maxValue:     newMax,
              formula:      newFormula,
              status:       effectiveStatus,
              version:      newVersionStr,
              ...(newTags != null && { tags: newTags }),
            },
          })

          // Create version record with major.minor parts
          const snapshot = buildParameterVersionSnapshot(updatedParameter)
          await tx.parameterVersion.create({
            data: {
              parameterId: existing.id,
              version: newMajor,
              minorVersion: newMinor,
              snapshot,
              createdById: req.user!.userId,
            },
          })

          skipped++ // counted as "updated"
        } else {
          const newParameterId = await generateParameterId(projectId, tx)
          const created = await tx.parameter.create({
            data: {
              projectId,
              parameterId: newParameterId,
              name:         p.name,
              description:  p.description,
              dataType:     p.dataType,
              defaultValue: p.defaultValue,
              unit:         p.unit,
              tolerance:    p.tolerance,
              minValue:     p.minValue,
              maxValue:     p.maxValue,
              formula:      p.formula,
              tags:         p.tags ?? [],
              status:       p.status ?? 'draft',
            },
          })

          // Create initial version record (1.0)
          const snapshot = buildParameterVersionSnapshot(created)
          await tx.parameterVersion.create({
            data: {
              parameterId: created.id,
              version: 1,
              minorVersion: 0,
              snapshot,
              createdById: req.user!.userId,
            },
          })

          imported++
        }
      }

      return { imported, updated: skipped }
    }, { timeout: 30_000 })

    res.json({
      success: true,
      data: { imported, updated, errors: [], warnings },
      message: `Import complete: ${imported} created, ${updated} updated`,
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

    try {
      validateBaseUrl(baseUrl, true)
    } catch (urlErr) {
      return res.status(400).json({ success: false, error: (urlErr as Error).message })
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

    try { validateBaseUrl(baseUrl, true) } catch (urlErr) {
      return res.status(400).json({ success: false, error: (urlErr as Error).message })
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

    try { validateBaseUrl(baseUrl, true) } catch (urlErr) {
      return res.status(400).json({ success: false, error: (urlErr as Error).message })
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
// Git Publish Status — POST /:projectId/git/status
// Body: platform, baseUrl, token, repoId, branch?, username?, workspace?, org?, project?
// Changed from GET to POST so the git token travels in the encrypted request
// body rather than the URL query string (which is logged by access logs).
// ---------------------------------------------------------------------------
export async function gitPublishStatusHandler(req: AuthRequest, res: Response) {
  try {
    const {
      platform, baseUrl, token, repoId, branch,
      username, workspace, org, project,
    } = req.body as Record<string, string>

    if (!platform || !baseUrl || !token || !repoId) {
      return res.status(400).json({ success: false, error: 'platform, baseUrl, token and repoId are required' })
    }

    try { validateBaseUrl(baseUrl, true) } catch (urlErr) {
      return res.status(400).json({ success: false, error: (urlErr as Error).message })
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

// ---------------------------------------------------------------------------
// Git Pull (Import from Git) -- POST /:projectId/git/pull
// Fetches a parameter file from the connected git repo and imports it.
// ---------------------------------------------------------------------------
export async function gitPullHandler(req: AuthRequest, res: Response) {
  try {
    const { projectId } = req.params
    const {
      platform, baseUrl, token, repoId, branch,
      format, filePath,
      username, workspace, org, project,
    } = req.body as {
      platform: GitPlatform
      baseUrl: string
      token: string
      repoId: string
      branch?: string
      format?: string
      filePath?: string
      username?: string
      workspace?: string
      org?: string
      project?: string
    }

    if (!platform || !baseUrl || !token || !repoId) {
      return res.status(400).json({ success: false, error: 'platform, baseUrl, token and repoId are required' })
    }

    try { validateBaseUrl(baseUrl, true) } catch (urlErr) {
      return res.status(400).json({ success: false, error: (urlErr as Error).message })
    }

    const resolvedFormat = format ?? 'json'
    const resolvedFilePath = filePath ?? 'parameters.json'
    const resolvedBranch = branch ?? 'main'

    let content: string

    switch (platform) {
      case 'gitlab': {
        const numericId = parseInt(repoId, 10)
        content = await fetchFileFromGitLab({ baseUrl, token }, numericId, resolvedFilePath, resolvedBranch)
        break
      }
      case 'github': {
        const [owner, repoName] = repoId.split('/')
        content = await fetchFileFromGitHub({ baseUrl, token }, owner, repoName, resolvedFilePath, resolvedBranch)
        break
      }
      case 'bitbucket': {
        if (!username || !workspace) {
          return res.status(400).json({ success: false, error: 'username and workspace are required for Bitbucket' })
        }
        const slug = repoId.includes('/') ? repoId.split('/')[1] : repoId
        content = await fetchFileFromBitbucket({ baseUrl, username, appPassword: token }, workspace, slug, resolvedFilePath, resolvedBranch)
        break
      }
      case 'azuredevops': {
        if (!org || !project) {
          return res.status(400).json({ success: false, error: 'org and project are required for Azure DevOps' })
        }
        content = await fetchFileFromAzure({ baseUrl, token, org, project }, repoId, resolvedFilePath, resolvedBranch)
        break
      }
      default:
        return res.status(400).json({ success: false, error: `Unknown platform: ${platform}` })
    }

    const { parsed, warnings } = parseImport(resolvedFormat, content)

    if (parsed.length === 0) {
      return res.status(422).json({ success: false, error: `No parameters found in ${resolvedFilePath}`, warnings })
    }

    const { imported, updated } = await prisma.$transaction(async (tx) => {
      let imported = 0
      let updated = 0

      for (const p of parsed) {
        const existing = await tx.parameter.findFirst({ where: { projectId, name: p.name } })
        if (existing) {
          const newVersionStr = incrementMinorVersion(existing.version)
          const { major: maj, minor: min } = parseVersionParts(newVersionStr)
          const up = await tx.parameter.update({
            where: { id: existing.id },
            data: {
              description:  p.description  ?? existing.description,
              dataType:     p.dataType     ?? existing.dataType,
              defaultValue: p.defaultValue ?? existing.defaultValue,
              unit:         p.unit         ?? existing.unit,
              tolerance:    p.tolerance    ?? existing.tolerance,
              minValue:     p.minValue     ?? existing.minValue,
              maxValue:     p.maxValue     ?? existing.maxValue,
              formula:      p.formula      ?? existing.formula,
              status:       existing.status === 'approved' ? 'draft' : (p.status ?? existing.status),
              version:      newVersionStr,
              ...(p.tags != null && { tags: p.tags }),
            },
          })
          await tx.parameterVersion.create({
            data: {
              parameterId: existing.id,
              version: maj,
              minorVersion: min,
              snapshot: buildParameterVersionSnapshot(up) as object,
              createdById: req.user!.userId,
            },
          })
          updated++
        } else {
          const newParameterId = await generateParameterId(projectId, tx)
          const created = await tx.parameter.create({
            data: {
              projectId,
              parameterId: newParameterId,
              name: p.name,
              description: p.description,
              dataType: p.dataType,
              defaultValue: p.defaultValue,
              unit: p.unit,
              tolerance: p.tolerance,
              minValue: p.minValue,
              maxValue: p.maxValue,
              formula: p.formula,
              tags: p.tags ?? [],
              status: p.status ?? 'draft',
            },
          })
          await tx.parameterVersion.create({
            data: {
              parameterId: created.id,
              version: 1,
              minorVersion: 0,
              snapshot: buildParameterVersionSnapshot(created) as object,
              createdById: req.user!.userId,
            },
          })
          imported++
        }
      }

      return { imported, updated }
    }, { timeout: 30_000 })

    res.json({
      success: true,
      data: { imported, updated, errors: [], warnings, filePath: resolvedFilePath, format: resolvedFormat },
      message: `Pull complete: ${imported} created, ${updated} updated from ${platform}`,
    })
  } catch (error) {
    console.error('Git pull error:', error)
    res.status(500).json({ success: false, error: (error as Error).message ?? 'Internal server error' })
  }
}

// ---------------------------------------------------------------------------
// Restore Parameter to a previous version -- POST /:projectId/:id/restore/:versionId
// ---------------------------------------------------------------------------
export async function restoreParameterVersionHandler(req: AuthRequest, res: Response) {
  try {
    const { projectId, id, versionId } = req.params

    const parameter = await prisma.parameter.findFirst({ where: { id, projectId } })
    if (!parameter) {
      return res.status(404).json({ success: false, error: 'Parameter not found' })
    }

    const version = await prisma.parameterVersion.findFirst({ where: { id: versionId, parameterId: id } })
    if (!version) {
      return res.status(404).json({ success: false, error: 'Version not found' })
    }

    const snap = version.snapshot as Record<string, unknown>
    const newVersionStr = incrementMinorVersion(parameter.version)
    const { major: maj, minor: min } = parseVersionParts(newVersionStr)

    const restored = await prisma.parameter.update({
      where: { id },
      data: {
        name:         typeof snap.name         === 'string' ? snap.name         : parameter.name,
        description:  typeof snap.description  === 'string' ? snap.description  : parameter.description,
        dataType:     typeof snap.dataType     === 'string' ? snap.dataType     : parameter.dataType,
        defaultValue: typeof snap.defaultValue === 'string' ? snap.defaultValue : parameter.defaultValue,
        unit:         typeof snap.unit         === 'string' ? snap.unit         : parameter.unit,
        tolerance:    typeof snap.tolerance    === 'string' ? snap.tolerance    : parameter.tolerance,
        minValue:     typeof snap.minValue     === 'string' ? snap.minValue     : parameter.minValue,
        maxValue:     typeof snap.maxValue     === 'string' ? snap.maxValue     : parameter.maxValue,
        formula:      typeof snap.formula      === 'string' ? snap.formula      : parameter.formula,
        status:       'draft',
        version:      newVersionStr,
      },
      include: {
        sourceFunction: { select: { id: true, functionId: true, name: true } },
        sourceParameter: { select: { id: true, name: true } },
      },
    })

    await prisma.parameterVersion.create({
      data: {
        parameterId: id,
        version: maj,
        minorVersion: min,
        snapshot: buildParameterVersionSnapshot(restored) as object,
        createdById: req.user!.userId,
      },
    })

    res.json({
      success: true,
      data: restored,
      message: `Parameter restored to version ${version.version}.${version.minorVersion}`,
    })
  } catch (error) {
    console.error('Restore parameter version error:', error)
    res.status(500).json({ success: false, error: (error as Error).message ?? 'Internal server error' })
  }
}

