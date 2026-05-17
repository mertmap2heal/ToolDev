// NX-3 (#443) — Configuration Management: ConfigItem business logic.
//
// IEEE 828-2012 §6.2 configuration identification. A ConfigItem is a uniquely
// identified, versioned, lockable artefact under configuration control.
//
// Services throw plain Errors; controllers translate them to HTTP responses
// (per .claude/kb/backend-patterns.md). Prisma queries live only here.
import type { ConfigItem, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

// --- Controlled vocabularies -----------------------------------------------

// IEEE 828 §6.2 — the 11 typed CI kinds the CM module models.
export const CI_TYPES = [
  'Requirement',
  'Architecture',
  'Interface',
  'Parameter',
  'Software',
  'Hardware',
  'Document',
  'Model',
  'TestCase',
  'TestResult',
  'SafetyArtifact',
] as const
export type CiType = (typeof CI_TYPES)[number]

// IEEE 828 §6.2 CI lifecycle: Created -> Draft -> InReview -> Released -> Obsolete.
// `Created` is the conceptual entry; a freshly-created row is `Draft`.
export const CI_STATUSES = ['Draft', 'InReview', 'Released', 'Obsolete'] as const
export type CiStatus = (typeof CI_STATUSES)[number]

export const CI_LOCK_STATES = ['Unlocked', 'FrozenByBaseline', 'LockedForRelease'] as const
export type CiLockState = (typeof CI_LOCK_STATES)[number]

const CI_KEY_PREFIX: Record<CiType, string> = {
  Requirement: 'CI-REQ',
  Architecture: 'CI-ARC',
  Interface: 'CI-INT',
  Parameter: 'CI-PAR',
  Software: 'CI-SW',
  Hardware: 'CI-HW',
  Document: 'CI-DOC',
  Model: 'CI-MDL',
  TestCase: 'CI-TC',
  TestResult: 'CI-TR',
  SafetyArtifact: 'CI-SAF',
}

// --- Errors -----------------------------------------------------------------

/** A 4xx domain error — the controller maps `statusCode` to the HTTP status. */
export class CmError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'CmError'
    this.statusCode = statusCode
  }
}

// --- DTOs -------------------------------------------------------------------

export interface CreateConfigItemInput {
  name: string
  type: string
  ownerUserId?: string | null
  ownerName?: string | null
  safetyCritical?: boolean
  dal?: string | null
  tags?: string[]
  refType?: string | null
  refId?: string | null
}

export interface UpdateConfigItemInput {
  name?: string
  type?: string
  status?: string
  ownerUserId?: string | null
  ownerName?: string | null
  safetyCritical?: boolean
  dal?: string | null
  tags?: string[]
  version?: string
  revision?: string
}

export interface ListConfigItemFilters {
  type?: string
  status?: string
  ownerUserId?: string
  safetyOnly?: boolean
  search?: string
  includeDeleted?: boolean
}

// --- strictMode -------------------------------------------------------------

/**
 * Read `Project.strictMode` inside a transaction (R-6). Fails closed: if the
 * project row cannot be read, the project is treated as strict — a regulated
 * posture must never degrade because of a read error.
 */
async function readStrictMode(tx: Prisma.TransactionClient, projectId: string): Promise<boolean> {
  const project = await tx.project.findUnique({
    where: { id: projectId },
    select: { strictMode: true },
  })
  // Project missing entirely -> the create/update would fail anyway; treat strict.
  return project?.strictMode ?? true
}

// --- Audit ------------------------------------------------------------------

/**
 * Write one central AuditLog row (R-8). `action` follows the `cm:<kebab-verb>`
 * convention; `details` is a structured object written to `detailsJson` (never
 * JSON.stringify). Pass a transaction client to keep the audit row atomic with
 * the gated write.
 */
async function writeAudit(
  client: Prisma.TransactionClient | typeof prisma,
  projectId: string,
  userId: string,
  action: string,
  details: Prisma.InputJsonValue,
): Promise<void> {
  await client.auditLog.create({
    data: { projectId, userId, action, detailsJson: details },
  })
}

// --- Key allocation ---------------------------------------------------------

/**
 * Allocate the next `CI-<TYPE>-NNN` key for a project + type. Serialised by a
 * Postgres advisory lock so concurrent creates for the same prefix queue.
 */
async function allocateCiKey(
  tx: Prisma.TransactionClient,
  projectId: string,
  type: CiType,
): Promise<string> {
  const prefix = CI_KEY_PREFIX[type]
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext('cm-ci-key-' || $1 || '-' || $2))",
    projectId,
    prefix,
  )
  // Scan ALL rows (deleted included) so a soft-deleted CI never frees its key.
  const rows = await tx.configItem.findMany({
    where: { projectId, ciKey: { startsWith: `${prefix}-` } },
    select: { ciKey: true },
  })
  let max = 0
  const re = new RegExp(`^${prefix}-(\\d+)$`)
  for (const r of rows) {
    const m = r.ciKey.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `${prefix}-${String(max + 1).padStart(3, '0')}`
}

// --- Queries ----------------------------------------------------------------

/** List configuration items for a project. Filters `deletedAt: null` unless asked. */
export async function listConfigItems(
  projectId: string,
  filters: ListConfigItemFilters = {},
): Promise<ConfigItem[]> {
  const where: Prisma.ConfigItemWhereInput = { projectId }
  if (!filters.includeDeleted) where.deletedAt = null
  if (filters.type) where.type = filters.type
  if (filters.status) where.status = filters.status
  if (filters.ownerUserId) where.ownerUserId = filters.ownerUserId
  if (filters.safetyOnly) where.safetyCritical = true
  if (filters.search) {
    where.OR = [
      { ciKey: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
      { ownerName: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  return prisma.configItem.findMany({ where, orderBy: { ciKey: 'asc' } })
}

/** A single configuration item scoped to the project, or null. */
export async function getConfigItem(
  projectId: string,
  id: string,
): Promise<ConfigItem | null> {
  return prisma.configItem.findFirst({ where: { id, projectId } })
}

/** Free-text search shortcut — used by the CI picker / link-source endpoint. */
export async function searchConfigItems(
  projectId: string,
  query: string,
): Promise<ConfigItem[]> {
  return listConfigItems(projectId, { search: query })
}

// --- Mutations --------------------------------------------------------------

/**
 * Create a configuration item. Opinionated defaults (design-system §2.1):
 * status `Draft`, lockState `Unlocked`, version `0.1.0`, revision `Rev 0`.
 * `authorType` defaults to `human` (R-1) — a human create records correct
 * provenance with no extra code.
 */
export async function createConfigItem(
  projectId: string,
  userId: string,
  input: CreateConfigItemInput,
): Promise<ConfigItem> {
  const name = input.name?.trim()
  if (!name) throw new CmError('name is required')
  if (!CI_TYPES.includes(input.type as CiType)) {
    throw new CmError(`type must be one of: ${CI_TYPES.join(', ')}`)
  }
  const type = input.type as CiType

  const created = await prisma.$transaction(async (tx) => {
    const ciKey = await allocateCiKey(tx, projectId, type)
    const row = await tx.configItem.create({
      data: {
        projectId,
        ciKey,
        name,
        type,
        status: 'Draft',
        lockState: 'Unlocked',
        version: '0.1.0',
        revision: 'Rev 0',
        ownerUserId: input.ownerUserId ?? null,
        ownerName: input.ownerName ?? null,
        safetyCritical: input.safetyCritical ?? false,
        dal: input.dal ?? null,
        tags: input.tags ?? [],
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      },
    })
    await writeAudit(tx, projectId, userId, 'cm:ci-create', {
      configItemId: row.id,
      ciKey: row.ciKey,
      type: row.type,
    })
    return row
  })
  return created
}

// Content fields whose mutation is blocked while the CI is locked.
const LOCKED_CONTENT_FIELDS: (keyof UpdateConfigItemInput)[] = [
  'name',
  'type',
  'status',
  'version',
  'revision',
  'safetyCritical',
  'dal',
  'tags',
  'ownerUserId',
  'ownerName',
]

/**
 * Update a configuration item.
 *
 * R-6 strictMode enforcement: when the project is in strict mode and the CI is
 * locked (`lockState != 'Unlocked'`), a content-field edit is rejected (409).
 * The flag is read INSIDE the same transaction as the write so a concurrent
 * `PATCH /strict-mode` toggle cannot race the check. Returns null if the CI
 * does not exist in the project.
 */
export async function updateConfigItem(
  projectId: string,
  id: string,
  userId: string,
  input: UpdateConfigItemInput,
): Promise<ConfigItem | null> {
  if (input.type !== undefined && !CI_TYPES.includes(input.type as CiType)) {
    throw new CmError(`type must be one of: ${CI_TYPES.join(', ')}`)
  }
  if (input.status !== undefined && !CI_STATUSES.includes(input.status as CiStatus)) {
    throw new CmError(`status must be one of: ${CI_STATUSES.join(', ')}`)
  }
  if (input.name !== undefined && !input.name.trim()) {
    throw new CmError('name cannot be empty')
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.configItem.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    const touchesContent = LOCKED_CONTENT_FIELDS.some((f) => input[f] !== undefined)
    if (touchesContent && existing.lockState !== 'Unlocked') {
      const strict = await readStrictMode(tx, projectId)
      if (strict) {
        throw new CmError(
          `Configuration item ${existing.ciKey} is ${existing.lockState}. ` +
            'Revoke the baseline or release lock before editing it.',
          409,
        )
      }
    }

    const data: Prisma.ConfigItemUpdateInput = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.type !== undefined) data.type = input.type
    if (input.status !== undefined) data.status = input.status
    if (input.ownerUserId !== undefined) data.ownerUserId = input.ownerUserId
    if (input.ownerName !== undefined) data.ownerName = input.ownerName
    if (input.safetyCritical !== undefined) data.safetyCritical = input.safetyCritical
    if (input.dal !== undefined) data.dal = input.dal
    if (input.tags !== undefined) data.tags = input.tags
    if (input.version !== undefined) data.version = input.version
    if (input.revision !== undefined) data.revision = input.revision

    const row = await tx.configItem.update({ where: { id }, data })
    await writeAudit(tx, projectId, userId, 'cm:ci-update', {
      configItemId: row.id,
      ciKey: row.ciKey,
      fields: Object.keys(data),
    })
    return row
  })
}

/**
 * Soft-delete a configuration item (sets `deletedAt` / `deletedById`). A CI
 * locked by a baseline / release cannot be deleted while the project is strict.
 */
export async function softDeleteConfigItem(
  projectId: string,
  id: string,
  userId: string,
): Promise<ConfigItem | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.configItem.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    if (existing.lockState !== 'Unlocked') {
      const strict = await readStrictMode(tx, projectId)
      if (strict) {
        throw new CmError(
          `Configuration item ${existing.ciKey} is ${existing.lockState} and cannot be deleted.`,
          409,
        )
      }
    }

    const row = await tx.configItem.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: userId },
    })
    await writeAudit(tx, projectId, userId, 'cm:ci-delete', {
      configItemId: row.id,
      ciKey: row.ciKey,
    })
    return row
  })
}

/**
 * Set the lock state of a configuration item. `lockState` is one of the
 * controlled vocabulary values. Audited as `cm:ci-lock` / `cm:ci-unlock`.
 */
export async function setConfigItemLock(
  projectId: string,
  id: string,
  userId: string,
  lockState: string,
): Promise<ConfigItem | null> {
  if (!CI_LOCK_STATES.includes(lockState as CiLockState)) {
    throw new CmError(`lockState must be one of: ${CI_LOCK_STATES.join(', ')}`)
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.configItem.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    const row = await tx.configItem.update({
      where: { id },
      data: { lockState },
    })
    await writeAudit(
      tx,
      projectId,
      userId,
      lockState === 'Unlocked' ? 'cm:ci-unlock' : 'cm:ci-lock',
      { configItemId: row.id, ciKey: row.ciKey, lockState },
    )
    return row
  })
}

/**
 * Link a configuration item to a source artefact (`refType` / `refId`). The
 * polymorphic backref records which module artefact this CI describes.
 */
export async function linkConfigItemSource(
  projectId: string,
  id: string,
  userId: string,
  refType: string,
  refId: string,
): Promise<ConfigItem | null> {
  if (!refType?.trim() || !refId?.trim()) {
    throw new CmError('refType and refId are required')
  }
  return prisma.$transaction(async (tx) => {
    const existing = await tx.configItem.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    const row = await tx.configItem.update({
      where: { id },
      data: { refType: refType.trim(), refId: refId.trim() },
    })
    await writeAudit(tx, projectId, userId, 'cm:ci-link-source', {
      configItemId: row.id,
      ciKey: row.ciKey,
      refType: row.refType,
      refId: row.refId,
    })
    return row
  })
}
