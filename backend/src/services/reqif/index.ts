/**
 * ReqIF 1.x service module (NX-1).
 *
 * The single, converged ReqIF code path for the Requirements module. Replaces
 * the two divergent legacy importers (`reqifParser.ts` + `reqif.service.ts`
 * internals). Package-neutral parser/model/serializer so a later Parameters
 * unification co-ticket can consume the same primitives.
 *
 * Public surface:
 *   parseReqIFDocument   — ReqIF XML  -> typed ReqIFModel
 *   serializeReqIFModel  — ReqIFModel -> ReqIF XML
 *   importReqIFXml       — ReqIF XML  -> Requirement tree + TraceLink rows
 *   importModelIntoProject — ReqIFModel -> Requirement tree + TraceLink rows
 *   buildExportModel     — Requirement/TraceLink graph -> ReqIFModel
 */
export * from './model'
export {
  parseReqIFDocument,
  ReqIFLimitError,
  ReqIFStructureError,
  MAX_SPEC_OBJECTS,
  MAX_SPEC_RELATIONS,
  MAX_HIERARCHY_NODES,
} from './parser'
export { serializeReqIFModel } from './serializer'
export {
  importModelIntoProject,
  importReqIFXml,
  mapSpecObjectToRequirement,
} from './importer'
export type { MappedRequirement, ReqIFImportResult } from './importer'
export { buildExportModel } from './exporter'
export type { ExportableTraceLink } from './exporter'
export {
  resolveLinkType,
  linkTypeToLongName,
  linkTypeToRelationTypeId,
  TRACE_LINK_TYPES,
} from './linkTypeMap'
export type { TraceLinkType, LinkTypeResolution } from './linkTypeMap'
