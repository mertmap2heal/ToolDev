import { prisma } from '../lib/prisma'
import { Prisma } from '@prisma/client'
import { randomUUID } from 'crypto'

// Method types and statuses (string-typed for DB compatibility, validated at controller boundary)
export const METHOD_TYPES = [
  'DEMONSTRATION',
  'OPERATIONAL_TEST',
  'SIMULATION',
  'ANALYSIS',
  'STAKEHOLDER_ACCEPTANCE',
] as const
export type ValidationMethodType = (typeof METHOD_TYPES)[number]

export const MILESTONES = ['PDR', 'CDR', 'FAT', 'SAT', 'EIS', 'OTHER'] as const
export type ValidationMilestone = (typeof MILESTONES)[number]

export const STATUSES = ['PLANNED', 'EXECUTED', 'VALIDATED', 'BLOCKED', 'OBSOLETE'] as const
export type ValidationStatus = (typeof STATUSES)[number]

export const CRITERION_OUTCOMES = ['PENDING', 'MET', 'PARTIAL', 'NOT_MET'] as const
export type CriterionOutcome = (typeof CRITERION_OUTCOMES)[number]

export interface ValidationCriterion {
  id: string
  text: string
  outcome: CriterionOutcome
  notes?: string
  orderIndex: number
}

interface ListFilters {
  status?: string
  methodType?: string
  milestone?: string
  ownerId?: string
  search?: string
  includeDeleted?: boolean
}

async function nextKey(projectId: string): Promise<string> {
  const last = await prisma.validationItem.findFirst({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { key: true },
  })
  if (!last) return 'VAL-001'
  const m = last.key.match(/^VAL-(\d+)$/)
  if (!m) return `VAL-${Date.now().toString().slice(-6)}`
  const next = (parseInt(m[1], 10) + 1).toString().padStart(3, '0')
  return `VAL-${next}`
}

function buildWhere(projectId: string, filters: ListFilters): Prisma.ValidationItemWhereInput {
  const where: Prisma.ValidationItemWhereInput = { projectId }
  if (!filters.includeDeleted) where.deletedAt = null
  if (filters.status) where.status = filters.status
  if (filters.methodType) where.methodType = filters.methodType
  if (filters.milestone) where.targetMilestone = filters.milestone
  if (filters.ownerId) where.ownerUserId = filters.ownerId
  if (filters.search) {
    where.OR = [
      { title: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { key: { contains: filters.search, mode: 'insensitive' } },
    ]
  }
  return where
}

async function writeAudit(projectId: string, userId: string, action: string, details?: unknown) {
  await prisma.auditLog.create({
    data: {
      projectId,
      userId,
      action,
      details: details ? JSON.stringify(details) : null,
    },
  })
}

export async function listItems(projectId: string, filters: ListFilters = {}) {
  const items = await prisma.validationItem.findMany({
    where: buildWhere(projectId, filters),
    orderBy: [{ targetMilestone: 'asc' }, { key: 'asc' }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { signOffs: true } },
    },
  })
  return items
}

export async function getItem(projectId: string, id: string) {
  const item = await prisma.validationItem.findFirst({
    where: { id, projectId },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      signOffs: {
        orderBy: { signedAt: 'desc' },
        include: { signer: { select: { id: true, name: true, email: true } } },
      },
    },
  })
  return item
}

interface CreatePayload {
  title: string
  description?: string
  methodType?: string
  targetMilestone?: string
  ownerUserId?: string | null
  criteria?: Omit<ValidationCriterion, 'id' | 'orderIndex'>[]
}

export async function createItem(projectId: string, userId: string, payload: CreatePayload) {
  if (!payload.title?.trim()) throw new Error('title is required')
  if (payload.methodType && !METHOD_TYPES.includes(payload.methodType as ValidationMethodType))
    throw new Error('invalid methodType')
  if (
    payload.targetMilestone &&
    !MILESTONES.includes(payload.targetMilestone as ValidationMilestone)
  )
    throw new Error('invalid targetMilestone')

  const key = await nextKey(projectId)
  const criteria: ValidationCriterion[] = (payload.criteria ?? []).map((c, i) => ({
    id: randomUUID(),
    text: c.text,
    outcome: 'PENDING',
    notes: c.notes,
    orderIndex: i,
  }))

  const created = await prisma.validationItem.create({
    data: {
      projectId,
      key,
      title: payload.title.trim(),
      description: payload.description ?? null,
      methodType: payload.methodType ?? 'DEMONSTRATION',
      targetMilestone: payload.targetMilestone ?? 'OTHER',
      ownerUserId: payload.ownerUserId ?? null,
      criteria: criteria as unknown as Prisma.InputJsonValue,
      createdById: userId,
    },
    include: { owner: true, createdBy: true },
  })

  await writeAudit(projectId, userId, 'validation:create', {
    validationItemId: created.id,
    key: created.key,
  })
  return created
}

interface UpdatePayload {
  title?: string
  description?: string | null
  methodType?: string
  targetMilestone?: string
  ownerUserId?: string | null
  criteria?: ValidationCriterion[]
  status?: string
}

export async function updateItem(
  projectId: string,
  id: string,
  userId: string,
  payload: UpdatePayload,
) {
  const existing = await prisma.validationItem.findFirst({ where: { id, projectId } })
  if (!existing) return null
  if (existing.deletedAt) throw new Error('cannot edit a deleted item')

  if (payload.methodType && !METHOD_TYPES.includes(payload.methodType as ValidationMethodType))
    throw new Error('invalid methodType')
  if (
    payload.targetMilestone &&
    !MILESTONES.includes(payload.targetMilestone as ValidationMilestone)
  )
    throw new Error('invalid targetMilestone')
  if (payload.status && !STATUSES.includes(payload.status as ValidationStatus))
    throw new Error('invalid status')

  // Auto-advance status when criteria change
  let nextStatus = payload.status ?? existing.status
  if (payload.criteria) {
    for (const c of payload.criteria) {
      if (!CRITERION_OUTCOMES.includes(c.outcome as CriterionOutcome))
        throw new Error('invalid criterion outcome')
    }
    const allMet = payload.criteria.length > 0 && payload.criteria.every((c) => c.outcome === 'MET')
    const anyNotMet = payload.criteria.some((c) => c.outcome === 'NOT_MET')
    if (allMet && existing.status === 'PLANNED') nextStatus = 'EXECUTED'
    if (anyNotMet && existing.status === 'EXECUTED') nextStatus = 'BLOCKED'
  }

  const updated = await prisma.validationItem.update({
    where: { id },
    data: {
      title: payload.title?.trim() ?? existing.title,
      description: payload.description !== undefined ? payload.description : existing.description,
      methodType: payload.methodType ?? existing.methodType,
      targetMilestone: payload.targetMilestone ?? existing.targetMilestone,
      ownerUserId: payload.ownerUserId !== undefined ? payload.ownerUserId : existing.ownerUserId,
      criteria:
        payload.criteria !== undefined
          ? (payload.criteria as unknown as Prisma.InputJsonValue)
          : (existing.criteria as Prisma.InputJsonValue),
      status: nextStatus,
    },
    include: { owner: true, createdBy: true },
  })

  await writeAudit(projectId, userId, 'validation:update', {
    validationItemId: id,
    statusBefore: existing.status,
    statusAfter: nextStatus,
  })
  return updated
}

export async function softDeleteItem(
  projectId: string,
  id: string,
  userId: string,
  reason?: string,
) {
  const existing = await prisma.validationItem.findFirst({ where: { id, projectId } })
  if (!existing) return null
  if (existing.deletedAt) return existing
  const updated = await prisma.validationItem.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      deletedById: userId,
      deleteReason: reason ?? null,
      restoredAt: null,
    },
  })
  await writeAudit(projectId, userId, 'validation:delete', { validationItemId: id, reason })
  return updated
}

export async function restoreItem(projectId: string, id: string, userId: string) {
  const existing = await prisma.validationItem.findFirst({ where: { id, projectId } })
  if (!existing) return null
  if (!existing.deletedAt) return existing
  const updated = await prisma.validationItem.update({
    where: { id },
    data: {
      deletedAt: null,
      deletedById: null,
      deleteReason: null,
      restoredAt: new Date(),
    },
  })
  await writeAudit(projectId, userId, 'validation:restore', { validationItemId: id })
  return updated
}

interface BulkFromRequirementsPayload {
  requirementIds: string[]
  methodType?: string
  targetMilestone?: string
}

export async function createFromRequirements(
  projectId: string,
  userId: string,
  payload: BulkFromRequirementsPayload,
) {
  if (!Array.isArray(payload.requirementIds) || payload.requirementIds.length === 0)
    throw new Error('requirementIds is required')
  if (payload.requirementIds.length > 200)
    throw new Error('cannot create more than 200 items at once')

  const reqs = await prisma.requirement.findMany({
    where: { id: { in: payload.requirementIds }, projectId, deletedAt: null },
    select: { id: true, title: true, description: true, acceptanceCriteria: true },
  })

  const created: { id: string; key: string; sourceRequirementId: string }[] = []
  for (const r of reqs) {
    const key = await nextKey(projectId)
    const acText = r.acceptanceCriteria?.trim()
    const criteria: ValidationCriterion[] = acText
      ? acText
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((text, i) => ({
            id: randomUUID(),
            text,
            outcome: 'PENDING' as CriterionOutcome,
            orderIndex: i,
          }))
      : []
    const item = await prisma.validationItem.create({
      data: {
        projectId,
        key,
        title: `Validate: ${r.title}`,
        description: r.description ? `Source requirement ${r.id}\n\n${r.description}` : null,
        methodType: payload.methodType ?? 'DEMONSTRATION',
        targetMilestone: payload.targetMilestone ?? 'OTHER',
        criteria: criteria as unknown as Prisma.InputJsonValue,
        createdById: userId,
      },
      select: { id: true, key: true },
    })
    created.push({ ...item, sourceRequirementId: r.id })
  }

  await writeAudit(projectId, userId, 'validation:bulk-from-requirements', {
    count: created.length,
  })
  return created
}

// ---- Sign-off ----

interface SignOffPayload {
  signerRoleLabel: string
  comment?: string
}

export async function signOff(
  projectId: string,
  itemId: string,
  signerUserId: string,
  payload: SignOffPayload,
) {
  if (!payload.signerRoleLabel?.trim()) throw new Error('signerRoleLabel is required')
  const item = await prisma.validationItem.findFirst({ where: { id: itemId, projectId } })
  if (!item) return null
  if (item.deletedAt) throw new Error('cannot sign off a deleted item')
  if (item.createdById === signerUserId)
    throw new Error('signer cannot be the creator of the item')
  if (item.status === 'PLANNED')
    throw new Error('item must be EXECUTED before sign-off')

  const result = await prisma.$transaction(async (tx) => {
    const signOff = await tx.validationSignOff.create({
      data: {
        validationItemId: itemId,
        signerUserId,
        signerRoleLabel: payload.signerRoleLabel.trim(),
        comment: payload.comment ?? null,
      },
      include: { signer: { select: { id: true, name: true, email: true } } },
    })
    await tx.validationItem.update({
      where: { id: itemId },
      data: { status: 'VALIDATED' },
    })
    return signOff
  })

  await writeAudit(projectId, signerUserId, 'validation:sign-off', {
    validationItemId: itemId,
    signOffId: result.id,
  })
  return result
}

export async function revokeSignOff(
  projectId: string,
  itemId: string,
  signOffId: string,
  userId: string,
) {
  const item = await prisma.validationItem.findFirst({ where: { id: itemId, projectId } })
  if (!item) return null
  const previous = await prisma.validationSignOff.findFirst({
    where: { id: signOffId, validationItemId: itemId },
  })
  if (!previous) return null
  if (previous.supersededById) throw new Error('sign-off already superseded')

  const result = await prisma.$transaction(async (tx) => {
    const revocation = await tx.validationSignOff.create({
      data: {
        validationItemId: itemId,
        signerUserId: userId,
        signerRoleLabel: 'Revocation',
        comment: 'Sign-off revoked',
      },
    })
    await tx.validationSignOff.update({
      where: { id: previous.id },
      data: { supersededById: revocation.id },
    })
    // Demote item back to EXECUTED so a new sign-off can be requested
    const remaining = await tx.validationSignOff.count({
      where: { validationItemId: itemId, supersededById: null, NOT: { id: revocation.id } },
    })
    if (remaining === 0)
      await tx.validationItem.update({ where: { id: itemId }, data: { status: 'EXECUTED' } })
    return revocation
  })

  await writeAudit(projectId, userId, 'validation:sign-off-revoke', {
    validationItemId: itemId,
    revokedSignOffId: signOffId,
    revocationId: result.id,
  })
  return result
}

export async function listSignOffs(projectId: string, itemId: string) {
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  return prisma.validationSignOff.findMany({
    where: { validationItemId: itemId },
    orderBy: { signedAt: 'desc' },
    include: { signer: { select: { id: true, name: true, email: true } } },
  })
}

// ---- Evidence (reuses VerEvidence + VerEvidenceLink polymorphic store) ----

export async function listEvidence(projectId: string, itemId: string) {
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  const links = await prisma.verEvidenceLink.findMany({
    where: { linkedEntityType: 'ValidationItem', linkedEntityId: itemId },
    include: { evidence: true, user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return links
}

interface AttachEvidencePayload {
  title: string
  evidenceType: string
  storageRef: string
  description?: string | null
  checksum?: string | null
}

export async function attachEvidence(
  projectId: string,
  itemId: string,
  userId: string,
  payload: AttachEvidencePayload,
) {
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  const evidence = await prisma.verEvidence.create({
    data: {
      projectId,
      title: payload.title,
      evidenceType: payload.evidenceType,
      storageRef: payload.storageRef,
      description: payload.description ?? null,
      checksum: payload.checksum ?? null,
      createdByUserId: userId,
    },
  })
  const link = await prisma.verEvidenceLink.create({
    data: {
      userId,
      evidenceId: evidence.id,
      linkedEntityType: 'ValidationItem',
      linkedEntityId: itemId,
      relation: 'PRIMARY',
    },
    include: { evidence: true },
  })
  await writeAudit(projectId, userId, 'validation:evidence-attach', {
    validationItemId: itemId,
    evidenceId: evidence.id,
  })
  return link
}

export async function detachEvidence(
  projectId: string,
  itemId: string,
  linkId: string,
  userId: string,
) {
  const link = await prisma.verEvidenceLink.findFirst({
    where: { id: linkId, linkedEntityType: 'ValidationItem', linkedEntityId: itemId },
  })
  if (!link) return null
  await prisma.verEvidenceLink.delete({ where: { id: linkId } })
  // Garbage-collect evidence row when no other link references it
  const remaining = await prisma.verEvidenceLink.count({ where: { evidenceId: link.evidenceId } })
  if (remaining === 0) {
    await prisma.verEvidence.delete({ where: { id: link.evidenceId } })
  }
  await writeAudit(projectId, userId, 'validation:evidence-detach', {
    validationItemId: itemId,
    evidenceId: link.evidenceId,
  })
  return { deleted: true }
}

// ---- CSV export ----

function csvCell(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export async function exportItemsCsv(projectId: string, filters: ListFilters = {}) {
  const items = await prisma.validationItem.findMany({
    where: buildWhere(projectId, filters),
    orderBy: [{ targetMilestone: 'asc' }, { key: 'asc' }],
    include: {
      owner: { select: { name: true, email: true } },
      _count: { select: { signOffs: true } },
    },
  })
  const header = [
    'key',
    'title',
    'methodType',
    'targetMilestone',
    'status',
    'owner',
    'criteriaCount',
    'criteriaMet',
    'signOffCount',
    'createdAt',
  ]
  const rows = items.map((i) => {
    const criteria = (i.criteria as ValidationCriterion[] | null) ?? []
    const met = criteria.filter((c) => c.outcome === 'MET').length
    return [
      i.key,
      i.title,
      i.methodType,
      i.targetMilestone,
      i.status,
      i.owner?.name ?? i.owner?.email ?? '',
      criteria.length,
      met,
      i._count.signOffs,
      i.createdAt.toISOString(),
    ]
      .map(csvCell)
      .join(',')
  })
  return [header.join(','), ...rows].join('\n')
}
