// NX-8 (#463) — Stakeholders backend build-out: governance business logic.
//
// Five governance models: Committee, CommitteeMember, CommitteeDefaultReviewer,
// RaciEntry, RaciAssignment. Services throw plain Errors carrying `statusCode`;
// controllers translate them to HTTP responses (per
// .claude/kb/backend-patterns.md). Prisma queries live only here.
//
// Two correctness rules Postgres cannot express are enforced here, inside a
// `prisma.$transaction`:
//   - the RaciEntry polymorphic `subjectId` must resolve to a live project row
//     for the four model-backed subject types (a bad reference can never be
//     created);
//   - a RaciEntry needs >=1 Accountable assignment — 0 hard-fails 422, >1
//     succeeds with a `warnings[]` envelope entry.
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

// --- Controlled vocabularies -----------------------------------------------

/** The five governance-body kinds. */
export const COMMITTEE_KINDS = [
  'CCB',
  'ReviewBoard',
  'AuthorityInterface',
  'SupplierPanel',
  'ProgramGovernance',
] as const
export type CommitteeKind = (typeof COMMITTEE_KINDS)[number]

/**
 * A per-committee organisational seat. This is a FOURTH role concept — distinct
 * from EngineeringRole (discipline), AdminRole (permission), and the
 * Stakeholders simulation role.
 */
export const COMMITTEE_ROLES = [
  'Chair',
  'Voting',
  'NonVoting',
  'Observer',
  'Secretary',
  'Auditor',
] as const
export type CommitteeRole = (typeof COMMITTEE_ROLES)[number]

/** Aligned to the R-4 BaselineRoot.kind vocabulary. */
export const BASELINE_KINDS = ['VER', 'CERT', 'PARAM', 'VALIDATION', 'CM'] as const
export type BaselineKind = (typeof BASELINE_KINDS)[number]

/**
 * RACI subject types. The first four resolve to a live Prisma row; `Deliverable`
 * is a free-string vocabulary value with no model (a TraceLink-style polymorphic
 * kind with no table).
 */
export const RACI_SUBJECT_TYPES = [
  'SystemFunction',
  'Requirement',
  'CertObjective',
  'Component',
  'Deliverable',
] as const
export type RaciSubjectType = (typeof RACI_SUBJECT_TYPES)[number]

/** The four RACI letters. */
export const RACI_LETTERS = ['R', 'A', 'C', 'I'] as const
export type RaciLetter = (typeof RACI_LETTERS)[number]

// --- Errors -----------------------------------------------------------------

/** A 4xx domain error — the controller maps `statusCode` to the HTTP status. */
export class StakeholderError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 400) {
    super(message)
    this.name = 'StakeholderError'
    this.statusCode = statusCode
  }
}

// --- Audit ------------------------------------------------------------------

/**
 * Write one central AuditLog row (R-8). `action` follows the `<module>:<kebab>`
 * convention; `details` is a structured object written to `detailsJson` (never
 * JSON.stringify). Pass a transaction client to keep the audit row atomic with
 * the data write.
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

// --- DTOs -------------------------------------------------------------------

export interface CreateCommitteeInput {
  name?: string
  kind?: string
  meetingFrequency?: string | null
  nextMeetingAt?: string | Date | null
  notes?: string | null
}

export interface UpdateCommitteeInput {
  name?: string
  kind?: string
  meetingFrequency?: string | null
  nextMeetingAt?: string | Date | null
  notes?: string | null
}

export interface CreateCommitteeMemberInput {
  userId?: string
  committeeRole?: string
  validFrom?: string | Date | null
  validUntil?: string | Date | null
}

export interface UpdateCommitteeMemberInput {
  committeeRole?: string
  validFrom?: string | Date | null
  validUntil?: string | Date | null
}

export interface CreateRaciEntryInput {
  subjectType?: string
  subjectId?: string
  riskFlag?: boolean
  notes?: string | null
}

export interface UpdateRaciEntryInput {
  riskFlag?: boolean
  notes?: string | null
}

export interface RaciAssignmentInput {
  userId: string
  letter: string
}

// --- Helpers ----------------------------------------------------------------

function parseDate(v: string | Date | null | undefined): Date | null {
  if (v == null || v === '') return null
  const d = v instanceof Date ? v : new Date(v)
  if (Number.isNaN(d.getTime())) throw new StakeholderError('Invalid date value')
  return d
}

/** Project user ids: accepted team members + the project owner. */
async function getProjectUserIds(projectId: string): Promise<Set<string>> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      userId: true,
      teamMembers: { where: { status: 'accepted' }, select: { userId: true } },
    },
  })
  const ids = new Set<string>()
  if (!project) return ids
  ids.add(project.userId)
  for (const m of project.teamMembers) ids.add(m.userId)
  return ids
}

/**
 * Resolve a RACI subject against the live, project-scoped table named by
 * `subjectType`. `Deliverable` has no model — its `subjectId` is accepted as a
 * free string. Throws 422 if a model-backed subject cannot be resolved.
 */
async function assertSubjectResolves(
  projectId: string,
  subjectType: RaciSubjectType,
  subjectId: string,
): Promise<void> {
  if (subjectType === 'Deliverable') return
  let row: { id: string } | null = null
  if (subjectType === 'SystemFunction') {
    row = await prisma.systemFunction.findFirst({ where: { id: subjectId, projectId }, select: { id: true } })
  } else if (subjectType === 'Requirement') {
    row = await prisma.requirement.findFirst({ where: { id: subjectId, projectId }, select: { id: true } })
  } else if (subjectType === 'CertObjective') {
    row = await prisma.certObjective.findFirst({ where: { id: subjectId, projectId }, select: { id: true } })
  } else if (subjectType === 'Component') {
    row = await prisma.component.findFirst({ where: { id: subjectId, projectId }, select: { id: true } })
  }
  if (!row) {
    throw new StakeholderError(
      `No live ${subjectType} with id ${subjectId} in this project.`,
      422,
    )
  }
}

// =============================================================================
// Committee
// =============================================================================

/** List a project's committees (members + default reviewers included). */
export async function listCommittees(projectId: string) {
  return prisma.committee.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: {
      members: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      defaultReviewers: { orderBy: { baselineKind: 'asc' } },
    },
  })
}

/** A single committee scoped to the project, or null. */
export async function getCommittee(projectId: string, id: string) {
  return prisma.committee.findFirst({
    where: { id, projectId, deletedAt: null },
    include: {
      members: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      defaultReviewers: { orderBy: { baselineKind: 'asc' } },
    },
  })
}

/** Create a committee. `authorType` defaults to `human` (R-1). */
export async function createCommittee(
  projectId: string,
  userId: string,
  input: CreateCommitteeInput,
) {
  const name = input.name?.trim()
  if (!name) throw new StakeholderError('name is required')
  if (!COMMITTEE_KINDS.includes(input.kind as CommitteeKind)) {
    throw new StakeholderError(`kind must be one of: ${COMMITTEE_KINDS.join(', ')}`)
  }
  const nextMeetingAt = parseDate(input.nextMeetingAt)

  return prisma.$transaction(async (tx) => {
    const row = await tx.committee.create({
      data: {
        projectId,
        name,
        kind: input.kind as CommitteeKind,
        meetingFrequency: input.meetingFrequency?.trim() || null,
        nextMeetingAt,
        notes: input.notes?.trim() || null,
      },
      include: {
        members: { where: { deletedAt: null } },
        defaultReviewers: true,
      },
    })
    await writeAudit(tx, projectId, userId, 'committee:create', {
      committeeId: row.id,
      name: row.name,
      kind: row.kind,
    })
    return row
  })
}

/** Update a committee. Returns null if it does not exist in the project. */
export async function updateCommittee(
  projectId: string,
  id: string,
  userId: string,
  input: UpdateCommitteeInput,
) {
  if (input.kind !== undefined && !COMMITTEE_KINDS.includes(input.kind as CommitteeKind)) {
    throw new StakeholderError(`kind must be one of: ${COMMITTEE_KINDS.join(', ')}`)
  }
  if (input.name !== undefined && !input.name.trim()) {
    throw new StakeholderError('name cannot be empty')
  }
  const nextMeetingAt = input.nextMeetingAt !== undefined ? parseDate(input.nextMeetingAt) : undefined

  return prisma.$transaction(async (tx) => {
    const existing = await tx.committee.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null

    const data: Prisma.CommitteeUpdateInput = {}
    if (input.name !== undefined) data.name = input.name.trim()
    if (input.kind !== undefined) data.kind = input.kind
    if (input.meetingFrequency !== undefined) data.meetingFrequency = input.meetingFrequency?.trim() || null
    if (nextMeetingAt !== undefined) data.nextMeetingAt = nextMeetingAt
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null

    const row = await tx.committee.update({
      where: { id },
      data,
      include: {
        members: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        defaultReviewers: { orderBy: { baselineKind: 'asc' } },
      },
    })
    await writeAudit(tx, projectId, userId, 'committee:update', {
      committeeId: row.id,
      name: row.name,
      changed: Object.keys(data),
    })
    return row
  })
}

/** Soft-delete a committee. Returns null if it does not exist in the project. */
export async function deleteCommittee(projectId: string, id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.committee.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null
    const row = await tx.committee.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    await writeAudit(tx, projectId, userId, 'committee:delete', {
      committeeId: row.id,
      name: row.name,
    })
    return row
  })
}

// =============================================================================
// CommitteeMember
// =============================================================================

/** Add a member seat to a committee. */
export async function addCommitteeMember(
  projectId: string,
  committeeId: string,
  userId: string,
  input: CreateCommitteeMemberInput,
) {
  const memberUserId = input.userId?.trim()
  if (!memberUserId) throw new StakeholderError('userId is required')
  if (!COMMITTEE_ROLES.includes(input.committeeRole as CommitteeRole)) {
    throw new StakeholderError(`committeeRole must be one of: ${COMMITTEE_ROLES.join(', ')}`)
  }
  const validFrom = parseDate(input.validFrom)
  const validUntil = parseDate(input.validUntil)

  const allowed = await getProjectUserIds(projectId)
  if (!allowed.has(memberUserId)) {
    throw new StakeholderError('The member must be a project member', 422)
  }

  return prisma.$transaction(async (tx) => {
    const committee = await tx.committee.findFirst({ where: { id: committeeId, projectId } })
    if (!committee || committee.deletedAt) {
      throw new StakeholderError('Committee not found', 404)
    }
    // A soft-deleted seat for the same user must be revived, not duplicated —
    // the @@unique([committeeId, userId]) constraint forbids a second row.
    const existing = await tx.committeeMember.findUnique({
      where: { committeeId_userId: { committeeId, userId: memberUserId } },
    })
    let row
    if (existing) {
      if (!existing.deletedAt) {
        throw new StakeholderError('That user is already a member of this committee', 409)
      }
      row = await tx.committeeMember.update({
        where: { id: existing.id },
        data: {
          committeeRole: input.committeeRole as CommitteeRole,
          validFrom,
          validUntil,
          deletedAt: null,
        },
      })
    } else {
      row = await tx.committeeMember.create({
        data: {
          committeeId,
          userId: memberUserId,
          committeeRole: input.committeeRole as CommitteeRole,
          validFrom,
          validUntil,
        },
      })
    }
    await writeAudit(tx, projectId, userId, 'committee-member:add', {
      committeeId,
      memberUserId,
      committeeRole: row.committeeRole,
    })
    return row
  })
}

/** Update a committee member seat. Returns null if not found. */
export async function updateCommitteeMember(
  projectId: string,
  committeeId: string,
  memberId: string,
  userId: string,
  input: UpdateCommitteeMemberInput,
) {
  if (
    input.committeeRole !== undefined &&
    !COMMITTEE_ROLES.includes(input.committeeRole as CommitteeRole)
  ) {
    throw new StakeholderError(`committeeRole must be one of: ${COMMITTEE_ROLES.join(', ')}`)
  }
  const validFrom = input.validFrom !== undefined ? parseDate(input.validFrom) : undefined
  const validUntil = input.validUntil !== undefined ? parseDate(input.validUntil) : undefined

  return prisma.$transaction(async (tx) => {
    const committee = await tx.committee.findFirst({ where: { id: committeeId, projectId } })
    if (!committee || committee.deletedAt) return null
    const existing = await tx.committeeMember.findFirst({
      where: { id: memberId, committeeId },
    })
    if (!existing || existing.deletedAt) return null

    const data: Prisma.CommitteeMemberUpdateInput = {}
    if (input.committeeRole !== undefined) data.committeeRole = input.committeeRole
    if (validFrom !== undefined) data.validFrom = validFrom
    if (validUntil !== undefined) data.validUntil = validUntil

    const row = await tx.committeeMember.update({ where: { id: memberId }, data })
    await writeAudit(tx, projectId, userId, 'committee-member:update', {
      committeeId,
      memberId,
      committeeRole: row.committeeRole,
      changed: Object.keys(data),
    })
    return row
  })
}

/** Soft-delete (remove) a committee member seat. Returns null if not found. */
export async function removeCommitteeMember(
  projectId: string,
  committeeId: string,
  memberId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const committee = await tx.committee.findFirst({ where: { id: committeeId, projectId } })
    if (!committee || committee.deletedAt) return null
    const existing = await tx.committeeMember.findFirst({
      where: { id: memberId, committeeId },
    })
    if (!existing || existing.deletedAt) return null
    const row = await tx.committeeMember.update({
      where: { id: memberId },
      data: { deletedAt: new Date() },
    })
    await writeAudit(tx, projectId, userId, 'committee-member:remove', {
      committeeId,
      memberId,
      memberUserId: existing.userId,
    })
    return row
  })
}

// =============================================================================
// CommitteeDefaultReviewer
// =============================================================================

/** Set (wire) a default-reviewer baseline-kind mapping for a committee. */
export async function setDefaultReviewer(
  projectId: string,
  committeeId: string,
  userId: string,
  baselineKind: string,
) {
  if (!BASELINE_KINDS.includes(baselineKind as BaselineKind)) {
    throw new StakeholderError(`baselineKind must be one of: ${BASELINE_KINDS.join(', ')}`)
  }
  return prisma.$transaction(async (tx) => {
    const committee = await tx.committee.findFirst({ where: { id: committeeId, projectId } })
    if (!committee || committee.deletedAt) {
      throw new StakeholderError('Committee not found', 404)
    }
    const existing = await tx.committeeDefaultReviewer.findUnique({
      where: { committeeId_baselineKind: { committeeId, baselineKind } },
    })
    if (existing) {
      throw new StakeholderError(
        `This committee is already a default reviewer for ${baselineKind}`,
        409,
      )
    }
    const row = await tx.committeeDefaultReviewer.create({
      data: { committeeId, baselineKind },
    })
    await writeAudit(tx, projectId, userId, 'committee-default-reviewer:set', {
      committeeId,
      baselineKind,
    })
    return row
  })
}

/** Unset (remove) a default-reviewer mapping. Returns null if not found. */
export async function unsetDefaultReviewer(
  projectId: string,
  committeeId: string,
  reviewerId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const committee = await tx.committee.findFirst({ where: { id: committeeId, projectId } })
    if (!committee || committee.deletedAt) return null
    const existing = await tx.committeeDefaultReviewer.findFirst({
      where: { id: reviewerId, committeeId },
    })
    if (!existing) return null
    await tx.committeeDefaultReviewer.delete({ where: { id: reviewerId } })
    await writeAudit(tx, projectId, userId, 'committee-default-reviewer:unset', {
      committeeId,
      baselineKind: existing.baselineKind,
    })
    return existing
  })
}

// =============================================================================
// RaciEntry / RaciAssignment
// =============================================================================

/** List a project's RACI entries (assignments included). */
export async function listRaciEntries(projectId: string) {
  return prisma.raciEntry.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { assignments: { orderBy: { createdAt: 'asc' } } },
  })
}

/** A single RACI entry scoped to the project, or null. */
export async function getRaciEntry(projectId: string, id: string) {
  return prisma.raciEntry.findFirst({
    where: { id, projectId, deletedAt: null },
    include: { assignments: { orderBy: { createdAt: 'asc' } } },
  })
}

/** Count the Accountable assignments on a RACI entry within a transaction. */
async function countAccountable(
  tx: Prisma.TransactionClient,
  raciId: string,
): Promise<number> {
  return tx.raciAssignment.count({ where: { raciId, letter: 'A' } })
}

/** The doctrine warning for >1 Accountable. */
const MULTI_ACCOUNTABLE_WARNING =
  'Multiple Accountable assigned — RACI doctrine prefers exactly one.'

/**
 * The result of a RACI write — the entry plus any soft `warnings[]`. A 0-Accountable
 * write hard-fails 422 before this is ever returned.
 */
export interface RaciWriteResult {
  entry: Awaited<ReturnType<typeof getRaciEntry>>
  warnings: string[]
}

/**
 * Create a RACI entry with its initial assignments. Enforces, inside one
 * transaction: the subject resolves to a live project row (model-backed types);
 * a unique RACI per subject; and >=1 Accountable. 0 Accountable -> 422; >1 ->
 * succeeds with a warning.
 */
export async function createRaciEntry(
  projectId: string,
  userId: string,
  input: CreateRaciEntryInput,
  assignments: RaciAssignmentInput[],
): Promise<RaciWriteResult> {
  if (!RACI_SUBJECT_TYPES.includes(input.subjectType as RaciSubjectType)) {
    throw new StakeholderError(`subjectType must be one of: ${RACI_SUBJECT_TYPES.join(', ')}`)
  }
  const subjectType = input.subjectType as RaciSubjectType
  const subjectId = input.subjectId?.trim()
  if (!subjectId) throw new StakeholderError('subjectId is required')

  const normalised = validateAssignments(assignments)
  await assertSubjectResolves(projectId, subjectType, subjectId)

  // Every assigned user must be a project member.
  const allowed = await getProjectUserIds(projectId)
  for (const a of normalised) {
    if (!allowed.has(a.userId)) {
      throw new StakeholderError('Every RACI assignee must be a project member', 422)
    }
  }

  const accountableCount = normalised.filter((a) => a.letter === 'A').length
  if (accountableCount === 0) {
    throw new StakeholderError('A RACI entry needs at least one Accountable.', 422)
  }

  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.raciEntry.findUnique({
      where: { projectId_subjectType_subjectId: { projectId, subjectType, subjectId } },
    })
    if (existing) {
      if (!existing.deletedAt) {
        throw new StakeholderError('A RACI entry already exists for that subject', 409)
      }
      // Revive a soft-deleted entry — the unique constraint forbids a second row.
      await tx.raciAssignment.deleteMany({ where: { raciId: existing.id } })
      await tx.raciEntry.update({
        where: { id: existing.id },
        data: { deletedAt: null, riskFlag: input.riskFlag ?? false, notes: input.notes?.trim() || null },
      })
      await tx.raciAssignment.createMany({
        data: normalised.map((a) => ({ raciId: existing.id, userId: a.userId, letter: a.letter })),
      })
      await writeAudit(tx, projectId, userId, 'raci:create', {
        raciId: existing.id,
        subjectType,
        subjectId,
        revived: true,
      })
      return tx.raciEntry.findUnique({
        where: { id: existing.id },
        include: { assignments: { orderBy: { createdAt: 'asc' } } },
      })
    }

    const row = await tx.raciEntry.create({
      data: {
        projectId,
        subjectType,
        subjectId,
        riskFlag: input.riskFlag ?? false,
        notes: input.notes?.trim() || null,
      },
    })
    await tx.raciAssignment.createMany({
      data: normalised.map((a) => ({ raciId: row.id, userId: a.userId, letter: a.letter })),
    })
    await writeAudit(tx, projectId, userId, 'raci:create', {
      raciId: row.id,
      subjectType,
      subjectId,
      assignmentCount: normalised.length,
    })
    return tx.raciEntry.findUnique({
      where: { id: row.id },
      include: { assignments: { orderBy: { createdAt: 'asc' } } },
    })
  })

  return {
    entry,
    warnings: accountableCount > 1 ? [MULTI_ACCOUNTABLE_WARNING] : [],
  }
}

/** Update a RACI entry's metadata (riskFlag / notes). Returns null if not found. */
export async function updateRaciEntry(
  projectId: string,
  id: string,
  userId: string,
  input: UpdateRaciEntryInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.raciEntry.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null
    const data: Prisma.RaciEntryUpdateInput = {}
    if (input.riskFlag !== undefined) data.riskFlag = input.riskFlag
    if (input.notes !== undefined) data.notes = input.notes?.trim() || null
    const row = await tx.raciEntry.update({
      where: { id },
      data,
      include: { assignments: { orderBy: { createdAt: 'asc' } } },
    })
    await writeAudit(tx, projectId, userId, 'raci:update', {
      raciId: row.id,
      changed: Object.keys(data),
    })
    return row
  })
}

/** Soft-delete a RACI entry. Returns null if not found. */
export async function deleteRaciEntry(projectId: string, id: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.raciEntry.findFirst({ where: { id, projectId } })
    if (!existing || existing.deletedAt) return null
    const row = await tx.raciEntry.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
    await writeAudit(tx, projectId, userId, 'raci:delete', {
      raciId: row.id,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
    })
    return row
  })
}

/** Validate + dedupe a RACI assignment list. */
function validateAssignments(assignments: RaciAssignmentInput[]): RaciAssignmentInput[] {
  if (!Array.isArray(assignments)) {
    throw new StakeholderError('assignments must be an array')
  }
  const seen = new Set<string>()
  const out: RaciAssignmentInput[] = []
  for (const a of assignments) {
    const userId = (a?.userId ?? '').trim()
    const letter = a?.letter
    if (!userId) throw new StakeholderError('Each assignment needs a userId')
    if (!RACI_LETTERS.includes(letter as RaciLetter)) {
      throw new StakeholderError(`Each assignment letter must be one of: ${RACI_LETTERS.join(', ')}`)
    }
    const key = `${userId}:${letter}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ userId, letter })
  }
  return out
}

/**
 * Replace the full assignment set of a RACI entry. The whole set is rewritten
 * in one transaction, then re-counted: 0 Accountable -> 422 (the transaction
 * rolls back); >1 -> succeeds with a warning. Returns null if the entry is not
 * found.
 */
export async function setRaciAssignments(
  projectId: string,
  raciId: string,
  userId: string,
  assignments: RaciAssignmentInput[],
): Promise<RaciWriteResult | null> {
  const normalised = validateAssignments(assignments)

  // Every assignee must be a project member.
  const allowed = await getProjectUserIds(projectId)
  for (const a of normalised) {
    if (!allowed.has(a.userId)) {
      throw new StakeholderError('Every RACI assignee must be a project member', 422)
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.raciEntry.findFirst({ where: { id: raciId, projectId } })
    if (!existing || existing.deletedAt) return null

    await tx.raciAssignment.deleteMany({ where: { raciId } })
    if (normalised.length > 0) {
      await tx.raciAssignment.createMany({
        data: normalised.map((a) => ({ raciId, userId: a.userId, letter: a.letter })),
      })
    }
    const accountableCount = await countAccountable(tx, raciId)
    if (accountableCount === 0) {
      // Rolls the transaction back — the old assignments are restored.
      throw new StakeholderError('A RACI entry needs at least one Accountable.', 422)
    }
    await writeAudit(tx, projectId, userId, 'raci-assignment:set', {
      raciId,
      assignmentCount: normalised.length,
    })
    const entry = await tx.raciEntry.findUnique({
      where: { id: raciId },
      include: { assignments: { orderBy: { createdAt: 'asc' } } },
    })
    return { entry, accountableCount }
  })

  if (result === null) return null
  return {
    entry: result.entry,
    warnings: result.accountableCount > 1 ? [MULTI_ACCOUNTABLE_WARNING] : [],
  }
}
