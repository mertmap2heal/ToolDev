/**
 * ReqIF service facade (NX-1).
 *
 * This file is now a thin facade over the converged `reqif/` module. It keeps
 * the `reqifService` public surface unchanged so `reqif.controller.ts` and its
 * routes (`POST /api/v1/reqif/:projectId/import`, `GET .../export`) need no
 * edit, while the actual parse/serialise/import/export logic lives once in
 * `backend/src/services/reqif/`.
 *
 * What the facade still owns:
 *   - the parameter-placeholder resolution applied to title/description on
 *     export (`resolveParameterPlaceholders`).
 *
 * The legacy single-pass importer (`importFromReqIF` internals) and the legacy
 * exporter (`mapRequirementToSpecObject` etc.) are replaced — the `reqif/`
 * module handles SPEC-HIERARCHY, SPEC-TYPES, DATATYPE-DEFINITION-*, typed
 * SPEC-RELATIONs and xhtml payload that the old code dropped.
 */
import { prisma } from '../lib/prisma'
import { resolveParameterPlaceholders } from '../utils/parameterPlaceholder'
import {
  buildExportModel,
  importReqIFXml,
  serializeReqIFModel,
  type ExportableTraceLink,
} from './reqif'

export const reqifService = {
  /**
   * Export requirements to a ReqIF 1.x document.
   *
   * @param parameterMode 'name' | 'resolved' — replace `{{param:id}}` tokens in
   *   title/description with the parameter name or its resolved value.
   */
  async exportToReqIF(
    projectId: string,
    requirementIds?: string[],
    parameterMode: 'name' | 'resolved' = 'name',
  ): Promise<string> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        requirements: {
          where: requirementIds
            ? { id: { in: requirementIds }, deletedAt: null }
            : { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!project) throw new Error('Project not found')

    let requirements = project.requirements

    // Parameter-placeholder resolution — facade-owned. Replace {{param:id}}
    // tokens before the requirement text is serialised.
    if (
      parameterMode &&
      requirements.some(
        (r) =>
          (r.title || '').includes('{{param:') ||
          (r.description || '').includes('{{param:'),
      )
    ) {
      const parameters = await prisma.parameter.findMany({
        where: { projectId },
        select: {
          id: true,
          name: true,
          defaultValue: true,
          unit: true,
          tolerance: true,
          minValue: true,
          maxValue: true,
        },
      })
      const parameterMap = new Map(
        parameters.map((p) => [
          p.id.toLowerCase(),
          {
            id: p.id,
            name: p.name,
            defaultValue: p.defaultValue,
            unit: p.unit,
            tolerance: p.tolerance,
            minValue: p.minValue,
            maxValue: p.maxValue,
          },
        ]),
      )
      requirements = requirements.map((r) => ({
        ...r,
        title: resolveParameterPlaceholders(r.title || '', parameterMap, parameterMode),
        description: resolveParameterPlaceholders(r.description || '', parameterMap, parameterMode),
      }))
    }

    // Pull the TraceLinks whose endpoints are both inside the exported set, so
    // they round-trip as SPEC-RELATIONs.
    const exportedIds = new Set(requirements.map((r) => r.id))
    let traceLinks: ExportableTraceLink[] = []
    if (exportedIds.size > 0) {
      const links = await prisma.traceLink.findMany({
        where: {
          projectId,
          sourceType: 'requirement',
          targetType: 'requirement',
          sourceId: { in: [...exportedIds] },
          targetId: { in: [...exportedIds] },
        },
        select: { sourceId: true, targetId: true, linkType: true },
      })
      traceLinks = links.filter(
        (l) => exportedIds.has(l.sourceId) && exportedIds.has(l.targetId),
      )
    }

    const model = buildExportModel({
      projectName: project.name,
      projectDescription: project.description,
      requirements,
      traceLinks,
    })
    return serializeReqIFModel(model)
  },

  /**
   * Import requirements from a ReqIF 1.x document.
   *
   * Returns the legacy `{ created, updated, skipped, errors }` shape so the
   * controller / UI contract is unchanged. The new `warnings` and
   * `linksCreated` data is folded in non-breakingly: `errors` keeps its
   * `{ row, errors }` shape; lossy-mapping warnings are appended as row-0
   * advisory entries so the UI surfaces them without a contract change.
   */
  async importFromReqIF(
    projectId: string,
    reqifXml: string,
    actorUserId?: string,
  ): Promise<{
    created: number
    updated: number
    skipped: number
    errors: Array<{ row: number; errors: string[] }>
  }> {
    const result = await importReqIFXml(projectId, reqifXml, actorUserId)
    const errors = [...result.errors]
    if (result.warnings.length) {
      errors.push({ row: 0, errors: result.warnings })
    }
    return {
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      errors,
    }
  },
}
