// NX-9 (#466) — Safety Analysis: Hazard + FMEA business logic.
//
// ARP4761A FHA hazard log + FMEA worksheet. Services throw plain Errors
// (SafetyError carries `statusCode`); controllers translate them to HTTP
// responses. Prisma queries live only here (.claude/kb/backend-patterns.md).
//
// Two server-side derivations are load-bearing and never trust the client:
//   - hazard.dal is derived from hazard.severity (DO-178C §6.3 map).
//   - fmeaRow.rpn is computed as severity * occurrence * detection.
// Both `dal` and `rpn` are absent from the accepted Zod input schemas; a
// client-supplied value is rejected with a 400.
import type { Fmea, FmeaRow, FailureCondition, Hazard, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma'

// --- Controlled vocabularies -----------------------------------------------

// Aerospace hazard severity (AC 25.1309-1A; kb/safety-standards.md).
export const HAZARD_SEVERITIES = [
  'Catastrophic',
  'Hazardous',
  'Major',
  'Minor',
  'NoSafetyEffect',
] as const
export type HazardSeverity = (typeof HAZARD_SEVERITIES)[number]

// Hazard lifecycle status.
export const HAZARD_STATUSES = ['Open', 'Mitigated', 'Verified', 'Closed'] as const
export type HazardStatus = (typeof HAZARD_STATUSES)[number]

// ARP4761A FHA levels: AFHA (aircraft-level), SFHA (system-level).
export const FAILURE_CONDITION_LEVELS = ['AFHA', 'SFHA'] as const
export type FailureConditionLevel = (typeof FAILURE_CONDITION_LEVELS)[number]

// FMEA worksheet status.
export const FMEA_STATUSES = ['Draft', 'InReview', 'Approved'] as const
export type FmeaStatus = (typeof FMEA_STATUSES)[number]

// Severity -> DAL map (DO-178C §6.3; kb/safety-standards.md). Frozen — the
// single source of truth for the per-hazard DAL derivation.
const SEVERITY_TO_DAL: Record<HazardSeverity, string> = {
  Catastrophic: 'A',
  Hazardous: 'B',
  Major: 'C',
  Minor: 'D',
  NoSafetyEffect: 'E',
}

/** Pure function — derive the DAL for a hazard severity. */
export function deriveDal(severity: HazardSeverity): string {
  return SEVERITY_TO_DAL[severity]
}

/** Pure function — RPN is severity * occurrence * detection (each 1-10 -> 1-1000). */
export function computeRpn(severity: number, occurrence: number, detection: number): number {
  return severity * occurrence * detection
}

// --- Errors -----------------------------------------------------------------

/** A 4xx domain error — the controller maps `statusCode` to the HTTP status. */
export class SafetyError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'SafetyError'
    this.statusCode = statusCode
  }
}

/** Run a Zod schema; rethrow a failure as a 400 SafetyError with a flat message. */
function parseOr400<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success) {
    const first = result.error.errors[0]
    const path = first?.path?.length ? `${first.path.join('.')}: ` : ''
    throw new SafetyError(`${path}${first?.message ?? 'Invalid request body'}`)
  }
  return result.data
}

// --- Zod request schemas ----------------------------------------------------
//
// `.strict()` on every schema — an unexpected key (notably a client-supplied
// `dal` or `rpn`) is rejected. The dedicated `dal` / `rpn` guards below make
// the 400 message explicit per the AC.

const severitySchema = z.enum(HAZARD_SEVERITIES)
const hazardStatusSchema = z.enum(HAZARD_STATUSES)

export const createHazardSchema = z
  .object({
    identifier: z.string().trim().min(1).max(64).optional(),
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().min(1),
    severity: severitySchema,
    status: hazardStatusSchema.optional(),
    failureRateTargetPerHr: z.number().finite().positive().nullable().optional(),
    rationale: z.string().trim().nullable().optional(),
  })
  .strict()
export type CreateHazardInput = z.infer<typeof createHazardSchema>

export const updateHazardSchema = z
  .object({
    identifier: z.string().trim().min(1).max(64).optional(),
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().min(1).optional(),
    severity: severitySchema.optional(),
    status: hazardStatusSchema.optional(),
    failureRateTargetPerHr: z.number().finite().positive().nullable().optional(),
    rationale: z.string().trim().nullable().optional(),
  })
  .strict()
export type UpdateHazardInput = z.infer<typeof updateHazardSchema>

export const createFailureConditionSchema = z
  .object({
    level: z.enum(FAILURE_CONDITION_LEVELS),
    description: z.string().trim().min(1),
    phaseOfFlight: z.string().trim().nullable().optional(),
    effect: z.string().trim().nullable().optional(),
    classification: z.string().trim().nullable().optional(),
    rationale: z.string().trim().nullable().optional(),
  })
  .strict()
export type CreateFailureConditionInput = z.infer<typeof createFailureConditionSchema>

export const updateFailureConditionSchema = z
  .object({
    level: z.enum(FAILURE_CONDITION_LEVELS).optional(),
    description: z.string().trim().min(1).optional(),
    phaseOfFlight: z.string().trim().nullable().optional(),
    effect: z.string().trim().nullable().optional(),
    classification: z.string().trim().nullable().optional(),
    rationale: z.string().trim().nullable().optional(),
  })
  .strict()
export type UpdateFailureConditionInput = z.infer<typeof updateFailureConditionSchema>

export const createFmeaSchema = z
  .object({
    title: z.string().trim().min(1).max(300),
    description: z.string().trim().nullable().optional(),
    status: z.enum(FMEA_STATUSES).optional(),
    systemRef: z.string().trim().nullable().optional(),
  })
  .strict()
export type CreateFmeaInput = z.infer<typeof createFmeaSchema>

export const updateFmeaSchema = z
  .object({
    title: z.string().trim().min(1).max(300).optional(),
    description: z.string().trim().nullable().optional(),
    status: z.enum(FMEA_STATUSES).optional(),
    systemRef: z.string().trim().nullable().optional(),
  })
  .strict()
export type UpdateFmeaInput = z.infer<typeof updateFmeaSchema>

// FMEA-row 1-10 score. `severity` / `occurrence` / `detection` only — `rpn`
// is never an accepted input key.
const scoreSchema = z.number().int().min(1).max(10)

export const createFmeaRowSchema = z
  .object({
    component: z.string().trim().min(1),
    failureMode: z.string().trim().min(1),
    effect: z.string().trim().min(1),
    cause: z.string().trim().nullable().optional(),
    severity: scoreSchema,
    occurrence: scoreSchema,
    detection: scoreSchema,
    mitigation: z.string().trim().nullable().optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .strict()
export type CreateFmeaRowInput = z.infer<typeof createFmeaRowSchema>

export const updateFmeaRowSchema = z
  .object({
    component: z.string().trim().min(1).optional(),
    failureMode: z.string().trim().min(1).optional(),
    effect: z.string().trim().min(1).optional(),
    cause: z.string().trim().nullable().optional(),
    severity: scoreSchema.optional(),
    occurrence: scoreSchema.optional(),
    detection: scoreSchema.optional(),
    mitigation: z.string().trim().nullable().optional(),
    orderIndex: z.number().int().min(0).optional(),
  })
  .strict()
export type UpdateFmeaRowInput = z.infer<typeof updateFmeaRowSchema>

/**
 * Reject a client-supplied server-derived field with an explicit 400.
 * `.strict()` already rejects unknown keys, but the AC wants a message naming
 * the field — and a `null`/`undefined` value would otherwise slip past `.strict()`.
 */
function rejectServerField(body: unknown, field: 'dal' | 'rpn', why: string): void {
  if (body && typeof body === 'object' && field in (body as Record<string, unknown>)) {
    throw new SafetyError(why)
  }
}

// --- Audit ------------------------------------------------------------------

/**
 * Write one central AuditLog row (R-8). `action` follows the
 * `safety:<kebab-verb>` convention; `details` is a structured object written
 * to `detailsJson` (never JSON.stringify). Pass a transaction client to keep
 * the audit row atomic with the gated write.
 */
async function writeAudit(
  client: Prisma.TransactionClient,
  projectId: string,
  userId: string,
  action: string,
  details: Prisma.InputJsonValue,
): Promise<void> {
  await client.auditLog.create({
    data: { projectId, userId, action, detailsJson: details },
  })
}

// --- Identifier allocation --------------------------------------------------

/**
 * Allocate the next `HAZ-NNN` identifier for a project. Serialised by a
 * Postgres advisory lock so concurrent creates queue. Scans ALL rows
 * (soft-deleted included) so a deleted hazard never frees its identifier.
 */
async function allocateHazardIdentifier(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<string> {
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext('safety-haz-id-' || $1))",
    projectId,
  )
  const rows = await tx.hazard.findMany({
    where: { projectId, identifier: { startsWith: 'HAZ-' } },
    select: { identifier: true },
  })
  let max = 0
  const re = /^HAZ-(\d+)$/
  for (const r of rows) {
    const m = r.identifier.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `HAZ-${String(max + 1).padStart(3, '0')}`
}

// ===========================================================================
// Hazard
// ===========================================================================

export interface ListHazardFilters {
  severity?: string
  status?: string
  search?: string
  includeDeleted?: boolean
}

/** List hazards for a project. Filters `deletedAt: null` unless asked. */
export async function listHazards(
  projectId: string,
  filters: ListHazardFilters = {},
): Promise<Hazard[]> {
  const where: Prisma.HazardWhereInput = { projectId }
  if (!filters.includeDeleted) where.deletedAt = null
  if (filters.severity) where.severity = filters.severity
  if (filters.status) where.status = filters.status
  if (filters.search) {
    where.OR = [
      { identifier: { contains: filters.search, mode: 'insensitive' } },
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  return prisma.hazard.findMany({ where, orderBy: { identifier: 'asc' } })
}

/** A single hazard scoped to the project, or null. */
export async function getHazard(projectId: string, id: string): Promise<Hazard | null> {
  return prisma.hazard.findFirst({ where: { id, projectId } })
}

/**
 * Create a hazard. `dal` is server-derived from `severity` (never client-set)
 * and persisted for the `@@index([projectId, severity])` query path.
 * `authorType` defaults to `human` (R-1) — a human create needs no extra code.
 */
export async function createHazard(
  projectId: string,
  userId: string,
  body: unknown,
): Promise<Hazard> {
  rejectServerField(body, 'dal', 'dal is server-derived from severity and cannot be set by the client')
  const input = parseOr400(createHazardSchema, body)
  const dal = deriveDal(input.severity)

  return prisma.$transaction(async (tx) => {
    const identifier = input.identifier ?? (await allocateHazardIdentifier(tx, projectId))
    const existing = await tx.hazard.findFirst({
      where: { projectId, identifier },
      select: { id: true },
    })
    if (existing) throw new SafetyError(`Hazard identifier ${identifier} already exists`, 409)

    const row = await tx.hazard.create({
      data: {
        projectId,
        identifier,
        title: input.title,
        description: input.description,
        severity: input.severity,
        dal,
        status: input.status ?? 'Open',
        failureRateTargetPerHr: input.failureRateTargetPerHr ?? null,
        rationale: input.rationale ?? null,
        createdById: userId,
        updatedById: userId,
      },
    })
    await writeAudit(tx, projectId, userId, 'safety:hazard-create', {
      hazardId: row.id,
      identifier: row.identifier,
      severity: row.severity,
      dal: row.dal,
    })
    return row
  })
}

/**
 * Update a hazard. When `severity` changes, `dal` is re-derived server-side.
 * A client-supplied `dal` is rejected (400). Returns null if not found.
 */
export async function updateHazard(
  projectId: string,
  id: string,
  userId: string,
  body: unknown,
): Promise<Hazard | null> {
  rejectServerField(body, 'dal', 'dal is server-derived from severity and cannot be set by the client')
  const input = parseOr400(updateHazardSchema, body)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.hazard.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    if (input.identifier !== undefined && input.identifier !== existing.identifier) {
      const clash = await tx.hazard.findFirst({
        where: { projectId, identifier: input.identifier, id: { not: id } },
        select: { id: true },
      })
      if (clash) throw new SafetyError(`Hazard identifier ${input.identifier} already exists`, 409)
    }

    const data: Prisma.HazardUpdateInput = { updatedById: userId }
    if (input.identifier !== undefined) data.identifier = input.identifier
    if (input.title !== undefined) data.title = input.title
    if (input.description !== undefined) data.description = input.description
    if (input.severity !== undefined) {
      data.severity = input.severity
      data.dal = deriveDal(input.severity)
    }
    if (input.status !== undefined) data.status = input.status
    if (input.failureRateTargetPerHr !== undefined) {
      data.failureRateTargetPerHr = input.failureRateTargetPerHr
    }
    if (input.rationale !== undefined) data.rationale = input.rationale

    const row = await tx.hazard.update({ where: { id }, data })
    await writeAudit(tx, projectId, userId, 'safety:hazard-update', {
      hazardId: row.id,
      identifier: row.identifier,
      fields: Object.keys(data).filter((k) => k !== 'updatedById'),
      severity: row.severity,
      dal: row.dal,
    })
    return row
  })
}

/** Soft-delete a hazard (sets `deletedAt`). Returns null if not found. */
export async function deleteHazard(
  projectId: string,
  id: string,
  userId: string,
): Promise<Hazard | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.hazard.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    const row = await tx.hazard.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    })
    await writeAudit(tx, projectId, userId, 'safety:hazard-delete', {
      hazardId: row.id,
      identifier: row.identifier,
    })
    return row
  })
}

// ===========================================================================
// FailureCondition (child of Hazard)
// ===========================================================================

/** Confirm the hazard exists, is not deleted, and belongs to the project. */
async function assertHazard(
  tx: Prisma.TransactionClient | typeof prisma,
  projectId: string,
  hazardId: string,
): Promise<void> {
  const hazard = await tx.hazard.findFirst({
    where: { id: hazardId, projectId },
    select: { id: true, deletedAt: true },
  })
  if (!hazard || hazard.deletedAt) throw new SafetyError('Hazard not found', 404)
}

/** List failure conditions under a hazard. Filters `deletedAt: null` unless asked. */
export async function listFailureConditions(
  projectId: string,
  hazardId: string,
  includeDeleted = false,
): Promise<FailureCondition[]> {
  await assertHazard(prisma, projectId, hazardId)
  const where: Prisma.FailureConditionWhereInput = { projectId, hazardId }
  if (!includeDeleted) where.deletedAt = null
  return prisma.failureCondition.findMany({ where, orderBy: { createdAt: 'asc' } })
}

/** A single failure condition scoped to the project + hazard, or null. */
export async function getFailureCondition(
  projectId: string,
  hazardId: string,
  id: string,
): Promise<FailureCondition | null> {
  return prisma.failureCondition.findFirst({ where: { id, projectId, hazardId } })
}

/** Create a failure condition under a hazard. */
export async function createFailureCondition(
  projectId: string,
  hazardId: string,
  userId: string,
  body: unknown,
): Promise<FailureCondition> {
  const input = parseOr400(createFailureConditionSchema, body)
  return prisma.$transaction(async (tx) => {
    await assertHazard(tx, projectId, hazardId)
    const row = await tx.failureCondition.create({
      data: {
        projectId,
        hazardId,
        level: input.level,
        description: input.description,
        phaseOfFlight: input.phaseOfFlight ?? null,
        effect: input.effect ?? null,
        classification: input.classification ?? null,
        rationale: input.rationale ?? null,
        createdById: userId,
        updatedById: userId,
      },
    })
    await writeAudit(tx, projectId, userId, 'safety:failure-condition-create', {
      failureConditionId: row.id,
      hazardId,
      level: row.level,
    })
    return row
  })
}

/** Update a failure condition. Returns null if not found. */
export async function updateFailureCondition(
  projectId: string,
  hazardId: string,
  id: string,
  userId: string,
  body: unknown,
): Promise<FailureCondition | null> {
  const input = parseOr400(updateFailureConditionSchema, body)
  return prisma.$transaction(async (tx) => {
    const existing = await tx.failureCondition.findFirst({
      where: { id, projectId, hazardId },
    })
    if (!existing || existing.deletedAt) return null

    const data: Prisma.FailureConditionUpdateInput = { updatedById: userId }
    if (input.level !== undefined) data.level = input.level
    if (input.description !== undefined) data.description = input.description
    if (input.phaseOfFlight !== undefined) data.phaseOfFlight = input.phaseOfFlight
    if (input.effect !== undefined) data.effect = input.effect
    if (input.classification !== undefined) data.classification = input.classification
    if (input.rationale !== undefined) data.rationale = input.rationale

    const row = await tx.failureCondition.update({ where: { id }, data })
    await writeAudit(tx, projectId, userId, 'safety:failure-condition-update', {
      failureConditionId: row.id,
      hazardId,
      fields: Object.keys(data).filter((k) => k !== 'updatedById'),
    })
    return row
  })
}

/** Soft-delete a failure condition. Returns null if not found. */
export async function deleteFailureCondition(
  projectId: string,
  hazardId: string,
  id: string,
  userId: string,
): Promise<FailureCondition | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.failureCondition.findFirst({
      where: { id, projectId, hazardId },
    })
    if (!existing || existing.deletedAt) return null

    const row = await tx.failureCondition.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    })
    await writeAudit(tx, projectId, userId, 'safety:failure-condition-delete', {
      failureConditionId: row.id,
      hazardId,
    })
    return row
  })
}

// ===========================================================================
// FMEA
// ===========================================================================

export interface ListFmeaFilters {
  status?: string
  search?: string
  includeDeleted?: boolean
}

/** List FMEA worksheets for a project. Filters `deletedAt: null` unless asked. */
export async function listFmeas(
  projectId: string,
  filters: ListFmeaFilters = {},
): Promise<Fmea[]> {
  const where: Prisma.FmeaWhereInput = { projectId }
  if (!filters.includeDeleted) where.deletedAt = null
  if (filters.status) where.status = filters.status
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { systemRef: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  return prisma.fmea.findMany({ where, orderBy: { createdAt: 'desc' } })
}

/** A single FMEA worksheet scoped to the project, or null. */
export async function getFmea(projectId: string, id: string): Promise<Fmea | null> {
  return prisma.fmea.findFirst({ where: { id, projectId } })
}

/** Create an FMEA worksheet. */
export async function createFmea(
  projectId: string,
  userId: string,
  body: unknown,
): Promise<Fmea> {
  const input = parseOr400(createFmeaSchema, body)
  return prisma.$transaction(async (tx) => {
    const row = await tx.fmea.create({
      data: {
        projectId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'Draft',
        systemRef: input.systemRef ?? null,
        createdById: userId,
        updatedById: userId,
      },
    })
    await writeAudit(tx, projectId, userId, 'safety:fmea-create', {
      fmeaId: row.id,
      title: row.title,
    })
    return row
  })
}

/** Update an FMEA worksheet. Returns null if not found. */
export async function updateFmea(
  projectId: string,
  id: string,
  userId: string,
  body: unknown,
): Promise<Fmea | null> {
  const input = parseOr400(updateFmeaSchema, body)
  return prisma.$transaction(async (tx) => {
    const existing = await tx.fmea.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    const data: Prisma.FmeaUpdateInput = { updatedById: userId }
    if (input.title !== undefined) data.title = input.title
    if (input.description !== undefined) data.description = input.description
    if (input.status !== undefined) data.status = input.status
    if (input.systemRef !== undefined) data.systemRef = input.systemRef

    const row = await tx.fmea.update({ where: { id }, data })
    await writeAudit(tx, projectId, userId, 'safety:fmea-update', {
      fmeaId: row.id,
      fields: Object.keys(data).filter((k) => k !== 'updatedById'),
    })
    return row
  })
}

/** Soft-delete an FMEA worksheet. Returns null if not found. */
export async function deleteFmea(
  projectId: string,
  id: string,
  userId: string,
): Promise<Fmea | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.fmea.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    const row = await tx.fmea.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    })
    await writeAudit(tx, projectId, userId, 'safety:fmea-delete', {
      fmeaId: row.id,
      title: row.title,
    })
    return row
  })
}

// ===========================================================================
// FmeaRow — RPN is server-computed
// ===========================================================================

/** Confirm the FMEA worksheet exists, is not deleted, and belongs to the project. */
async function assertFmea(
  tx: Prisma.TransactionClient | typeof prisma,
  projectId: string,
  fmeaId: string,
): Promise<void> {
  const fmea = await tx.fmea.findFirst({
    where: { id: fmeaId, projectId },
    select: { id: true, deletedAt: true },
  })
  if (!fmea || fmea.deletedAt) throw new SafetyError('FMEA worksheet not found', 404)
}

/** List rows of an FMEA worksheet. Filters `deletedAt: null` unless asked. */
export async function listFmeaRows(
  projectId: string,
  fmeaId: string,
  includeDeleted = false,
): Promise<FmeaRow[]> {
  await assertFmea(prisma, projectId, fmeaId)
  const where: Prisma.FmeaRowWhereInput = { projectId, fmeaId }
  if (!includeDeleted) where.deletedAt = null
  return prisma.fmeaRow.findMany({
    where,
    orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
  })
}

/** A single FMEA row scoped to the project + worksheet, or null. */
export async function getFmeaRow(
  projectId: string,
  fmeaId: string,
  id: string,
): Promise<FmeaRow | null> {
  return prisma.fmeaRow.findFirst({ where: { id, projectId, fmeaId } })
}

/**
 * Create an FMEA row. `rpn` is computed server-side as
 * severity * occurrence * detection — a client-supplied `rpn` is rejected.
 */
export async function createFmeaRow(
  projectId: string,
  fmeaId: string,
  userId: string,
  body: unknown,
): Promise<FmeaRow> {
  rejectServerField(body, 'rpn', 'rpn is server-computed from severity, occurrence and detection')
  const input = parseOr400(createFmeaRowSchema, body)
  const rpn = computeRpn(input.severity, input.occurrence, input.detection)

  return prisma.$transaction(async (tx) => {
    await assertFmea(tx, projectId, fmeaId)
    const row = await tx.fmeaRow.create({
      data: {
        projectId,
        fmeaId,
        component: input.component,
        failureMode: input.failureMode,
        effect: input.effect,
        cause: input.cause ?? null,
        severity: input.severity,
        occurrence: input.occurrence,
        detection: input.detection,
        rpn,
        mitigation: input.mitigation ?? null,
        orderIndex: input.orderIndex ?? 0,
        createdById: userId,
        updatedById: userId,
      },
    })
    await writeAudit(tx, projectId, userId, 'safety:fmea-row-create', {
      fmeaRowId: row.id,
      fmeaId,
      rpn: row.rpn,
    })
    return row
  })
}

/**
 * Update an FMEA row. If any of `severity` / `occurrence` / `detection`
 * changes, `rpn` is recomputed server-side. A client-supplied `rpn` is
 * rejected (400). Returns null if not found.
 */
export async function updateFmeaRow(
  projectId: string,
  fmeaId: string,
  id: string,
  userId: string,
  body: unknown,
): Promise<FmeaRow | null> {
  rejectServerField(body, 'rpn', 'rpn is server-computed from severity, occurrence and detection')
  const input = parseOr400(updateFmeaRowSchema, body)

  return prisma.$transaction(async (tx) => {
    const existing = await tx.fmeaRow.findFirst({ where: { id, projectId, fmeaId } })
    if (!existing || existing.deletedAt) return null

    const data: Prisma.FmeaRowUpdateInput = { updatedById: userId }
    if (input.component !== undefined) data.component = input.component
    if (input.failureMode !== undefined) data.failureMode = input.failureMode
    if (input.effect !== undefined) data.effect = input.effect
    if (input.cause !== undefined) data.cause = input.cause
    if (input.mitigation !== undefined) data.mitigation = input.mitigation
    if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex

    // Recompute rpn whenever any factor changes, using the new value where
    // supplied and the persisted value otherwise.
    const factorsTouched =
      input.severity !== undefined ||
      input.occurrence !== undefined ||
      input.detection !== undefined
    if (factorsTouched) {
      const severity = input.severity ?? existing.severity
      const occurrence = input.occurrence ?? existing.occurrence
      const detection = input.detection ?? existing.detection
      if (input.severity !== undefined) data.severity = severity
      if (input.occurrence !== undefined) data.occurrence = occurrence
      if (input.detection !== undefined) data.detection = detection
      data.rpn = computeRpn(severity, occurrence, detection)
    }

    const row = await tx.fmeaRow.update({ where: { id }, data })
    await writeAudit(tx, projectId, userId, 'safety:fmea-row-update', {
      fmeaRowId: row.id,
      fmeaId,
      fields: Object.keys(data).filter((k) => k !== 'updatedById'),
      rpn: row.rpn,
    })
    return row
  })
}

/** Soft-delete an FMEA row. Returns null if not found. */
export async function deleteFmeaRow(
  projectId: string,
  fmeaId: string,
  id: string,
  userId: string,
): Promise<FmeaRow | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.fmeaRow.findFirst({ where: { id, projectId, fmeaId } })
    if (!existing || existing.deletedAt) return null

    const row = await tx.fmeaRow.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: userId },
    })
    await writeAudit(tx, projectId, userId, 'safety:fmea-row-delete', {
      fmeaRowId: row.id,
      fmeaId,
    })
    return row
  })
}
