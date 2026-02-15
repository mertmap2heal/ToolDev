import { PrismaClient } from '@prisma/client'
import type { TraceLink, TraceabilityGraph } from '../../../shared/types/traceability.types'
import { linkageAuditService } from './linkageAudit.service'
import { notifyRequirementSubscribers } from './requirementNotification.service'

const prisma = new PrismaClient()

/**
 * Traceability service provides functionality for managing trace links between
 * artifacts (requirements, functions, etc.) including suspect link detection
 * and coverage analysis.
 */
const MEANINGFUL_LINK_TYPES = [
  'verified_by',
  'validated_by',
  'documented_in',
  'mitigates',
  'complies_with',
  'cert_objective',
  'verifies', // legacy
  'derives_from',
  'refines',
  'constrains',
  'depends_on',
  'supersedes',
]

const MEANINGFUL_FIELDS = [
  'title',
  'description',
  'acceptanceCriteria',
  'verificationMethod',
  'parentId',
  'requirementType',
  'requirementLevel',
  'risk',
  'complexity',
  'source',
  'owner',
  'rationale',
  'assumptions',
  'linkedMocCode',
]

export const traceabilityService = {
  async getTraceLinks(
    projectId: string,
    filters?: {
      sourceType?: string
      targetType?: string
      sourceId?: string
      targetId?: string
      excludeFunctions?: boolean
    }
  ): Promise<TraceLink[]> {
    const baseWhere: any = { projectId }
    if (filters?.sourceType) baseWhere.sourceType = filters.sourceType
    if (filters?.targetType) baseWhere.targetType = filters.targetType
    if (filters?.sourceId) baseWhere.sourceId = filters.sourceId
    if (filters?.targetId) baseWhere.targetId = filters.targetId
    const where = filters?.excludeFunctions
      ? { AND: [baseWhere, { targetType: { notIn: ['function', 'parameter'] } }] }
      : baseWhere

    const links = await prisma.traceLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    // Fetch IssueLinks to include in the trace (mapped to TraceLink items)

    // 1. Where Issue is the SOURCE (Issue -> X)
    let issueLinksDirect: any[] = []
    if (!filters?.sourceType || filters.sourceType === 'issue') {
      const whereDirect: any = { issue: { projectId } }
      if (filters?.sourceId) whereDirect.issueId = filters.sourceId
      if (filters?.targetType) whereDirect.linkedType = filters.targetType
      if (filters?.targetId) whereDirect.linkedId = filters.targetId

      const results = await prisma.issueLink.findMany({ where: whereDirect, include: { issue: true } })
      issueLinksDirect = results.map(l => ({
        id: l.id,
        projectId: l.issue.projectId,
        sourceType: 'issue',
        sourceId: l.issueId,
        targetType: l.linkedType,
        targetId: l.linkedId,
        linkType: l.linkType,
        isSuspect: false,
        createdAt: l.createdAt,
        isAuto: false,
        direction: undefined,
        rationale: undefined,
        confidence: undefined,
        lastChecked: undefined
      }))
    }

    // 2. Where Issue is the TARGET (X -> Issue) - Stored as Issue -> X
    let issueLinksInverse: any[] = []
    if (!filters?.targetType || filters.targetType === 'issue') {
      const whereInverse: any = { issue: { projectId } }
      if (filters?.sourceType) whereInverse.linkedType = filters.sourceType
      if (filters?.sourceId) whereInverse.linkedId = filters.sourceId
      if (filters?.targetId) whereInverse.issueId = filters.targetId

      const results = await prisma.issueLink.findMany({ where: whereInverse, include: { issue: true } })
      issueLinksInverse = results.map(l => ({
        id: l.id,
        projectId: l.issue.projectId,
        sourceType: l.linkedType,
        sourceId: l.linkedId,
        targetType: 'issue',
        targetId: l.issueId,
        linkType: l.linkType === 'relates_to' ? 'relates_to' : `${l.linkType}_inverse`,
        isSuspect: false,
        createdAt: l.createdAt,
        isAuto: false,
        direction: undefined,
        rationale: undefined,
        confidence: undefined,
        lastChecked: undefined,
        targetTitle: l.issue.title,
        targetDescription: l.issue.description,
        targetDisplayId: l.issue.issueKey || l.issue.id.substring(0, 8)
      }))
    }


    // 3. Where Change Request is linked (Requirement <-> CR)
    let crLinks: any[] = []
    const crInclude = { changeRequest: true, requirement: true }

    // Check if we need to fetch CR links based on filters
    const shouldFetchCR =
      (!filters?.sourceType || filters.sourceType === 'requirement' || filters.sourceType === 'change_request') &&
      (!filters?.targetType || filters.targetType === 'requirement' || filters.targetType === 'change_request')

    if (shouldFetchCR) {
      // Case A: Requirement -> CR (treat Req as source)
      if (!filters?.sourceType || filters.sourceType === 'requirement') {
        const whereCR: any = { requirement: { projectId } }
        if (filters?.sourceId) whereCR.requirementId = filters.sourceId
        if (filters?.targetType === 'change_request') {
          // If specifically targeting CR
          if (filters?.targetId) whereCR.changeRequestId = filters.targetId
        }

        const results = await prisma.requirementChangeRequestLink.findMany({ where: whereCR, include: crInclude })
        crLinks.push(...results.map(l => ({
          id: l.id,
          projectId: l.requirement.projectId,
          sourceType: 'requirement',
          sourceId: l.requirementId,
          targetType: 'change_request',
          targetId: l.changeRequestId,
          linkType: l.relationshipType,
          isSuspect: false,
          createdAt: l.createdAt,
          isAuto: false,
          direction: undefined,
          rationale: l.note,
          confidence: undefined,
          lastChecked: undefined,
          targetTitle: l.changeRequest.title,
          targetDescription: l.changeRequest.description,
          targetDisplayId: l.changeRequest.crId || l.changeRequest.id.substring(0, 8)
        })))
      }

      // Case B: CR -> Requirement (treat CR as source, if filter allows)
      // This is the "inverse" view if someone looks at a CR and wants to see linked Requirements
      if (!filters?.sourceType || filters.sourceType === 'change_request') {
        const whereCR: any = { changeRequest: { projectId } }
        if (filters?.sourceId) whereCR.changeRequestId = filters.sourceId
        if (filters?.targetType === 'requirement') {
          if (filters?.targetId) whereCR.requirementId = filters.targetId
        }

        // We might match the same links as Case A if filters are broad, preventing duplicates via ID check or careful filtering
        // For now, let's just fetch if we are specifically looking from CR perspective or broad perspective
        // To avoid duplicates with Case A in a broad fetch, we can dedup later or just rely on the fact that
        // usually the UI queries with specific sourceId/sourceType.

        // Only fetch "inverse" if we haven't already fetched "forward" for the same pair? 
        // Actually, if we are listing links for a CR, we want CR as source.

        const results = await prisma.requirementChangeRequestLink.findMany({ where: whereCR, include: crInclude })
        crLinks.push(...results.map(l => ({
          id: l.id,
          projectId: l.changeRequest.projectId,
          sourceType: 'change_request',
          sourceId: l.changeRequestId,
          targetType: 'requirement',
          targetId: l.requirementId,
          linkType: l.relationshipType === 'originates_from' ? 'originates_from_inverse' : `${l.relationshipType}_inverse`,
          isSuspect: false,
          createdAt: l.createdAt,
          isAuto: false,
          direction: undefined,
          rationale: l.note,
          confidence: undefined,
          lastChecked: undefined,
          targetTitle: l.requirement.title,
          targetDescription: l.requirement.description,
          targetDisplayId: l.requirement.requirementId || l.requirement.id.substring(0, 8)
        })))
      }
    }

    // Dedup CR links if we fetched both directions for a broad query (rare but possible)
    // We can use a Map by ID to dedup if needed, but for now simple concatenation. 
    // Ideally we filter based on what the user asked for. 
    // If user asked `traceability.getTraceLinks(projectId)`, they get everything.
    // Use a Set to avoid duplicates if ID is shared (RequirementChangeRequestLink has its own ID).
    // Note: We mapped them to different 'source/target' structures, effectively creating two 'virtual' links per physical link 
    // if we are not careful. However, usually the frontend asks for links related to a SPECIFIC source.
    // If sourceId is 'REQ-123', we hit Case A. Case B skipped (sourceType=CR mismatch).
    // If sourceId is 'CR-123', we hit Case B. Case A skipped.
    // If no sourceId, we might get duplicates.

    // Filter duplicates for broad queries:
    const uniqueCrLinks = new Map();
    crLinks.forEach(l => {
      // Key by physical link ID AND direction representation
      const key = `${l.id}-${l.sourceType}`
      uniqueCrLinks.set(key, l)
    })

    // 4. For standard links (Req <-> Req, Req <-> Function), fetch Entity details to populate titles
    // Collect IDs of requirements involved in links
    const reqIdsToFetch = new Set<string>()
    links.forEach(l => {
      if (l.sourceType === 'requirement') reqIdsToFetch.add(l.sourceId)
      if (l.targetType === 'requirement') reqIdsToFetch.add(l.targetId)
    })

    // Fetch titles
    const reqDetails = await prisma.requirement.findMany({
      where: { id: { in: Array.from(reqIdsToFetch) } },
      select: { id: true, title: true, requirementId: true } // Minimal fetch
    })

    const reqMap = new Map(reqDetails.map(r => [r.id, r]))

    const allLinks = [...links, ...issueLinksDirect, ...issueLinksInverse, ...Array.from(uniqueCrLinks.values())]

    return allLinks.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((link) => {
      const isReqSource = link.sourceType === 'requirement'
      const isReqTarget = link.targetType === 'requirement'

      const sReq = isReqSource ? reqMap.get(link.sourceId) : null
      const tReq = isReqTarget ? reqMap.get(link.targetId) : null

      return {
        id: link.id,
        projectId: link.projectId,
        sourceType: link.sourceType as any,
        sourceId: link.sourceId,
        targetType: link.targetType as any,
        targetId: link.targetId,
        linkType: link.linkType as any,
        direction: link.direction || undefined,
        rationale: link.rationale || undefined,
        confidence: link.confidence || undefined,
        isAuto: link.isAuto,
        isSuspect: link.isSuspect || false,
        lastChecked: link.lastChecked?.toISOString(),
        createdAt: link.createdAt.toISOString(),
        targetTitle: link.targetTitle || (tReq ? tReq.title : undefined),
        targetDisplayId: link.targetDisplayId || (tReq ? (tReq.requirementId || tReq.id.substring(0, 8)) : undefined),
        sourceTitle: sReq ? sReq.title : undefined,
        sourceDisplayId: sReq ? (sReq.requirementId || sReq.id.substring(0, 8)) : undefined
      }
    })
  },

  async getSuspectLinks(
    projectId: string,
    options?: { excludeFunctions?: boolean }
  ): Promise<TraceLink[]> {
    const where: any = { projectId, isSuspect: true }
    if (options?.excludeFunctions) {
      where.targetType = { notIn: ['function', 'parameter'] }
    }
    const links = await prisma.traceLink.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return links.map((link) => ({
      id: link.id,
      projectId: link.projectId,
      sourceType: link.sourceType as any,
      sourceId: link.sourceId,
      targetType: link.targetType as any,
      targetId: link.targetId,
      linkType: link.linkType as any,
      direction: link.direction || undefined,
      rationale: link.rationale || undefined,
      confidence: link.confidence || undefined,
      isAuto: link.isAuto,
      isSuspect: true,
      lastChecked: link.lastChecked?.toISOString(),
      createdAt: link.createdAt.toISOString(),
    }))
  },

  async getTraceabilityGraph(projectId: string): Promise<TraceabilityGraph> {
    const [links, requirements, functions, architectures, verifications] =
      await Promise.all([
        prisma.traceLink.findMany({ where: { projectId } }),
        prisma.requirement.findMany({ where: { projectId } }),
        prisma.systemFunction.findMany({ where: { projectId } }),
        prisma.architecture.findMany({ where: { projectId } }),
        prisma.verificationPlan.findMany({ where: { projectId } }),
      ])

    const nodes = [
      ...requirements.map((r) => ({
        id: r.id,
        type: 'requirement' as const,
        label: r.title,
        data: r,
      })),
      ...functions.map((f) => ({
        id: f.id,
        type: 'function' as const,
        label: f.name,
        data: f,
      })),
      ...architectures.map((a) => ({
        id: a.id,
        type: 'architecture' as const,
        label: a.name,
        data: a,
      })),
      ...verifications.map((v) => ({
        id: v.id,
        type: 'verification' as const,
        label: v.name,
        data: v,
      })),
    ]

    const edges = links.map((link) => ({
      id: link.id,
      source: link.sourceId,
      target: link.targetId,
      type: link.linkType as any,
      confidence: link.confidence || undefined,
    }))

    return { nodes, edges }
  },

  async createTraceLink(
    projectId: string,
    sourceType: string,
    sourceId: string,
    targetType: string,
    targetId: string,
    linkType: string,
    direction?: string,
    rationale?: string,
    performedByUserId?: string
  ): Promise<TraceLink> {
    const link = await prisma.traceLink.create({
      data: {
        projectId,
        sourceType,
        sourceId,
        targetType,
        targetId,
        linkType,
        direction: direction || null,
        rationale: rationale || null,
        isAuto: false,
        isSuspect: false,
        lastChecked: new Date(),
      },
    })

    await linkageAuditService.log({
      projectId,
      entityType: 'LINK',
      entityId: link.id,
      action: 'LINK_CREATED',
      newValue: { sourceType, sourceId, targetType, targetId, linkType },
      performedByUserId,
    })

    await notifyRequirementLinkChange({
      projectId,
      sourceType,
      sourceId,
      targetType,
      targetId,
      linkType,
      action: 'added',
      actorUserId: performedByUserId,
    })

    return {
      id: link.id,
      projectId: link.projectId,
      sourceType: link.sourceType as any,
      sourceId: link.sourceId,
      targetType: link.targetType as any,
      targetId: link.targetId,
      linkType: link.linkType as any,
      direction: link.direction || undefined,
      rationale: link.rationale || undefined,
      confidence: link.confidence || undefined,
      isAuto: link.isAuto,
      isSuspect: link.isSuspect || false,
      lastChecked: link.lastChecked?.toISOString(),
      createdAt: link.createdAt.toISOString(),
    }
  },

  /**
   * Clears the suspect flag on a link, marking it as reviewed
   */
  async clearSuspectLink(
    projectId: string,
    linkId: string,
    performedByUserId?: string,
    comment?: string
  ): Promise<TraceLink> {
    const link = await prisma.traceLink.update({
      where: { id: linkId },
      data: {
        isSuspect: false,
        lastChecked: new Date(),
      },
    })

    await linkageAuditService.log({
      projectId,
      entityType: 'LINK',
      entityId: linkId,
      action: 'LINK_CLEARED_SUSPECT',
      oldValue: { isSuspect: true },
      newValue: { isSuspect: false, comment: comment || undefined },
      performedByUserId,
    })

    return {
      id: link.id,
      projectId: link.projectId,
      sourceType: link.sourceType as any,
      sourceId: link.sourceId,
      targetType: link.targetType as any,
      targetId: link.targetId,
      linkType: link.linkType as any,
      direction: link.direction || undefined,
      rationale: link.rationale || undefined,
      confidence: link.confidence || undefined,
      isAuto: link.isAuto,
      isSuspect: link.isSuspect || false,
      lastChecked: link.lastChecked?.toISOString(),
      createdAt: link.createdAt.toISOString(),
    }
  },

  /**
   * Marks all downstream links from a source as suspect.
   * Called when a requirement is updated to flag potentially
   * impacted downstream artifacts.
   */
  async markDownstreamLinksSuspect(projectId: string, sourceId: string): Promise<number> {
    const result = await prisma.traceLink.updateMany({
      where: {
        projectId,
        sourceId,
      },
      data: {
        isSuspect: true,
      },
    })

    return result.count
  },

  /**
   * Marks links as suspect when meaningful requirement fields change.
   * Only marks links of types: verified_by, validated_by, documented_in,
   * mitigates, complies_with, cert_objective (and legacy verifies).
   */
  async markLinksSuspectByMeaningfulChange(
    projectId: string,
    requirementId: string,
    changedFields: string[]
  ): Promise<number> {
    const meaningful = changedFields.filter((f) =>
      MEANINGFUL_FIELDS.includes(f)
    )
    if (meaningful.length === 0) return 0

    const result = await prisma.traceLink.updateMany({
      where: {
        projectId,
        sourceId: requirementId,
        linkType: { in: MEANINGFUL_LINK_TYPES },
      },
      data: { isSuspect: true },
    })
    return result.count
  },

  /**
   * Deletes a trace link
   */
  async deleteTraceLink(
    projectId: string,
    linkId: string,
    performedByUserId?: string
  ): Promise<void> {
    const link = await prisma.traceLink.findUnique({
      where: { id: linkId },
    })
    await prisma.traceLink.delete({
      where: { id: linkId },
    })
    if (link) {
      await linkageAuditService.log({
        projectId,
        entityType: 'LINK',
        entityId: linkId,
        action: 'LINK_REMOVED',
        oldValue: {
          sourceType: link.sourceType,
          sourceId: link.sourceId,
          targetType: link.targetType,
          targetId: link.targetId,
          linkType: link.linkType,
        },
        performedByUserId,
      })

      await notifyRequirementLinkChange({
        projectId,
        sourceType: link.sourceType,
        sourceId: link.sourceId,
        targetType: link.targetType,
        targetId: link.targetId,
        linkType: link.linkType,
        action: 'removed',
        actorUserId: performedByUserId,
      })
    }
  },
}

async function notifyRequirementLinkChange(params: {
  projectId: string
  sourceType: string
  sourceId: string
  targetType: string
  targetId: string
  linkType: string
  action: 'added' | 'removed'
  actorUserId?: string
}) {
  const { projectId, sourceType, sourceId, targetType, targetId, linkType, action, actorUserId } = params
  const actionLabel = action === 'added' ? 'Link added' : 'Link removed'

  const targetSummary = `${targetType} ${formatShortId(targetId)}`
  const sourceSummary = `${sourceType} ${formatShortId(sourceId)}`

  if (sourceType === 'requirement') {
    await notifyRequirementSubscribers({
      projectId,
      requirementId: sourceId,
      actorUserId,
      changes: [`${actionLabel} (${linkType}) to ${targetSummary}`],
    })
  }

  if (targetType === 'requirement') {
    await notifyRequirementSubscribers({
      projectId,
      requirementId: targetId,
      actorUserId,
      changes: [`${actionLabel} (${linkType}) from ${sourceSummary}`],
    })
  }
}

function formatShortId(value: string): string {
  return value.length > 8 ? value.substring(0, 8) : value
}
