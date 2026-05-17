/**
 * Requirement -> ReqIF exporter (NX-1).
 *
 * Builds a typed `ReqIFModel` from a project's `Requirement` graph and its
 * `TraceLink` rows, so `serializer.ts` can emit a ReqIF document with a real
 * SPEC-TYPES / DATATYPES block and a SPEC-HIERARCHY tree that reflects
 * `Requirement.parentId`. A re-import of that export reconstructs the same
 * objects, the same typed links, and the same tree — the round-trip guarantee.
 */
import type { Requirement } from '@prisma/client'
import type {
  AttributeDefinition,
  AttributeValue,
  Datatype,
  ReqIFModel,
  SpecHierarchy,
  SpecObject,
  SpecObjectType,
  SpecRelation,
  SpecRelationType,
  Specification,
  SpecificationType,
} from './model'
import { linkTypeToLongName, linkTypeToRelationTypeId } from './linkTypeMap'

/* Stable identifiers for the single SPEC-OBJECT-TYPE the exporter emits. */
const DATATYPE_STRING_ID = 'DT-STRING'
const DATATYPE_XHTML_ID = 'DT-XHTML'
const SPEC_OBJECT_TYPE_ID = 'SOT-REQUIREMENT'
const SPECIFICATION_TYPE_ID = 'SPECTYPE-REQUIREMENTS'

/**
 * The fixed attribute schema the exporter emits. Each entry is one
 * ATTRIBUTE-DEFINITION on the Requirement SPEC-OBJECT-TYPE; `field` names the
 * `Requirement` column it carries; `kind` decides STRING vs XHTML.
 */
interface ExportAttr {
  id: string
  longName: string
  kind: 'STRING' | 'XHTML'
  field: keyof Requirement
}

const EXPORT_ATTRS: ExportAttr[] = [
  { id: 'AD-REQ-ID', longName: 'ReqIF.ForeignID', kind: 'STRING', field: 'requirementId' },
  { id: 'AD-TITLE', longName: 'ReqIF.Name', kind: 'STRING', field: 'title' },
  { id: 'AD-DESCRIPTION', longName: 'ReqIF.Text', kind: 'XHTML', field: 'description' },
  { id: 'AD-PRIORITY', longName: 'Priority', kind: 'STRING', field: 'priority' },
  { id: 'AD-STATUS', longName: 'Status', kind: 'STRING', field: 'status' },
  { id: 'AD-TYPE', longName: 'Requirement Type', kind: 'STRING', field: 'requirementType' },
  { id: 'AD-LEVEL', longName: 'Requirement Level', kind: 'STRING', field: 'requirementLevel' },
  { id: 'AD-RISK', longName: 'Risk', kind: 'STRING', field: 'risk' },
  { id: 'AD-COMPLEXITY', longName: 'Complexity', kind: 'STRING', field: 'complexity' },
  { id: 'AD-RATIONALE', longName: 'Rationale', kind: 'STRING', field: 'rationale' },
  { id: 'AD-ASSUMPTIONS', longName: 'Assumptions', kind: 'STRING', field: 'assumptions' },
  { id: 'AD-OWNER', longName: 'Owner', kind: 'STRING', field: 'owner' },
  { id: 'AD-CATEGORY', longName: 'Category', kind: 'STRING', field: 'category' },
  { id: 'AD-SOURCE', longName: 'Source', kind: 'STRING', field: 'source' },
  { id: 'AD-VERIF-STATUS', longName: 'Verification Status', kind: 'STRING', field: 'verificationStatus' },
  { id: 'AD-VERIF-NOTES', longName: 'Verification Notes', kind: 'STRING', field: 'verificationNotes' },
  { id: 'AD-TAGS', longName: 'Tags', kind: 'STRING', field: 'tags' },
]

/** A TraceLink row, narrowed to the fields the exporter needs. */
export interface ExportableTraceLink {
  sourceId: string
  targetId: string
  linkType: string
}

/** The deterministic SPEC-OBJECT IDENTIFIER for a requirement. */
function specObjectId(req: Requirement): string {
  return `SO-${req.id}`
}

/** Coerce a Requirement field value to a string for a STRING attribute. */
function fieldToString(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ')
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

/** Wrap plain text as a minimal XHTML fragment when a description is not HTML. */
function ensureXhtml(value: string): string {
  const v = (value ?? '').trim()
  if (!v) return ''
  // If it already looks like HTML, keep it; else escape + wrap in a <p>.
  if (/<[a-zA-Z][^>]*>/.test(v)) return v
  const escaped = v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<p>${escaped}</p>`
}

/**
 * Build the typed `ReqIFModel` for a project export.
 *
 * @param requirements ordered Requirement rows to export.
 * @param traceLinks   TraceLink rows whose source AND target are both in the
 *                     exported requirement set.
 */
export function buildExportModel(opts: {
  projectName: string
  projectDescription?: string | null
  requirements: Requirement[]
  traceLinks: ExportableTraceLink[]
  toolId?: string
}): ReqIFModel {
  const now = new Date().toISOString()
  const { requirements, traceLinks } = opts

  // --- DATATYPES ---------------------------------------------------------
  const datatypes: Datatype[] = [
    { identifier: DATATYPE_STRING_ID, kind: 'STRING', longName: 'String', lastChange: now, maxLength: '32000' },
    { identifier: DATATYPE_XHTML_ID, kind: 'XHTML', longName: 'XHTML', lastChange: now },
  ]

  // --- SPEC-OBJECT-TYPE --------------------------------------------------
  const attributeDefinitions: AttributeDefinition[] = EXPORT_ATTRS.map((a) => ({
    identifier: a.id,
    kind: a.kind,
    longName: a.longName,
    lastChange: now,
    datatypeRef: a.kind === 'XHTML' ? DATATYPE_XHTML_ID : DATATYPE_STRING_ID,
  }))
  const specObjectType: SpecObjectType = {
    identifier: SPEC_OBJECT_TYPE_ID,
    longName: 'Requirement',
    lastChange: now,
    attributeDefinitions,
  }

  // --- SPEC-OBJECTS ------------------------------------------------------
  const specObjects: SpecObject[] = requirements.map((req) => {
    const values: AttributeValue[] = []
    for (const a of EXPORT_ATTRS) {
      const raw = req[a.field]
      if (a.kind === 'XHTML') {
        const html = ensureXhtml(fieldToString(raw))
        if (html) {
          values.push({ definitionRef: a.id, kind: 'XHTML', value: html, isXhtml: true })
        }
      } else {
        const str = fieldToString(raw)
        if (str) {
          values.push({ definitionRef: a.id, kind: 'STRING', value: str, isXhtml: false })
        }
      }
    }
    return {
      identifier: specObjectId(req),
      longName: req.title,
      lastChange: req.updatedAt ? new Date(req.updatedAt).toISOString() : now,
      typeRef: SPEC_OBJECT_TYPE_ID,
      values,
    }
  })

  // --- SPEC-RELATION-TYPES (one per distinct linkType used) -------------
  const usedLinkTypes = new Set<string>()
  for (const tl of traceLinks) usedLinkTypes.add(tl.linkType || 'trace')
  const specRelationTypes: SpecRelationType[] = [...usedLinkTypes].map((lt) => ({
    identifier: linkTypeToRelationTypeId(lt),
    longName: linkTypeToLongName(lt),
    lastChange: now,
  }))

  // --- SPEC-RELATIONS ----------------------------------------------------
  const reqDbIds = new Set(requirements.map((r) => r.id))
  const specRelations: SpecRelation[] = []
  let relSeq = 0
  for (const tl of traceLinks) {
    if (!reqDbIds.has(tl.sourceId) || !reqDbIds.has(tl.targetId)) continue
    const lt = tl.linkType || 'trace'
    specRelations.push({
      identifier: `SR-${relSeq++}`,
      typeRef: linkTypeToRelationTypeId(lt),
      longName: linkTypeToLongName(lt),
      lastChange: now,
      sourceRef: `SO-${tl.sourceId}`,
      targetRef: `SO-${tl.targetId}`,
    })
  }

  // --- SPECIFICATION + SPEC-HIERARCHY (reflects parentId) ---------------
  const specificationTypes: SpecificationType[] = [
    { identifier: SPECIFICATION_TYPE_ID, longName: 'Requirements Specification', lastChange: now },
  ]

  // Build the parent->children adjacency, scoped to the exported set.
  const exportedById = new Map(requirements.map((r) => [r.id, r]))
  const childrenByParent = new Map<string | null, Requirement[]>()
  for (const req of requirements) {
    // A parentId pointing outside the exported set is treated as a root.
    const parentKey = req.parentId && exportedById.has(req.parentId) ? req.parentId : null
    const bucket = childrenByParent.get(parentKey) ?? []
    bucket.push(req)
    childrenByParent.set(parentKey, bucket)
  }

  let hierSeq = 0
  const buildHierarchyNode = (req: Requirement): SpecHierarchy => {
    const kids = childrenByParent.get(req.id) ?? []
    return {
      identifier: `SH-${hierSeq++}`,
      lastChange: now,
      objectRef: specObjectId(req),
      children: kids.map(buildHierarchyNode),
    }
  }
  const rootRequirements = childrenByParent.get(null) ?? []
  const hierarchyRoots: SpecHierarchy[] = rootRequirements.map(buildHierarchyNode)

  const specification: Specification = {
    identifier: `SPEC-${SPECIFICATION_TYPE_ID}`,
    longName: opts.projectName || 'Requirements',
    lastChange: now,
    typeRef: SPECIFICATION_TYPE_ID,
    children: hierarchyRoots,
  }

  return {
    header: {
      identifier: `reqif-export-${Date.now()}`,
      creationTime: now,
      reqIfVersion: '1.2',
      sourceToolId: opts.toolId ?? 'Engineering-Tool',
      toolId: opts.toolId ?? 'Engineering-Tool-v1.0',
      title: opts.projectName,
      comment: opts.projectDescription ?? `Requirements export from ${opts.projectName}`,
    },
    datatypes,
    specObjectTypes: [specObjectType],
    specRelationTypes,
    specificationTypes,
    specObjects,
    specRelations,
    specifications: [specification],
    warnings: [],
  }
}
