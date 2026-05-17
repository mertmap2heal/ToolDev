// NX-3 (#443) — Configuration Management: Deviation / Waiver business logic.
//
// IEEE 828 + EIA-649-C §7.5 + ARP4754A §5.3. A Deviation is a short-lived
// authorisation to depart from a baseline; a Waiver is a permanent relaxation
// (validUntil null). One discriminated table — `type` distinguishes them.
//
// The `sign` path records a CFR 21 Part 11 SignatureEvent (R-3) atomically
// with the status change. Services throw; controllers translate.
import type { Deviation, Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { createSignature } from './signature.service'
import { CmError } from './configItem.service'

// --- Controlled vocabularies -----------------------------------------------

export const DW_TYPES = ['Deviation', 'Waiver'] as const
export type DwType = (typeof DW_TYPES)[number]

export const DW_RISK_LEVELS = ['Low', 'Medium', 'High'] as const
export type DwRiskLevel = (typeof DW_RISK_LEVELS)[number]

// Draft -> Submitted -> Approved -> Closed ; Rejected is terminal.
export const DW_STATUSES = ['Draft', 'Submitted', 'Approved', 'Closed', 'Rejected'] as const
export type DwStatus = (typeof DW_STATUSES)[number]

// --- DTOs -------------------------------------------------------------------

export interface LinkedConfigItemRef {
  itemType: string
  itemId: string
}

export interface CreateDeviationInput {
  type: string
  title: string
  description?: string
  riskLevel?: string
  validUntil?: string | null
  authorityInvolved?: boolean
  decisionNotes?: string
  linkedConfigItemIds?: LinkedConfigItemRef[]
}

export interface UpdateDeviationInput {
  // `type` is rejected if present — a Deviation cannot become a Waiver.
  type?: string
  title?: string
  description?: string
  riskLevel?: string
  validUntil?: string | null
  authorityInvolved?: boolean
  decisionNotes?: string
  status?: string
  linkedConfigItemIds?: LinkedConfigItemRef[]
}

export interface ListDeviationFilters {
  type?: string
  status?: string
  riskLevel?: string
  search?: string
}

// --- Audit ------------------------------------------------------------------

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

/** Allocate the next `DW-NNN` key for a project. Serialised by an advisory lock. */
async function allocateDwKey(tx: Prisma.TransactionClient, projectId: string): Promise<string> {
  await tx.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext('cm-dw-key-' || $1))",
    projectId,
  )
  const rows = await tx.deviation.findMany({
    where: { projectId, dwKey: { startsWith: 'DW-' } },
    select: { dwKey: true },
  })
  let max = 0
  const re = /^DW-(\d+)$/
  for (const r of rows) {
    const m = r.dwKey.match(re)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  return `DW-${String(max + 1).padStart(3, '0')}`
}

/**
 * Normalise a raw linked-CI list into the `[{itemType,itemId}]` shape. Returns
 * a `Prisma.InputJsonValue` — a plain JSON array — ready for the Json column.
 */
function normaliseLinks(raw: unknown): Prisma.InputJsonValue {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (x): x is LinkedConfigItemRef =>
        !!x && typeof x === 'object' && typeof (x as LinkedConfigItemRef).itemId === 'string',
    )
    .map((x) => ({ itemType: String(x.itemType ?? 'configItem'), itemId: String(x.itemId) }))
}

// --- Queries ----------------------------------------------------------------

export async function listDeviations(
  projectId: string,
  filters: ListDeviationFilters = {},
): Promise<Deviation[]> {
  const where: Prisma.DeviationWhereInput = { projectId }
  if (filters.type) where.type = filters.type
  if (filters.status) where.status = filters.status
  if (filters.riskLevel) where.riskLevel = filters.riskLevel
  if (filters.search) {
    where.OR = [
      { dwKey: { contains: filters.search, mode: 'insensitive' } },
      { title: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  return prisma.deviation.findMany({ where, orderBy: { dwKey: 'desc' } })
}

export async function getDeviation(
  projectId: string,
  id: string,
): Promise<Deviation | null> {
  return prisma.deviation.findFirst({ where: { id, projectId } })
}

// --- Mutations --------------------------------------------------------------

/**
 * Create a deviation or waiver. Opinionated default status `Draft`. A Waiver
 * with no `validUntil` is permanent; a Deviation without one is allowed too
 * (open-ended) but the cleanup job only flags those that DO carry a date.
 */
export async function createDeviation(
  projectId: string,
  userId: string,
  input: CreateDeviationInput,
): Promise<Deviation> {
  const title = input.title?.trim()
  if (!title) throw new CmError('title is required')
  if (!DW_TYPES.includes(input.type as DwType)) {
    throw new CmError(`type must be one of: ${DW_TYPES.join(', ')}`)
  }
  if (input.riskLevel && !DW_RISK_LEVELS.includes(input.riskLevel as DwRiskLevel)) {
    throw new CmError(`riskLevel must be one of: ${DW_RISK_LEVELS.join(', ')}`)
  }
  let validUntil: Date | null = null
  if (input.validUntil) {
    const d = new Date(input.validUntil)
    if (Number.isNaN(d.getTime())) throw new CmError('validUntil is not a valid date')
    validUntil = d
  }

  return prisma.$transaction(async (tx) => {
    const dwKey = await allocateDwKey(tx, projectId)
    const row = await tx.deviation.create({
      data: {
        projectId,
        dwKey,
        type: input.type,
        title,
        description: input.description?.trim() ?? '',
        riskLevel: input.riskLevel ?? 'Low',
        validUntil,
        status: 'Draft',
        authorityInvolved: input.authorityInvolved ?? false,
        decisionNotes: input.decisionNotes?.trim() ?? null,
        linkedConfigItemIds: normaliseLinks(input.linkedConfigItemIds),
        createdById: userId,
      },
    })
    await writeAudit(tx, projectId, userId, 'cm:dw-create', {
      deviationId: row.id,
      dwKey: row.dwKey,
      type: row.type,
    })
    return row
  })
}

/**
 * Update a deviation / waiver. A signed (Approved) DW is immutable — its
 * transitions are append-only (R-6 strictMode posture); reject content edits
 * once Approved. A Rejected DW is terminal.
 */
export async function updateDeviation(
  projectId: string,
  id: string,
  userId: string,
  input: UpdateDeviationInput,
): Promise<Deviation | null> {
  if (input.type !== undefined) {
    throw new CmError('type cannot be changed after creation')
  }
  if (input.status !== undefined && !DW_STATUSES.includes(input.status as DwStatus)) {
    throw new CmError(`status must be one of: ${DW_STATUSES.join(', ')}`)
  }
  if (input.riskLevel && !DW_RISK_LEVELS.includes(input.riskLevel as DwRiskLevel)) {
    throw new CmError(`riskLevel must be one of: ${DW_RISK_LEVELS.join(', ')}`)
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.deviation.findFirst({ where: { id, projectId } })
    if (!existing) return null
    if (existing.status === 'Approved' || existing.status === 'Rejected') {
      throw new CmError(
        `Deviation ${existing.dwKey} is ${existing.status} — its record is append-only and cannot be edited.`,
        409,
      )
    }

    const data: Prisma.DeviationUpdateInput = {}
    if (input.title !== undefined) {
      if (!input.title.trim()) throw new CmError('title cannot be empty')
      data.title = input.title.trim()
    }
    if (input.description !== undefined) data.description = input.description.trim()
    if (input.riskLevel !== undefined) data.riskLevel = input.riskLevel
    if (input.validUntil !== undefined) {
      if (input.validUntil === null) {
        data.validUntil = null
      } else {
        const d = new Date(input.validUntil)
        if (Number.isNaN(d.getTime())) throw new CmError('validUntil is not a valid date')
        data.validUntil = d
      }
    }
    if (input.authorityInvolved !== undefined) data.authorityInvolved = input.authorityInvolved
    if (input.decisionNotes !== undefined) data.decisionNotes = input.decisionNotes.trim()
    if (input.status !== undefined) data.status = input.status
    if (input.linkedConfigItemIds !== undefined) {
      data.linkedConfigItemIds = normaliseLinks(input.linkedConfigItemIds)
    }

    const row = await tx.deviation.update({ where: { id }, data })
    await writeAudit(tx, projectId, userId, 'cm:dw-update', {
      deviationId: row.id,
      dwKey: row.dwKey,
      fields: Object.keys(data),
    })
    return row
  })
}

/** Serialise a deviation into a stable canonical string for the content hash. */
function canonicalDeviationPayload(d: Deviation): string {
  return JSON.stringify({
    id: d.id,
    dwKey: d.dwKey,
    type: d.type,
    title: d.title,
    description: d.description,
    riskLevel: d.riskLevel,
    validUntil: d.validUntil?.toISOString() ?? null,
    linkedConfigItemIds: d.linkedConfigItemIds,
  })
}

/**
 * Sign off a deviation / waiver — transitions it `Submitted -> Approved` and
 * records a CFR 21 Part 11 SignatureEvent (R-3) in the SAME transaction. The
 * signer is always `signerUserId` (derived from `req.user` by the controller),
 * never a body field. `reauthAt` is the server-stamped reauthentication time.
 */
export async function signDeviation(
  projectId: string,
  id: string,
  signerUserId: string,
  reauthAt: Date,
): Promise<Deviation | null> {
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.deviation.findFirst({ where: { id, projectId } })
    if (!existing) return null
    if (existing.status === 'Approved') {
      throw new CmError(`Deviation ${existing.dwKey} is already approved.`, 409)
    }
    if (existing.status === 'Rejected' || existing.status === 'Closed') {
      throw new CmError(
        `Deviation ${existing.dwKey} is ${existing.status} and cannot be signed off.`,
        409,
      )
    }

    const row = await tx.deviation.update({
      where: { id },
      data: {
        status: 'Approved',
        provenanceReviewStatus: 'approved',
        reviewerUserId: signerUserId,
        reviewTimestamp: reauthAt,
      },
    })
    // R-3: the signature is recorded atomically with the status flip — a
    // signature failure rolls back the approval. `meaningCode='approval'`.
    await createSignature(
      {
        linkedEntityType: 'Deviation',
        linkedEntityId: id,
        signerUserId,
        meaningCode: 'approval',
        reauthAt,
        signedPayload: canonicalDeviationPayload(existing),
      },
      tx,
    )
    await writeAudit(tx, projectId, signerUserId, 'cm:dw-sign', {
      deviationId: row.id,
      dwKey: row.dwKey,
    })
    return row
  })
  return result
}

/**
 * Close a deviation / waiver — transitions `Approved -> Closed`. A DW that was
 * never approved cannot be closed.
 */
export async function closeDeviation(
  projectId: string,
  id: string,
  userId: string,
): Promise<Deviation | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.deviation.findFirst({ where: { id, projectId } })
    if (!existing) return null
    if (existing.status !== 'Approved') {
      throw new CmError(
        `Only an approved deviation can be closed (${existing.dwKey} is ${existing.status}).`,
        409,
      )
    }
    const row = await tx.deviation.update({ where: { id }, data: { status: 'Closed' } })
    await writeAudit(tx, projectId, userId, 'cm:dw-close', {
      deviationId: row.id,
      dwKey: row.dwKey,
    })
    return row
  })
}

/**
 * Reject a deviation / waiver — terminal `-> Rejected`. Only a Draft or
 * Submitted DW can be rejected.
 */
export async function rejectDeviation(
  projectId: string,
  id: string,
  userId: string,
  reason?: string,
): Promise<Deviation | null> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.deviation.findFirst({ where: { id, projectId } })
    if (!existing) return null
    if (existing.status === 'Approved' || existing.status === 'Closed') {
      throw new CmError(
        `Deviation ${existing.dwKey} is ${existing.status} and cannot be rejected.`,
        409,
      )
    }
    const row = await tx.deviation.update({
      where: { id },
      data: {
        status: 'Rejected',
        decisionNotes: reason?.trim() || existing.decisionNotes,
      },
    })
    await writeAudit(tx, projectId, userId, 'cm:dw-reject', {
      deviationId: row.id,
      dwKey: row.dwKey,
      reason: reason?.trim() ?? null,
    })
    return row
  })
}

// --- Expiry job -------------------------------------------------------------

/**
 * NX-3 / CM-N2 — generate an Issue for every Approved deviation / waiver whose
 * `validUntil` is within `windowDays` (default 14). Idempotent: the Issue's
 * `issueKey` is derived deterministically from the deviation id, so a re-run
 * never creates a duplicate. The Issue carries `issueType='cm:deviation-expiring'`.
 *
 * Returns the count of NEW Issues created.
 */
export async function generateExpiringDeviationIssues(windowDays = 14): Promise<number> {
  const now = new Date()
  const horizon = new Date(now.getTime() + windowDays * 24 * 60 * 60 * 1000)

  const expiring = await prisma.deviation.findMany({
    where: {
      status: 'Approved',
      validUntil: { not: null, gte: now, lte: horizon },
    },
    select: { id: true, projectId: true, dwKey: true, title: true, type: true, validUntil: true },
  })

  let created = 0
  for (const dw of expiring) {
    // Deterministic key — re-running the job does not create a second Issue.
    const issueKey = `CM-DWEXP-${dw.id.slice(0, 8)}`
    const exists = await prisma.issue.findUnique({ where: { issueKey } })
    if (exists) continue

    await prisma.issue.create({
      data: {
        projectId: dw.projectId,
        issueKey,
        title: `${dw.type} ${dw.dwKey} expires soon: ${dw.title}`,
        description:
          `Configuration ${dw.type.toLowerCase()} ${dw.dwKey} ("${dw.title}") expires on ` +
          `${dw.validUntil?.toISOString().slice(0, 10)}. Review whether it should be ` +
          `extended, closed, or whether the underlying departure has been resolved.`,
        priority: 'high',
        status: 'open',
        issueType: 'cm:deviation-expiring',
        createdBy: null,
      },
    })
    created += 1
  }
  return created
}
