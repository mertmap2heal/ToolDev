import { prisma } from '../lib/prisma'
import { RequirementQualitySnapSource } from '@prisma/client'
import { requirementValidationService } from './requirementValidation.service'

const REASON_MAX = 500

export type DismissalItem = { requirementId: string; issueKey: string; reason?: string | null }

function trimReason(r: string | null | undefined): string | null {
  if (r == null || typeof r !== 'string') return null
  const t = r.trim().slice(0, REASON_MAX)
  return t.length ? t : null
}

async function qualityAuditLog(
  projectId: string,
  userId: string,
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        projectId,
        userId,
        action,
        details: JSON.stringify(details),
      },
    })
  } catch (e) {
    console.warn('Quality workbench audit log failed:', e)
  }
}

export const requirementQualityWorkbenchService = {
  async listDismissals(projectId: string, userId: string) {
    const rows = await prisma.requirementQualityDismissal.findMany({
      where: { projectId, userId },
      select: {
        id: true,
        requirementId: true,
        issueKey: true,
        reason: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    })
    return rows
  },

  async upsertDismissals(
    projectId: string,
    userId: string,
    items: DismissalItem[],
    auditAction = 'requirement.quality_issue_dismissed'
  ) {
    for (const it of items) {
      const reason = trimReason(it.reason)
      await prisma.requirementQualityDismissal.upsert({
        where: {
          requirementId_userId_issueKey: {
            requirementId: it.requirementId,
            userId,
            issueKey: it.issueKey,
          },
        },
        create: {
          projectId,
          requirementId: it.requirementId,
          userId,
          issueKey: it.issueKey,
          reason,
        },
        update: { reason, projectId },
      })
    }
    await qualityAuditLog(projectId, userId, auditAction, {
      count: items.length,
      requirementIds: [...new Set(items.map((i) => i.requirementId))],
    })
  },

  async deleteDismissal(projectId: string, userId: string, requirementId: string, issueKey: string) {
    const res = await prisma.requirementQualityDismissal.deleteMany({
      where: { projectId, userId, requirementId, issueKey },
    })
    if (res.count > 0) {
      await qualityAuditLog(projectId, userId, 'requirement.quality_issue_restored', {
        requirementId,
        issueKey,
      })
    }
    return res.count
  },

  async deleteAllForRequirement(projectId: string, userId: string, requirementId: string) {
    const res = await prisma.requirementQualityDismissal.deleteMany({
      where: { projectId, userId, requirementId },
    })
    if (res.count > 0) {
      await qualityAuditLog(projectId, userId, 'requirement.quality_dismissals_cleared', {
        requirementId,
        count: res.count,
      })
    }
    return res.count
  },

  async clearAllForProject(projectId: string, userId: string) {
    const res = await prisma.requirementQualityDismissal.deleteMany({
      where: { projectId, userId },
    })
    if (res.count > 0) {
      await qualityAuditLog(projectId, userId, 'requirement.quality_project_dismissals_cleared', {
        count: res.count,
      })
    }
    return res.count
  },

  /** Server-side: validate requirement and upsert dismissals for every warning issue */
  async bulkSkipWarnings(
    projectId: string,
    userId: string,
    requirementId: string
  ): Promise<{ upserted: number }> {
    const requirement = await prisma.requirement.findFirst({
      where: {
        id: requirementId,
        projectId,
        deletedAt: null,
      },
      include: { moc: true },
    })
    if (!requirement) {
      throw new Error('Requirement not found')
    }
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { strictLifecycleGates: true },
    })
    const validation = await requirementValidationService.validateRequirement(requirement as any, {
      projectId,
      strictLifecycleGates: project?.strictLifecycleGates ?? false,
    })
    const issues = validation.issues ?? []
    const warnings = issues.filter((i) => i.severity === 'warning')
    const items: DismissalItem[] = warnings.map((i) => ({
      requirementId,
      issueKey: `${i.severity}:${i.message}`,
      reason: null,
    }))
    if (items.length === 0) {
      return { upserted: 0 }
    }
    await this.upsertDismissals(projectId, userId, items, 'requirement.quality_bulk_skip_warnings')
    return { upserted: items.length }
  },

  /** Compact snapshot payload for compare */
  buildPayloadFromProjectValidation(data: {
    requirements: Array<{ requirementId: string; validation: { score: number; issues?: Array<{ message: string; severity: string }> } }>
  }) {
    const reqs = data.requirements
    const n = reqs.length
    const avgScore = n > 0 ? Math.round(reqs.reduce((s, r) => s + r.validation.score, 0) / n) : 0
    const byReq: Record<string, { score: number; issueKeys: string[] }> = {}
    for (const r of reqs) {
      const keys =
        r.validation.issues?.map((i) => `${i.severity}:${i.message}`) ?? []
      byReq[r.requirementId] = { score: r.validation.score, issueKeys: keys }
    }
    return {
      avgScore,
      requirements: byReq,
    }
  },

  async getLatestFullProjectSnapshot(projectId: string) {
    return prisma.requirementQualitySnapshot.findFirst({
      where: { projectId, source: RequirementQualitySnapSource.full_project, requirementId: null },
      orderBy: { capturedAt: 'desc' },
    })
  },

  async getLatestSingleRequirementSnapshot(projectId: string, requirementId: string) {
    return prisma.requirementQualitySnapshot.findFirst({
      where: {
        projectId,
        requirementId,
        source: RequirementQualitySnapSource.single_requirement,
      },
      orderBy: { capturedAt: 'desc' },
    })
  },

  async saveFullProjectSnapshot(
    projectId: string,
    userId: string | undefined,
    payload: Record<string, unknown>
  ) {
    return prisma.requirementQualitySnapshot.create({
      data: {
        projectId,
        userId: userId ?? null,
        source: RequirementQualitySnapSource.full_project,
        requirementId: null,
        payload: payload as object,
      },
    })
  },

  async saveRequirementSnapshot(
    projectId: string,
    requirementId: string,
    userId: string | undefined,
    payload: Record<string, unknown>
  ) {
    return prisma.requirementQualitySnapshot.create({
      data: {
        projectId,
        userId: userId ?? null,
        source: RequirementQualitySnapSource.single_requirement,
        requirementId,
        payload: payload as object,
      },
    })
  },

  comparePayloads(
    previous: { avgScore: number; requirements: Record<string, { score: number; issueKeys: string[] }> } | null,
    current: { avgScore: number; requirements: Record<string, { score: number; issueKeys: string[] }> },
    previousCapturedAtIso?: string | null
  ) {
    if (!previous) {
      return {
        hasPrevious: false as const,
        avgScoreDelta: 0,
        avgScorePrevious: null as number | null,
        avgScoreCurrent: current.avgScore,
        improvedCount: 0,
        regressedCount: 0,
        previousCapturedAt: null as string | null,
      }
    }
    let improved = 0
    let regressed = 0
    const ids = new Set([...Object.keys(previous.requirements), ...Object.keys(current.requirements)])
    for (const id of ids) {
      const p = previous.requirements[id]?.score
      const c = current.requirements[id]?.score
      if (p === undefined || c === undefined) continue
      if (c > p) improved++
      else if (c < p) regressed++
    }
    return {
      hasPrevious: true as const,
      avgScoreDelta: current.avgScore - previous.avgScore,
      avgScorePrevious: previous.avgScore,
      avgScoreCurrent: current.avgScore,
      improvedCount: improved,
      regressedCount: regressed,
      previousCapturedAt: previousCapturedAtIso ?? null,
    }
  },

  compareSingleRequirement(
    previous: { score: number; issueKeys: string[] } | null,
    current: { score: number; issueKeys: string[] },
    previousCapturedAtIso?: string | null
  ) {
    if (!previous) {
      return {
        hasPrevious: false as const,
        scoreDelta: 0,
        issuesDelta: 0,
        previousCapturedAt: null as string | null,
      }
    }
    return {
      hasPrevious: true as const,
      scoreDelta: current.score - previous.score,
      issuesDelta: current.issueKeys.length - previous.issueKeys.length,
      previousCapturedAt: previousCapturedAtIso ?? null,
    }
  },
}
