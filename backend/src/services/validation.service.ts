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
  starredOnly?: boolean
  starredByUserId?: string // required when starredOnly is true
  sortBy?: 'key' | 'updatedAt' | 'createdAt' | 'status' | 'milestone'
  sortDir?: 'asc' | 'desc'
}

async function nextKey(projectId: string): Promise<string> {
  // Compute the highest existing numeric suffix; pad to 3 digits unless we
  // exceed 999, then natural width. Allocation is racy by design — callers
  // that hit a unique-constraint collision retry via createWithUniqueKey.
  const items = await prisma.validationItem.findMany({
    where: { projectId, key: { startsWith: 'VAL-' } },
    select: { key: true },
  })
  let max = 0
  for (const it of items) {
    const m = it.key.match(/^VAL-(\d+)$/)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n > max) max = n
    }
  }
  const next = (max + 1).toString().padStart(3, '0')
  return `VAL-${next}`
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function createWithUniqueKey<T>(
  projectId: string,
  attempt: (tx: Tx, key: string) => Promise<T>,
): Promise<T> {
  // Serialize VAL-### key allocation per project via a Postgres advisory lock.
  // The lock is held for the lifetime of the transaction; concurrent calls for
  // the same project queue, concurrent calls for different projects do not.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext('validation-key-' || $1))",
      projectId,
    )
    const items = await tx.validationItem.findMany({
      where: { projectId, key: { startsWith: 'VAL-' } },
      select: { key: true },
    })
    let max = 0
    for (const it of items) {
      const m = it.key.match(/^VAL-(\d+)$/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > max) max = n
      }
    }
    const key = `VAL-${(max + 1).toString().padStart(3, '0')}`
    return attempt(tx, key)
  })
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
  if (filters.starredOnly && filters.starredByUserId) {
    where.stars = { some: { userId: filters.starredByUserId } }
  }
  return where
}

function buildOrderBy(
  filters: ListFilters,
): Prisma.ValidationItemOrderByWithRelationInput[] {
  const dir = filters.sortDir === 'desc' ? 'desc' : 'asc'
  switch (filters.sortBy) {
    case 'updatedAt':
      return [{ updatedAt: dir }]
    case 'createdAt':
      return [{ createdAt: dir }]
    case 'status':
      return [{ status: dir }, { key: 'asc' }]
    case 'milestone':
      return [{ targetMilestone: dir }, { key: 'asc' }]
    case 'key':
      return [{ key: dir }]
    default:
      return [{ targetMilestone: 'asc' }, { key: 'asc' }]
  }
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

// Idempotent system-role bootstrap. Safe to call repeatedly; uses upsert.
let _validationApproverRoleEnsured: Promise<void> | null = null
export function ensureValidationApproverRole(): Promise<void> {
  if (_validationApproverRoleEnsured) return _validationApproverRoleEnsured
  _validationApproverRoleEnsured = prisma.engineeringRole
    .upsert({
      where: { name: 'Validation Approver' },
      update: {},
      create: {
        name: 'Validation Approver',
        description:
          'Authorised to sign off Validation items on behalf of a stakeholder. Cannot be the item author.',
        isSystem: true,
      },
    })
    .then(() => undefined)
    .catch((e) => {
      _validationApproverRoleEnsured = null
      throw e
    })
  return _validationApproverRoleEnsured
}

export async function listItems(projectId: string, filters: ListFilters = {}) {
  const items = await prisma.validationItem.findMany({
    where: buildWhere(projectId, filters),
    orderBy: buildOrderBy(filters),
    include: {
      owner: { select: { id: true, name: true, email: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      _count: { select: { signOffs: true, stars: true } },
      // Hoist current-user's star presence; the caller passes their userId via
      // filters.starredByUserId. Saves a second round-trip in the UI.
      stars: filters.starredByUserId
        ? { where: { userId: filters.starredByUserId }, select: { id: true } }
        : false,
    },
  })
  const suspect = await suspectItemIds(projectId)
  return items.map((i) => ({
    ...i,
    isSuspect: suspect.has(i.id),
    starredByMe: Array.isArray((i as { stars?: { id: string }[] }).stars)
      ? ((i as { stars?: { id: string }[] }).stars?.length ?? 0) > 0
      : false,
  }))
}

export async function star(projectId: string, itemId: string, userId: string) {
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  await prisma.validationItemStar.upsert({
    where: { userId_validationItemId: { userId, validationItemId: itemId } },
    update: {},
    create: { userId, validationItemId: itemId },
  })
  return { starred: true }
}

// ---- Comments / discussions ----

export async function listComments(projectId: string, itemId: string) {
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  return prisma.validationComment.findMany({
    where: { validationItemId: itemId },
    orderBy: { createdAt: 'asc' },
    include: { author: { select: { id: true, name: true, email: true } } },
  })
}

export async function createComment(
  projectId: string,
  itemId: string,
  userId: string,
  payload: { body: string; parentId?: string },
) {
  const body = (payload.body ?? '').trim()
  if (!body) throw new Error('body is required')
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  // Parent must belong to the same item
  if (payload.parentId) {
    const parent = await prisma.validationComment.findFirst({
      where: { id: payload.parentId, validationItemId: itemId },
      select: { id: true },
    })
    if (!parent) throw new Error('parent comment not found on this item')
  }
  const comment = await prisma.validationComment.create({
    data: {
      validationItemId: itemId,
      authorUserId: userId,
      body,
      parentId: payload.parentId ?? null,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  })
  await writeAudit(projectId, userId, 'validation:comment-create', {
    validationItemId: itemId,
    commentId: comment.id,
    parentId: payload.parentId ?? null,
  })
  return comment
}

export async function updateComment(
  projectId: string,
  itemId: string,
  commentId: string,
  userId: string,
  payload: { body: string },
) {
  const comment = await prisma.validationComment.findFirst({
    where: { id: commentId, validationItemId: itemId },
  })
  if (!comment) return null
  if (comment.authorUserId !== userId)
    throw new Error('only the author can edit a comment')
  if (comment.deletedAt) throw new Error('cannot edit a deleted comment')
  const body = (payload.body ?? '').trim()
  if (!body) throw new Error('body is required')
  const updated = await prisma.validationComment.update({
    where: { id: commentId },
    data: { body },
    include: { author: { select: { id: true, name: true, email: true } } },
  })
  await writeAudit(projectId, userId, 'validation:comment-update', {
    validationItemId: itemId,
    commentId,
  })
  return updated
}

export async function softDeleteComment(
  projectId: string,
  itemId: string,
  commentId: string,
  userId: string,
  isAdmin: boolean,
) {
  const comment = await prisma.validationComment.findFirst({
    where: { id: commentId, validationItemId: itemId },
  })
  if (!comment) return null
  if (comment.authorUserId !== userId && !isAdmin)
    throw new Error('only the author or an admin can delete a comment')
  if (comment.deletedAt) return comment
  const updated = await prisma.validationComment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  })
  await writeAudit(projectId, userId, 'validation:comment-delete', {
    validationItemId: itemId,
    commentId,
  })
  return updated
}

export async function unstar(projectId: string, itemId: string, userId: string) {
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  await prisma.validationItemStar
    .delete({ where: { userId_validationItemId: { userId, validationItemId: itemId } } })
    .catch(() => undefined)
  return { starred: false }
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

  const criteria: ValidationCriterion[] = (payload.criteria ?? []).map((c, i) => ({
    id: randomUUID(),
    text: c.text,
    outcome: 'PENDING',
    notes: c.notes,
    orderIndex: i,
  }))

  const created = await createWithUniqueKey(projectId, (tx, key) =>
    tx.validationItem.create({
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
    }),
  )

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

  // Need full requirement payload (incl. requirementId, title) to populate
  // TraceLink display cache without an extra round-trip.
  const reqsFull = await prisma.requirement.findMany({
    where: { id: { in: reqs.map((r) => r.id) } },
    select: { id: true, requirementId: true, title: true },
  })
  const reqMeta = new Map(reqsFull.map((r) => [r.id, r]))

  const created: { id: string; key: string; sourceRequirementId: string }[] = []
  for (const r of reqs) {
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
    const meta = reqMeta.get(r.id)
    const item = await createWithUniqueKey(projectId, async (tx, key) => {
      const newItem = await tx.validationItem.create({
        data: {
          projectId,
          key,
          title: `Validate: ${r.title}`,
          // Description is a plain copy of the source requirement's text — no
          // embedded UUID, no markup. Source linkage lives on the TraceLink
          // row created below so it renders as a real clickable chip in the UI.
          description: r.description ?? null,
          methodType: payload.methodType ?? 'DEMONSTRATION',
          targetMilestone: payload.targetMilestone ?? 'OTHER',
          criteria: criteria as unknown as Prisma.InputJsonValue,
          createdById: userId,
        },
        select: { id: true, key: true },
      })
      // Auto-link the source requirement so it appears in the drawer's
      // "Linked requirements" section and is reachable for Raise CR.
      await tx.traceLink.create({
        data: {
          projectId,
          sourceType: 'ValidationItem',
          sourceId: newItem.id,
          targetType: 'Requirement',
          targetId: r.id,
          linkType: 'validates',
          rationale: 'Auto-linked when this item was created from the requirement.',
          createdBy: userId,
          cachedTargetDisplayId: meta?.requirementId ?? null,
          cachedTargetTitle: meta?.title ?? null,
        },
      })
      return newItem
    })
    created.push({ ...item, sourceRequirementId: r.id })
  }

  await writeAudit(projectId, userId, 'validation:bulk-from-requirements', {
    count: created.length,
  })
  return created
}

// ---- Linked requirements (TraceLink with sourceType=ValidationItem,
// targetType=Requirement, linkType='validates'. ISO/IEC/IEEE 42010
// stakeholder viewpoint reuses the existing trace infrastructure rather
// than introducing a parallel join table.) ----

export async function listLinkedRequirements(projectId: string, itemId: string) {
  const item = await prisma.validationItem.findFirst({
    where: { id: itemId, projectId },
    select: { id: true },
  })
  if (!item) return null
  const links = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'ValidationItem',
      sourceId: itemId,
      targetType: 'Requirement',
      linkType: 'validates',
    },
    orderBy: { createdAt: 'desc' },
  })
  if (links.length === 0) return []
  const targetIds = links.map((l) => l.targetId)
  const reqs = await prisma.requirement.findMany({
    where: { id: { in: targetIds } },
    select: { id: true, requirementId: true, title: true, status: true, deletedAt: true },
  })
  const byId = new Map(reqs.map((r) => [r.id, r]))
  return links.map((l) => ({
    id: l.id,
    requirementId: l.targetId,
    requirement: byId.get(l.targetId) ?? null,
    rationale: l.rationale,
    isSuspect: l.isSuspect,
    createdAt: l.createdAt,
  }))
}

export async function linkRequirement(
  projectId: string,
  itemId: string,
  requirementId: string,
  userId: string,
  rationale?: string,
) {
  const [item, req] = await Promise.all([
    prisma.validationItem.findFirst({ where: { id: itemId, projectId }, select: { id: true } }),
    prisma.requirement.findFirst({
      where: { id: requirementId, projectId, deletedAt: null },
      select: { id: true, title: true, requirementId: true },
    }),
  ])
  if (!item || !req) return null

  const existing = await prisma.traceLink.findFirst({
    where: {
      projectId,
      sourceType: 'ValidationItem',
      sourceId: itemId,
      targetType: 'Requirement',
      targetId: requirementId,
      linkType: 'validates',
    },
  })
  if (existing) return existing

  const link = await prisma.traceLink.create({
    data: {
      projectId,
      sourceType: 'ValidationItem',
      sourceId: itemId,
      targetType: 'Requirement',
      targetId: requirementId,
      linkType: 'validates',
      rationale: rationale ?? null,
      createdBy: userId,
      cachedTargetDisplayId: req.requirementId ?? null,
      cachedTargetTitle: req.title,
    },
  })
  await writeAudit(projectId, userId, 'validation:link-requirement', {
    validationItemId: itemId,
    requirementId,
  })
  return link
}

export async function unlinkRequirement(
  projectId: string,
  itemId: string,
  traceLinkId: string,
  userId: string,
) {
  const link = await prisma.traceLink.findFirst({
    where: {
      id: traceLinkId,
      projectId,
      sourceType: 'ValidationItem',
      sourceId: itemId,
    },
  })
  if (!link) return null
  await prisma.traceLink.delete({ where: { id: traceLinkId } })
  await writeAudit(projectId, userId, 'validation:unlink-requirement', {
    validationItemId: itemId,
    requirementId: link.targetId,
  })
  return { deleted: true }
}

// ---- Bulk operations ----

interface BulkUpdatePayload {
  ids: string[]
  patch: {
    targetMilestone?: string
    status?: string
    deletedAt?: 'now' | 'null' // 'now' = soft delete; 'null' = restore
  }
}

export async function bulkUpdate(
  projectId: string,
  userId: string,
  payload: BulkUpdatePayload,
) {
  if (!Array.isArray(payload.ids) || payload.ids.length === 0)
    throw new Error('ids is required')
  if (payload.ids.length > 200)
    throw new Error('cannot update more than 200 items at once')
  if (
    payload.patch.targetMilestone &&
    !MILESTONES.includes(payload.patch.targetMilestone as ValidationMilestone)
  )
    throw new Error('invalid targetMilestone')
  if (
    payload.patch.status &&
    !STATUSES.includes(payload.patch.status as ValidationStatus)
  )
    throw new Error('invalid status')

  const data: Prisma.ValidationItemUpdateManyMutationInput = {}
  if (payload.patch.targetMilestone) data.targetMilestone = payload.patch.targetMilestone
  if (payload.patch.status) data.status = payload.patch.status
  if (payload.patch.deletedAt === 'now') {
    data.deletedAt = new Date()
    data.deletedById = userId
    data.restoredAt = null
  } else if (payload.patch.deletedAt === 'null') {
    data.deletedAt = null
    data.deletedById = null
    data.deleteReason = null
    data.restoredAt = new Date()
  }

  const result = await prisma.validationItem.updateMany({
    where: { id: { in: payload.ids }, projectId },
    data,
  })
  await writeAudit(projectId, userId, 'validation:bulk-update', {
    count: result.count,
    patch: payload.patch,
  })
  return { count: result.count }
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

// ---- Coverage rollup + gap finder ----

export interface ValidationCoverage {
  total: number
  byStatus: Record<ValidationStatus, number>
  byMilestone: Record<ValidationMilestone, { total: number; validated: number }>
  totals: {
    requirements: number
    requirementsWithValidation: number
    requirementsWithoutValidation: number
  }
  suspectCount: number
}

export async function coverage(projectId: string): Promise<ValidationCoverage> {
  const items = await prisma.validationItem.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      status: true,
      targetMilestone: true,
      updatedAt: true,
    },
  })

  const byStatus = STATUSES.reduce(
    (acc, s) => ({ ...acc, [s]: 0 }),
    {} as Record<ValidationStatus, number>,
  )
  const byMilestone = MILESTONES.reduce(
    (acc, m) => ({ ...acc, [m]: { total: 0, validated: 0 } }),
    {} as Record<ValidationMilestone, { total: number; validated: number }>,
  )
  for (const it of items) {
    if ((STATUSES as readonly string[]).includes(it.status))
      byStatus[it.status as ValidationStatus]++
    const ms = (MILESTONES as readonly string[]).includes(it.targetMilestone)
      ? (it.targetMilestone as ValidationMilestone)
      : 'OTHER'
    byMilestone[ms].total++
    if (it.status === 'VALIDATED') byMilestone[ms].validated++
  }

  // Suspect detection — linked requirement updated after the validation item.
  // We pull TraceLinks scoped to ValidationItem -> Requirement, then bulk-fetch
  // the requirements' updatedAt timestamps.
  const links = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'ValidationItem',
      targetType: 'Requirement',
      linkType: 'validates',
    },
    select: { sourceId: true, targetId: true },
  })
  const itemUpdated = new Map(items.map((i) => [i.id, i.updatedAt]))
  const reqIds = Array.from(new Set(links.map((l) => l.targetId)))
  const reqs =
    reqIds.length === 0
      ? []
      : await prisma.requirement.findMany({
          where: { id: { in: reqIds } },
          select: { id: true, updatedAt: true },
        })
  const reqUpdated = new Map(reqs.map((r) => [r.id, r.updatedAt]))
  const suspectItemIds = new Set<string>()
  for (const l of links) {
    const ru = reqUpdated.get(l.targetId)
    const iu = itemUpdated.get(l.sourceId)
    if (ru && iu && ru > iu) suspectItemIds.add(l.sourceId)
  }

  // Coverage of stakeholder needs: count requirements that DO and DON'T have
  // a TraceLink with linkType='validates' from a ValidationItem.
  const totalReqs = await prisma.requirement.count({
    where: { projectId, deletedAt: null },
  })
  const reqsCoveredIds = new Set(links.map((l) => l.targetId))
  return {
    total: items.length,
    byStatus,
    byMilestone,
    totals: {
      requirements: totalReqs,
      requirementsWithValidation: reqsCoveredIds.size,
      requirementsWithoutValidation: Math.max(0, totalReqs - reqsCoveredIds.size),
    },
    suspectCount: suspectItemIds.size,
  }
}

export async function uncoveredRequirements(projectId: string) {
  const links = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'ValidationItem',
      targetType: 'Requirement',
      linkType: 'validates',
    },
    select: { targetId: true },
  })
  const covered = new Set(links.map((l) => l.targetId))
  const reqs = await prisma.requirement.findMany({
    where: { projectId, deletedAt: null },
    select: {
      id: true,
      requirementId: true,
      title: true,
      priority: true,
      status: true,
      acceptanceCriteria: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  return reqs.filter((r) => !covered.has(r.id))
}

export async function suspectItemIds(projectId: string): Promise<Set<string>> {
  const items = await prisma.validationItem.findMany({
    where: { projectId, deletedAt: null },
    select: { id: true, updatedAt: true },
  })
  const links = await prisma.traceLink.findMany({
    where: {
      projectId,
      sourceType: 'ValidationItem',
      targetType: 'Requirement',
      linkType: 'validates',
    },
    select: { sourceId: true, targetId: true },
  })
  const itemUpdated = new Map(items.map((i) => [i.id, i.updatedAt]))
  const reqIds = Array.from(new Set(links.map((l) => l.targetId)))
  const reqs =
    reqIds.length === 0
      ? []
      : await prisma.requirement.findMany({
          where: { id: { in: reqIds } },
          select: { id: true, updatedAt: true },
        })
  const reqUpdated = new Map(reqs.map((r) => [r.id, r.updatedAt]))
  const out = new Set<string>()
  for (const l of links) {
    const ru = reqUpdated.get(l.targetId)
    const iu = itemUpdated.get(l.sourceId)
    if (ru && iu && ru > iu) out.add(l.sourceId)
  }
  return out
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
