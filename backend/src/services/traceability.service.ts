import { PrismaClient } from '@prisma/client'
import type { TraceLink, TraceabilityGraph } from '../../../shared/types/traceability.types'

const prisma = new PrismaClient()

/**
 * Traceability service provides functionality for managing trace links between
 * artifacts (requirements, functions, etc.) including suspect link detection
 * and coverage analysis.
 */
export const traceabilityService = {
  async getTraceLinks(projectId: string): Promise<TraceLink[]> {
    const links = await prisma.traceLink.findMany({
      where: { projectId },
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
      isSuspect: link.isSuspect || false,
      lastChecked: link.lastChecked?.toISOString(),
      createdAt: link.createdAt.toISOString(),
    }))
  },

  async getSuspectLinks(projectId: string): Promise<TraceLink[]> {
    const links = await prisma.traceLink.findMany({
      where: { 
        projectId,
        isSuspect: true,
      },
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
    rationale?: string
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
  async clearSuspectLink(projectId: string, linkId: string): Promise<TraceLink> {
    const link = await prisma.traceLink.update({
      where: { id: linkId },
      data: {
        isSuspect: false,
        lastChecked: new Date(),
      },
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
   * Deletes a trace link
   */
  async deleteTraceLink(projectId: string, linkId: string): Promise<void> {
    await prisma.traceLink.delete({
      where: { id: linkId },
    })
  },
}
