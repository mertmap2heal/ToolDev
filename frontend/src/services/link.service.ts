import { LINKAGE_V1 } from '../config/featureFlags'
import { traceabilityService } from './traceability.service'
import type { Link, CreateLinkDto, LinkFilters } from 'shared/types/linkage.types'
import type { TraceLink, ArtifactType, LinkType as TraceLinkType } from 'shared/types/traceability.types'
import type { ApiResponse } from 'shared/types/api.types'

const EXCLUDED_TARGET_TYPES: string[] = []

function traceLinkToLink(tl: TraceLink & { targetLabel?: string; sourceLabel?: string }): Link {
  return {
    id: tl.id,
    projectId: tl.projectId,
    sourceType: tl.sourceType,
    sourceId: tl.sourceId,
    targetType: tl.targetType,
    targetId: tl.targetId,
    linkType: tl.linkType,
    status: tl.isSuspect ? 'suspect' : 'active',
    rationale: tl.rationale,
    createdAt: tl.createdAt,
    isSuspect: tl.isSuspect,
    targetTitle: tl.targetTitle,
    targetDescription: tl.targetDescription,
    targetDisplayId: tl.targetDisplayId,
    targetLabel: tl.targetLabel,
    sourceTitle: tl.sourceTitle,
    sourceDescription: tl.sourceDescription,
    sourceDisplayId: tl.sourceDisplayId,
    sourceLabel: tl.sourceLabel,
  }
}

function filterByLinkageV1<T extends { targetType?: string; sourceType?: string }>(items: T[]): T[] {
  if (!LINKAGE_V1) return items
  return items.filter(
    (item) =>
      !EXCLUDED_TARGET_TYPES.includes(item.targetType || '') &&
      !EXCLUDED_TARGET_TYPES.includes(item.sourceType || '')
  )
}

function applyFilters(links: Link[], filters?: LinkFilters): Link[] {
  if (!filters) return links
  let result = links
  if (filters.sourceType) result = result.filter((l) => l.sourceType === filters!.sourceType)
  if (filters.targetType) result = result.filter((l) => l.targetType === filters!.targetType)
  if (filters.status) result = result.filter((l) => (l.isSuspect ? 'suspect' : 'active') === filters!.status)
  if (filters.sourceId) result = result.filter((l) => l.sourceId === filters!.sourceId)
  if (filters.targetId) result = result.filter((l) => l.targetId === filters!.targetId)
  return result
}

/**
 * Link service wraps traceability service with LINKAGE_V1 behavior.
 * When LINKAGE_V1 is enabled, excludes function/parameter from links.
 */
export const linkService = {
  async getLinks(projectId: string, filters?: LinkFilters): Promise<ApiResponse<Link[]>> {
    const response = await traceabilityService.getTraceLinks(projectId, filters)
    if (!response.success || !response.data) return response as unknown as ApiResponse<Link[]>
    let links = response.data.map(traceLinkToLink)
    links = filterByLinkageV1(links)
    links = applyFilters(links, filters)
    return { success: true, data: links }
  },

  async getSuspectLinks(projectId: string): Promise<ApiResponse<Link[]>> {
    const response = await traceabilityService.getSuspectLinks(projectId)
    if (!response.success || !response.data) return response as unknown as ApiResponse<Link[]>
    let links = response.data.map(traceLinkToLink)
    links = filterByLinkageV1(links)
    return { success: true, data: links }
  },

  async createLink(projectId: string, dto: CreateLinkDto): Promise<ApiResponse<Link>> {
    const response = await traceabilityService.createTraceLink(projectId, {
      sourceType: dto.sourceType as ArtifactType,
      sourceId: dto.sourceId,
      targetType: dto.targetType as ArtifactType,
      targetId: dto.targetId,
      linkType: dto.linkType as TraceLinkType,
      direction: dto.direction,
      rationale: dto.rationale,
    })
    if (!response.success || !response.data) return response as unknown as ApiResponse<Link>
    return { success: true, data: traceLinkToLink(response.data) }
  },

  async clearSuspect(projectId: string, linkId: string, comment?: string): Promise<ApiResponse<Link>> {
    const response = await traceabilityService.clearSuspectLink(projectId, linkId, comment)
    if (!response.success || !response.data) return response as unknown as ApiResponse<Link>
    return { success: true, data: traceLinkToLink(response.data) }
  },

  async deleteLink(projectId: string, linkId: string): Promise<ApiResponse<void>> {
    return traceabilityService.deleteTraceLink(projectId, linkId)
  },
}
