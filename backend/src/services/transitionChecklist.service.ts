import { prisma } from '../lib/prisma'
import { formatIssueKey, getMaxIssueSequenceNumber, isIssueKeyUniqueViolation } from '../lib/issueKey'
import { Prisma } from '@prisma/client'

export interface CreateChecklistInput {
  projectId: string
  name: string
  description?: string
  createdBy?: string
  items?: {
    label: string
    description?: string
    itemType?: string
    validationConfig?: Record<string, unknown>
    isRequired?: boolean
    sortOrder?: number
  }[]
}

export interface UpdateChecklistInput {
  name?: string
  description?: string
  isActive?: boolean
  items?: {
    id?: string
    label: string
    description?: string
    itemType?: string
    validationConfig?: Record<string, unknown>
    isRequired?: boolean
    sortOrder?: number
  }[]
}

export interface CreateAssignmentInput {
  checklistId: string
  projectId: string
  lifecycleId: string
  fromStatusId: string
  toStatusId: string
  itemType?: string
}

export interface SubmitCompletionInput {
  checklistAssignmentId: string
  entityType: string
  entityId: string
  projectId: string
  completedById: string
  overriddenById?: string
  responses: {
    checklistItemId: string
    value: Record<string, unknown>
    passed: boolean
    respondedById?: string
  }[]
}

function userCanOverrideChecklist(user: { role: string | null; email: string | null } | null): boolean {
  if (!user) return false
  if (user.role === 'SUPERIOR_ADMIN' || user.role === 'COMPANY_ADMIN') return true
  const list = process.env.ADMIN_EMAILS
  if (list && user.email) {
    const emails = list.split(',').map((e) => e.trim().toLowerCase())
    if (emails.includes(user.email.toLowerCase())) return true
  }
  return false
}

export interface CreateChecklistItemIssueInput {
  checklistItemId: string
  responseId?: string
  entityType: string
  entityId: string
  projectId: string
  createdBy?: string
  title: string
  description: string
  priority?: string
}

const checklistInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  assignments: true,
}

export const transitionChecklistService = {
  async listByProject(projectId: string) {
    return prisma.transitionChecklist.findMany({
      where: { projectId },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        assignments: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async getById(checklistId: string) {
    return prisma.transitionChecklist.findUnique({
      where: { id: checklistId },
      include: checklistInclude,
    })
  },

  async create(input: CreateChecklistInput) {
    return prisma.transitionChecklist.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description,
        createdBy: input.createdBy,
        items: input.items?.length
          ? {
              create: input.items.map((item, idx) => ({
                label: item.label,
                description: item.description,
                itemType: item.itemType ?? 'BOOLEAN',
                validationConfig: (item.validationConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                isRequired: item.isRequired ?? true,
                sortOrder: item.sortOrder ?? idx,
              })),
            }
          : undefined,
      },
      include: checklistInclude,
    })
  },

  async update(checklistId: string, input: UpdateChecklistInput) {
    const existing = await prisma.transitionChecklist.findUnique({
      where: { id: checklistId },
      include: { items: true },
    })
    if (!existing) throw new Error('Checklist not found')

    await this.snapshotVersion(checklistId, existing.version, existing.createdBy)

    return prisma.$transaction(async (tx) => {
      if (input.items) {
        const existingIds = existing.items.map((i) => i.id)
        const incomingIds = input.items.filter((i) => i.id).map((i) => i.id!)

        const toDelete = existingIds.filter((id) => !incomingIds.includes(id))
        if (toDelete.length) {
          await tx.transitionChecklistItem.deleteMany({
            where: { id: { in: toDelete } },
          })
        }

        for (const item of input.items) {
          if (item.id && existingIds.includes(item.id)) {
            await tx.transitionChecklistItem.update({
              where: { id: item.id },
              data: {
                label: item.label,
                description: item.description,
                itemType: item.itemType ?? 'BOOLEAN',
                validationConfig: (item.validationConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                isRequired: item.isRequired ?? true,
                sortOrder: item.sortOrder,
              },
            })
          } else {
            await tx.transitionChecklistItem.create({
              data: {
                checklistId,
                label: item.label,
                description: item.description,
                itemType: item.itemType ?? 'BOOLEAN',
                validationConfig: (item.validationConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
                isRequired: item.isRequired ?? true,
                sortOrder: item.sortOrder ?? 0,
              },
            })
          }
        }
      }

      return tx.transitionChecklist.update({
        where: { id: checklistId },
        data: {
          name: input.name,
          description: input.description,
          isActive: input.isActive,
          version: { increment: 1 },
        },
        include: checklistInclude,
      })
    })
  },

  async deleteChecklist(checklistId: string) {
    return prisma.transitionChecklist.delete({
      where: { id: checklistId },
    })
  },

  async createAssignment(input: CreateAssignmentInput) {
    return prisma.checklistAssignment.create({
      data: {
        checklistId: input.checklistId,
        projectId: input.projectId,
        lifecycleId: input.lifecycleId,
        fromStatusId: input.fromStatusId,
        toStatusId: input.toStatusId,
        itemType: input.itemType ?? 'Requirement',
      },
      include: { checklist: { include: { items: { orderBy: { sortOrder: 'asc' } } } } },
    })
  },

  async deleteAssignment(assignmentId: string) {
    return prisma.checklistAssignment.delete({
      where: { id: assignmentId },
    })
  },

  async getChecklistsForTransition(
    projectId: string,
    lifecycleId: string,
    fromStatusId: string,
    toStatusId: string,
    itemType: string
  ) {
    const assignments = await prisma.checklistAssignment.findMany({
      where: {
        projectId,
        lifecycleId,
        fromStatusId,
        toStatusId,
        itemType,
        checklist: { isActive: true },
      },
      include: {
        checklist: {
          include: { items: { orderBy: { sortOrder: 'asc' } } },
        },
      },
    })

    return assignments.map((a) => ({
      assignmentId: a.id,
      checklist: a.checklist,
    }))
  },

  async submitCompletion(input: SubmitCompletionInput) {
    const assignment = await prisma.checklistAssignment.findUnique({
      where: { id: input.checklistAssignmentId },
      include: {
        checklist: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
      },
    })
    if (!assignment || assignment.projectId !== input.projectId) {
      throw new Error('[ChecklistValidation] Invalid checklist assignment for this project')
    }

    const validItemIds = new Set(assignment.checklist.items.map((i) => i.id))
    const requiredItems = assignment.checklist.items.filter((i) => i.isRequired)
    const seenItemIds = new Set<string>()
    for (const r of input.responses) {
      if (!validItemIds.has(r.checklistItemId)) {
        throw new Error(`[ChecklistValidation] Unknown checklist item: ${r.checklistItemId}`)
      }
      if (seenItemIds.has(r.checklistItemId)) {
        throw new Error(`[ChecklistValidation] Duplicate response for checklist item: ${r.checklistItemId}`)
      }
      seenItemIds.add(r.checklistItemId)
    }
    for (const reqItem of requiredItems) {
      if (!seenItemIds.has(reqItem.id)) {
        throw new Error(`[ChecklistValidation] Missing response for required checklist item: ${reqItem.label}`)
      }
    }

    if (input.overriddenById) {
      if (input.overriddenById !== input.completedById) {
        throw new Error('[ChecklistValidation] Invalid checklist override')
      }
      const overrideUser = await prisma.user.findUnique({
        where: { id: input.completedById },
        select: { role: true, email: true },
      })
      if (!userCanOverrideChecklist(overrideUser)) {
        throw new Error('[ChecklistValidation] Only administrators can override checklist requirements')
      }
    }

    const allPassed = input.responses.every((r) => r.passed)
    const isOverride = !!input.overriddenById

    const completion = await prisma.checklistCompletion.create({
      data: {
        checklistAssignmentId: input.checklistAssignmentId,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId,
        completedById: input.completedById,
        overriddenById: input.overriddenById,
        overriddenAt: isOverride ? new Date() : undefined,
        passed: allPassed || isOverride,
      },
    })

    for (const r of input.responses) {
      await prisma.transitionChecklistItemResponse.create({
        data: {
          completionId: completion.id,
          checklistItemId: r.checklistItemId,
          value: r.value as Prisma.InputJsonValue,
          passed: r.passed,
          respondedById: r.respondedById ?? input.completedById,
        },
      })
    }

    return prisma.checklistCompletion.findUnique({
      where: { id: completion.id },
      include: { responses: true },
    })
  },

  async getCompletionHistory(projectId: string, entityId: string) {
    const rows = await prisma.checklistCompletion.findMany({
      where: { projectId, entityId },
      include: {
        responses: {
          include: {
            checklistItem: true,
            respondedBy: { select: { id: true, name: true } },
            comments: { orderBy: { createdAt: 'asc' } },
            issues: { include: { issue: { select: { id: true, issueKey: true, title: true, status: true } } } },
          },
        },
        assignment: {
          include: { checklist: true },
        },
      },
      orderBy: { completedAt: 'desc' },
    })
    const userIds = new Set<string>()
    for (const r of rows) {
      if (r.completedById) userIds.add(r.completedById)
      if (r.overriddenById) userIds.add(r.overriddenById)
    }
    const users =
      userIds.size > 0
        ? await prisma.user.findMany({
            where: { id: { in: [...userIds] } },
            select: { id: true, name: true, email: true },
          })
        : []
    const userById = new Map(users.map((u) => [u.id, u]))
    return rows.map((r) => ({
      ...r,
      completedBy: r.completedById ? userById.get(r.completedById) ?? null : null,
      overriddenBy: r.overriddenById ? userById.get(r.overriddenById) ?? null : null,
    }))
  },

  async snapshotVersion(checklistId: string, currentVersion: number, createdBy?: string | null) {
    const checklist = await prisma.transitionChecklist.findUnique({
      where: { id: checklistId },
      include: { items: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!checklist) return

    return prisma.checklistVersion.create({
      data: {
        checklistId,
        versionNumber: currentVersion,
        snapshotJson: JSON.parse(JSON.stringify(checklist)),
        createdBy: createdBy ?? undefined,
      },
    })
  },

  async validateFieldOnEntity(
    entityType: string,
    entityId: string,
    validationConfig: Record<string, unknown>
  ): Promise<{ valid: boolean; message: string }> {
    const field = validationConfig.field as string
    const operator = validationConfig.operator as string

    if (entityType !== 'Requirement') {
      return { valid: false, message: `Unsupported entity type: ${entityType}` }
    }

    const requirement = await prisma.requirement.findUnique({
      where: { id: entityId },
    })
    if (!requirement) {
      return { valid: false, message: 'Entity not found' }
    }

    const fieldValue = (requirement as Record<string, unknown>)[field]

    switch (operator) {
      case 'NOT_EMPTY':
        return {
          valid: !!fieldValue && String(fieldValue).trim().length > 0,
          message: fieldValue ? `${field} is filled` : `${field} is empty`,
        }
      case 'MIN_LENGTH': {
        const minLen = (validationConfig.value as number) ?? 1
        const len = String(fieldValue ?? '').trim().length
        return {
          valid: len >= minLen,
          message: len >= minLen ? `${field} meets minimum length` : `${field} is too short (${len}/${minLen})`,
        }
      }
      case 'MATCHES_REGEX': {
        const pattern = validationConfig.value as string
        let regex: RegExp
        try {
          regex = new RegExp(pattern)
        } catch {
          return { valid: false, message: 'Invalid regex pattern' }
        }
        const str = String(fieldValue ?? '')
        return {
          valid: regex.test(str),
          message: regex.test(str) ? `${field} matches pattern` : `${field} does not match required pattern`,
        }
      }
      case 'IS_UNIQUE': {
        if (!fieldValue) return { valid: false, message: `${field} is empty` }
        const requirement2 = await prisma.requirement.findUnique({ where: { id: entityId } })
        if (!requirement2) return { valid: false, message: 'Entity not found' }
        const projectId = requirement2.projectId
        const count = await prisma.requirement.count({
          where: {
            projectId,
            [field]: fieldValue,
            id: { not: entityId },
            deletedAt: null,
          },
        })
        return {
          valid: count === 0,
          message: count === 0 ? `${field} is unique` : `${field} is not unique (${count} duplicates found)`,
        }
      }
      default:
        return { valid: true, message: 'No validation rule applied' }
    }
  },

  async evaluateChecklistForEntity(
    checklistItems: { id: string; itemType: string; validationConfig: unknown; isRequired: boolean }[],
    entityType: string,
    entityId: string
  ) {
    const results: { checklistItemId: string; passed: boolean; value: Record<string, unknown> }[] = []

    for (const item of checklistItems) {
      if (item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED') {
        const config = (item.validationConfig as Record<string, unknown>) ?? {}
        const result = await this.validateFieldOnEntity(entityType, entityId, config)
        results.push({
          checklistItemId: item.id,
          passed: result.valid,
          value: { valid: result.valid, message: result.message },
        })
      } else {
        results.push({
          checklistItemId: item.id,
          passed: false,
          value: { checked: false },
        })
      }
    }

    return results
  },

  async createChecklistItemIssue(input: CreateChecklistItemIssueInput) {
    const maxAttempts = 12
    let issue: Awaited<ReturnType<typeof prisma.issue.create>> | null = null
    let lastKeyError: unknown
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const nextSeq = (await getMaxIssueSequenceNumber()) + 1
      const issueKey = formatIssueKey(nextSeq)
      try {
        issue = await prisma.issue.create({
          data: {
            projectId: input.projectId,
            issueKey,
            title: input.title,
            description: input.description,
            priority: input.priority || 'medium',
            createdBy: input.createdBy,
            updatedBy: input.createdBy,
          },
        })
        break
      } catch (e) {
        if (isIssueKeyUniqueViolation(e)) {
          lastKeyError = e
          continue
        }
        throw e
      }
    }
    if (!issue) {
      throw lastKeyError ?? new Error('Could not allocate a unique issue key')
    }

    if (input.createdBy) {
      await prisma.issueSubscription.create({
        data: { issueId: issue.id, userId: input.createdBy },
      }).catch(() => {})
    }

    if (input.entityType === 'Requirement') {
      const requirement = await prisma.requirement.findUnique({
        where: { id: input.entityId },
        select: { requirementId: true, title: true },
      })

      await prisma.issueLink.create({
        data: {
          issueId: issue.id,
          linkedType: 'requirement',
          linkedId: input.entityId,
          linkType: 'related',
          linkedRequirementKey: requirement?.requirementId || null,
          linkedRequirementTitle: requirement?.title || null,
        },
      })
    }

    const link = await prisma.checklistItemIssue.create({
      data: {
        checklistItemId: input.checklistItemId,
        responseId: input.responseId,
        issueId: issue.id,
        entityType: input.entityType,
        entityId: input.entityId,
        projectId: input.projectId,
        createdBy: input.createdBy,
      },
      include: {
        issue: { select: { id: true, issueKey: true, title: true, status: true } },
      },
    })

    return { issue, link }
  },

  async getChecklistItemIssues(checklistItemId: string, entityId?: string) {
    const where: Record<string, unknown> = { checklistItemId }
    if (entityId) where.entityId = entityId

    return prisma.checklistItemIssue.findMany({
      where,
      include: {
        issue: { select: { id: true, issueKey: true, title: true, status: true, priority: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  },

  async addChecklistItemComment(
    responseId: string,
    projectId: string,
    content: string,
    authorId: string,
    authorName: string
  ) {
    return prisma.checklistItemComment.create({
      data: { responseId, projectId, content, authorId, authorName },
    })
  },

  async getChecklistItemComments(responseId: string) {
    return prisma.checklistItemComment.findMany({
      where: { responseId },
      orderBy: { createdAt: 'asc' },
    })
  },

  async deleteChecklistItemComment(commentId: string, requesterId: string, isAdmin: boolean) {
    const comment = await prisma.checklistItemComment.findUnique({ where: { id: commentId } })
    if (!comment) throw new Error('Comment not found')
    if (comment.authorId !== requesterId && !isAdmin) throw new Error('Not authorized to delete this comment')
    return prisma.checklistItemComment.delete({ where: { id: commentId } })
  },
}
