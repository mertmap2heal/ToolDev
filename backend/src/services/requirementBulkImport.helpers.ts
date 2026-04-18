/**
 * Pure phase-1 validation helpers for bulkImportRequirements (#222).
 *
 * These functions perform NO database writes. They take a row + pre-fetched
 * lookup context and return either a normalized record ready for tx.create /
 * tx.update, or a list of validation errors for the per-row errors[] array.
 *
 * Phase-2 (#226) calls these in a loop to build validCreates[] / validUpdates[],
 * then issues all writes inside one prisma.$transaction so any failure rolls
 * back the entire batch.
 */
import type { Requirement } from '@prisma/client'

export type CreateRowInput = Record<string, unknown> & {
  title?: string
  description?: string
  requirementId?: string
  parentId?: string | null
  priority?: string
  status?: string
  stage?: string
  owner?: string | null
  category?: string | null
  source?: string | null
  verificationMethod?: string | null
  acceptanceCriteria?: string | null
  tags?: string[]
  requirementType?: string | null
  requirementLevel?: string | null
  risk?: string | null
  complexity?: string | null
  rationale?: string | null
  assumptions?: string | null
  dependencies?: string[]
  conflicts?: string[]
  stakeholders?: string[]
  verificationStatus?: string | null
  verificationDate?: string | null
  verificationNotes?: string | null
}

export type UpdateRowInput = {
  id: string
  data: CreateRowInput
}

export type CreateRowContext = {
  /** projectId the import is scoped to. */
  projectId: string
  /** Set of requirementIds that already exist in the project (lowercased). */
  existingRequirementIds: Set<string>
  /** Set of requirement UUIDs in the project — for parentId existence check. */
  existingRequirementUuids: Set<string>
  /** Lazily-resolved requirementId for rows that did not bring their own. */
  generateRequirementId: () => Promise<string>
  /** Walks parent chain to detect circular references. */
  checkCircularReference: (requirementId: string, newParentId: string | null | undefined) => Promise<boolean>
}

export type UpdateRowContext = {
  projectId: string
  /** Map of requirement UUID -> existing row, for the rows being updated. */
  existingByUuid: Map<string, Requirement>
  existingRequirementUuids: Set<string>
  checkCircularReference: (requirementId: string, newParentId: string | null | undefined) => Promise<boolean>
}

export type ValidatedCreate = {
  rowIndex: number
  data: Record<string, unknown>
}

export type ValidatedUpdate = {
  rowIndex: number
  id: string
  existing: Requirement
  data: Record<string, unknown>
}

export type RowError = { row: number; errors: string[] }

/**
 * Validate a single create row. Returns either:
 *  - { valid: ValidatedCreate } — ready to be passed to tx.requirement.create
 *  - { invalid: string[] }      — errors to push onto the per-row errors array
 */
export async function validateCreateRow(
  row: CreateRowInput,
  rowIndex: number,
  ctx: CreateRowContext,
): Promise<{ valid: ValidatedCreate } | { invalid: string[] }> {
  if (!row.title || !row.description) {
    return { invalid: ['Title and description are required'] }
  }

  if (row.requirementId) {
    if (ctx.existingRequirementIds.has(row.requirementId.toLowerCase())) {
      return { invalid: [`Requirement ID "${row.requirementId}" already exists`] }
    }
  }

  if (row.parentId) {
    if (!ctx.existingRequirementUuids.has(row.parentId)) {
      return { invalid: ['Parent requirement not found'] }
    }
    const hasCircular = await ctx.checkCircularReference(row.parentId, row.parentId)
    if (hasCircular) {
      return { invalid: ['Circular reference detected'] }
    }
  }

  const requirementId = row.requirementId ?? (await ctx.generateRequirementId())

  return {
    valid: {
      rowIndex,
      data: {
        projectId: ctx.projectId,
        requirementId,
        title: row.title,
        description: row.description,
        priority: row.priority || 'medium',
        status: row.status || 'draft',
        stage: row.stage || '',
        owner: row.owner || null,
        category: row.category || null,
        source: row.source || null,
        verificationMethod: row.verificationMethod || null,
        acceptanceCriteria: row.acceptanceCriteria || null,
        tags: row.tags || [],
        parentId: row.parentId || null,
        requirementType: row.requirementType || null,
        requirementLevel: row.requirementLevel || null,
        risk: row.risk || null,
        complexity: row.complexity || null,
        rationale: row.rationale || null,
        assumptions: row.assumptions || null,
        dependencies: row.dependencies || [],
        conflicts: row.conflicts || [],
        stakeholders: row.stakeholders || [],
        verificationStatus: row.verificationStatus || null,
        verificationDate: row.verificationDate ? new Date(row.verificationDate) : null,
        verificationNotes: row.verificationNotes || null,
      },
    },
  }
}

/**
 * Validate a single update row.
 */
export async function validateUpdateRow(
  row: UpdateRowInput,
  rowIndex: number,
  ctx: UpdateRowContext,
): Promise<{ valid: ValidatedUpdate } | { invalid: string[] }> {
  const existing = ctx.existingByUuid.get(row.id)
  if (!existing) {
    return { invalid: ['Requirement not found'] }
  }

  const updateData = row.data ?? {}

  if (updateData.parentId !== undefined && updateData.parentId !== existing.parentId) {
    if (updateData.parentId) {
      if (!ctx.existingRequirementUuids.has(updateData.parentId)) {
        return { invalid: ['Parent requirement not found'] }
      }
      const hasCircular = await ctx.checkCircularReference(existing.id, updateData.parentId)
      if (hasCircular) {
        return { invalid: ['Circular reference detected'] }
      }
    }
  }

  return {
    valid: {
      rowIndex,
      id: existing.id,
      existing,
      data: {
        title: updateData.title !== undefined ? updateData.title : existing.title,
        description: updateData.description !== undefined ? updateData.description : existing.description,
        priority: updateData.priority !== undefined ? updateData.priority : existing.priority,
        status: updateData.status !== undefined ? updateData.status : existing.status,
        stage: updateData.stage !== undefined ? updateData.stage : existing.stage,
        owner: updateData.owner !== undefined ? (updateData.owner || null) : existing.owner,
        category: updateData.category !== undefined ? (updateData.category || null) : existing.category,
        source: updateData.source !== undefined ? (updateData.source || null) : existing.source,
        verificationMethod: updateData.verificationMethod !== undefined ? (updateData.verificationMethod || null) : existing.verificationMethod,
        acceptanceCriteria: updateData.acceptanceCriteria !== undefined ? (updateData.acceptanceCriteria || null) : existing.acceptanceCriteria,
        tags: updateData.tags !== undefined ? updateData.tags : existing.tags,
        parentId: updateData.parentId !== undefined ? (updateData.parentId || null) : existing.parentId,
        requirementType: updateData.requirementType !== undefined ? (updateData.requirementType || null) : existing.requirementType,
        requirementLevel: updateData.requirementLevel !== undefined ? (updateData.requirementLevel || null) : existing.requirementLevel,
        risk: updateData.risk !== undefined ? (updateData.risk || null) : existing.risk,
        complexity: updateData.complexity !== undefined ? (updateData.complexity || null) : existing.complexity,
        rationale: updateData.rationale !== undefined ? (updateData.rationale || null) : existing.rationale,
        assumptions: updateData.assumptions !== undefined ? (updateData.assumptions || null) : existing.assumptions,
        dependencies: updateData.dependencies !== undefined ? updateData.dependencies : existing.dependencies,
        conflicts: updateData.conflicts !== undefined ? updateData.conflicts : existing.conflicts,
        stakeholders: updateData.stakeholders !== undefined ? updateData.stakeholders : existing.stakeholders,
        verificationStatus: updateData.verificationStatus !== undefined ? (updateData.verificationStatus || null) : existing.verificationStatus,
        verificationDate: updateData.verificationDate !== undefined
          ? (updateData.verificationDate ? new Date(updateData.verificationDate) : null)
          : existing.verificationDate,
        verificationNotes: updateData.verificationNotes !== undefined ? (updateData.verificationNotes || null) : existing.verificationNotes,
      },
    },
  }
}
