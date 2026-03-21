import { prisma } from '../lib/prisma'
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
  }[]
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
        },
      })
    }

    return prisma.checklistCompletion.findUnique({
      where: { id: completion.id },
      include: { responses: true },
    })
  },

  async getCompletionHistory(projectId: string, entityId: string) {
    return prisma.checklistCompletion.findMany({
      where: { projectId, entityId },
      include: {
        responses: {
          include: { checklistItem: true },
        },
        assignment: {
          include: { checklist: true },
        },
      },
      orderBy: { completedAt: 'desc' },
    })
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
        const regex = new RegExp(pattern)
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
}
