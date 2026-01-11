import { PrismaClient } from '@prisma/client'
import type { TraceLink, TraceabilityGraph } from '../../../shared/types/traceability.types'

const prisma = new PrismaClient()

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
      confidence: link.confidence || undefined,
      isAuto: link.isAuto,
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
    linkType: string
  ): Promise<TraceLink> {
    const link = await prisma.traceLink.create({
      data: {
        projectId,
        sourceType,
        sourceId,
        targetType,
        targetId,
        linkType,
        isAuto: false,
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
      confidence: link.confidence || undefined,
      isAuto: link.isAuto,
      createdAt: link.createdAt.toISOString(),
    }
  },
}
