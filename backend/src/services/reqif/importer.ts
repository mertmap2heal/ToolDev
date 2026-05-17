/**
 * ReqIF -> Requirement importer (NX-1).
 *
 * Converts a parsed `ReqIFModel` into `Requirement` rows (with `parentId`
 * hierarchy from SPEC-HIERARCHY) and `TraceLink` rows (with semantic
 * `linkType` resolved from SPEC-RELATION-TYPE).
 *
 * The model layer (`parser.ts` / `model.ts`) is package-neutral; this file is
 * the Requirements-specific consumer. A future Parameters unification co-ticket
 * adds a sibling `parameterImporter.ts` that consumes the same model.
 */
import { prisma } from '../../lib/prisma'
import { traceabilityService } from '../traceability.service'
import { buildRequirementChangeSummary, notifyRequirementSubscribers } from '../requirementNotification.service'
import { parseReqIFDocument } from './parser'
import { resolveLinkType } from './linkTypeMap'
import type { AttributeDefinition, ReqIFModel, SpecHierarchy, SpecObject } from './model'

/** A field-mapped requirement ready to persist. */
export interface MappedRequirement {
  /** The ReqIF SPEC-OBJECT IDENTIFIER — the import-time key. */
  reqifIdentifier: string
  /** Resolved `Requirement.requirementId` (the human key). */
  requirementId: string
  title: string
  description: string
  priority?: string
  status?: string
  requirementType?: string
  requirementLevel?: string
  risk?: string
  complexity?: string
  rationale?: string
  assumptions?: string
  owner?: string
  category?: string
  source?: string
  verificationStatus?: string
  verificationNotes?: string
  tags?: string[]
  /** ReqIF attributes with no dedicated Requirement column. */
  customAttributes?: Record<string, string>
}

/** Result of an importModelIntoProject run. */
export interface ReqIFImportResult {
  created: number
  updated: number
  skipped: number
  linksCreated: number
  /** Per-row mapping/persist failures. */
  errors: Array<{ row: number; errors: string[] }>
  /** Non-fatal observations: lossy link mappings, parser warnings, etc. */
  warnings: string[]
}

/**
 * Heuristic: classify an ATTRIBUTE-DEFINITION's purpose from its LONG-NAME /
 * IDENTIFIER, so a SPEC-OBJECT attribute maps to the right Requirement column.
 * Recognises the standard ReqIF.* names plus our own export's `req-*` ids.
 */
type FieldKey =
  | 'requirementId'
  | 'title'
  | 'description'
  | 'priority'
  | 'status'
  | 'requirementType'
  | 'requirementLevel'
  | 'risk'
  | 'complexity'
  | 'rationale'
  | 'assumptions'
  | 'owner'
  | 'category'
  | 'source'
  | 'verificationStatus'
  | 'verificationNotes'
  | 'tags'
  | null

function classifyField(longName: string | undefined, identifier: string): FieldKey {
  const hay = `${longName ?? ''} ${identifier}`.toLowerCase()
  // Order matters: most specific first.
  if (/verification[\s_-]*status/.test(hay)) return 'verificationStatus'
  if (/verification[\s_-]*notes/.test(hay)) return 'verificationNotes'
  if (/(\breq[\s_-]*id\b|requirement[\s_-]*id|\bforeignid\b|\bchapter[\s_-]*name\b)/.test(hay)) return 'requirementId'
  if (/(longname|\bname\b|\btitle\b|\bheading\b)/.test(hay)) return 'title'
  if (/(description|\bdesc\b|\btext\b|primary[\s_-]*text|\bbody\b)/.test(hay)) return 'description'
  if (/priority/.test(hay)) return 'priority'
  if (/status/.test(hay)) return 'status'
  if (/(requirement[\s_-]*type|\bobjecttype\b|\bcategory[\s_-]*type\b)/.test(hay)) return 'requirementType'
  if (/(requirement[\s_-]*level|\blevel\b)/.test(hay)) return 'requirementLevel'
  if (/\brisk\b/.test(hay)) return 'risk'
  if (/complexity/.test(hay)) return 'complexity'
  if (/rationale/.test(hay)) return 'rationale'
  if (/assumption/.test(hay)) return 'assumptions'
  if (/\bowner\b/.test(hay)) return 'owner'
  if (/\bcategory\b/.test(hay)) return 'category'
  if (/\bsource\b/.test(hay)) return 'source'
  if (/\btags?\b/.test(hay)) return 'tags'
  return null
}

/** Strip XHTML tags to plain text — used only when an XHTML value lands in a plain field. */
function plainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Map one SPEC-OBJECT to a `MappedRequirement`, resolving each attribute value
 * against the type/definition dictionaries so it lands in the right column.
 */
export function mapSpecObjectToRequirement(
  so: SpecObject,
  defIndex: Map<string, AttributeDefinition>,
): MappedRequirement {
  const fields: Partial<Record<Exclude<FieldKey, null>, string>> = {}
  const customAttributes: Record<string, string> = {}
  let tags: string[] | undefined

  for (const av of so.values) {
    const def = av.definitionRef ? defIndex.get(av.definitionRef) : undefined
    const longName = def?.longName
    const identifier = av.definitionRef || ''
    const fieldKey = classifyField(longName, identifier)
    const raw = av.value ?? ''

    if (fieldKey === 'tags') {
      tags = raw
        .split(/[;,]/)
        .map((t) => t.trim())
        .filter(Boolean)
      continue
    }
    if (fieldKey === 'description') {
      // Keep XHTML payload as HTML (TipTap-compatible); plain values as-is.
      fields.description = av.isXhtml ? raw : raw
      continue
    }
    if (fieldKey) {
      // Non-description plain fields: collapse any stray markup.
      fields[fieldKey] = av.isXhtml ? plainText(raw) : raw
      continue
    }
    // No dedicated column — preserve under customAttributes keyed by LONG-NAME.
    if (raw) {
      const key = (longName && longName.trim()) || identifier || `attr-${Object.keys(customAttributes).length}`
      customAttributes[key] = av.isXhtml ? plainText(raw) : raw
    }
  }

  // Title fallbacks: explicit title field -> SPEC-OBJECT LONG-NAME -> identifier.
  const title = (fields.title && fields.title.trim()) || (so.longName && so.longName.trim()) || so.identifier
  // requirementId fallbacks: explicit req-id field -> SPEC-OBJECT identifier.
  const requirementId = (fields.requirementId && fields.requirementId.trim()) || so.identifier

  return {
    reqifIdentifier: so.identifier,
    requirementId,
    title: title || so.identifier || 'Untitled Requirement',
    description: fields.description ?? '',
    priority: fields.priority,
    status: fields.status,
    requirementType: fields.requirementType,
    requirementLevel: fields.requirementLevel,
    risk: fields.risk,
    complexity: fields.complexity,
    rationale: fields.rationale,
    assumptions: fields.assumptions,
    owner: fields.owner,
    category: fields.category,
    source: fields.source,
    verificationStatus: fields.verificationStatus,
    verificationNotes: fields.verificationNotes,
    tags,
    customAttributes: Object.keys(customAttributes).length ? customAttributes : undefined,
  }
}

/**
 * Walk a SPEC-HIERARCHY tree, recording the parent SPEC-OBJECT identifier for
 * every nested object. Returns `objectId -> parentObjectId`.
 */
function buildParentMap(roots: SpecHierarchy[]): Map<string, string> {
  const parentByObject = new Map<string, string>()
  const walk = (node: SpecHierarchy, parentObjectRef: string | undefined): void => {
    const myObjectRef = node.objectRef
    if (myObjectRef && parentObjectRef && parentObjectRef !== myObjectRef) {
      parentByObject.set(myObjectRef, parentObjectRef)
    }
    for (const c of node.children) {
      walk(c, myObjectRef ?? parentObjectRef)
    }
  }
  for (const root of roots) walk(root, undefined)
  return parentByObject
}

/**
 * Import a parsed `ReqIFModel` into a project: create/update Requirements,
 * reconstruct the parentId hierarchy, and create typed TraceLinks.
 *
 * Requirements are matched by `requirementId` within the project. An existing
 * match is updated; a new one is created. SPEC-RELATIONs become TraceLinks
 * with a semantic `linkType`.
 */
export async function importModelIntoProject(
  projectId: string,
  model: ReqIFModel,
  actorUserId?: string,
): Promise<ReqIFImportResult> {
  const result: ReqIFImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    linksCreated: 0,
    errors: [],
    warnings: [...model.warnings],
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error('Project not found')

  // ATTRIBUTE-DEFINITION dictionary (identifier -> definition) for field mapping.
  const defIndex = new Map<string, AttributeDefinition>()
  for (const t of model.specObjectTypes) {
    for (const def of t.attributeDefinitions) defIndex.set(def.identifier, def)
  }

  // Map every SPEC-OBJECT.
  const mapped: MappedRequirement[] = model.specObjects.map((so) =>
    mapSpecObjectToRequirement(so, defIndex),
  )

  // ReqIF SPEC-OBJECT identifier -> DB Requirement id (filled as we persist).
  const objectIdToDbId = new Map<string, string>()

  // Existing requirements in the project, keyed by requirementId.
  const incomingReqIds = mapped.map((m) => m.requirementId).filter(Boolean)
  const existing = incomingReqIds.length
    ? await prisma.requirement.findMany({
        where: { projectId, requirementId: { in: incomingReqIds }, deletedAt: null },
      })
    : []
  const existingByReqId = new Map(existing.map((e) => [e.requirementId as string, e]))

  // Parent map from the SPEC-HIERARCHY tree(s).
  const allHierarchyRoots = model.specifications.flatMap((s) => s.children)
  const parentByObject = buildParentMap(allHierarchyRoots)

  // Persist requirements. Two phases so a parent always exists before its
  // child's parentId is written: phase 1 create/update rows, phase 2 wire
  // parentId once every object has a DB id.
  for (let i = 0; i < mapped.length; i++) {
    const m = mapped[i]
    if (!m.reqifIdentifier) {
      result.errors.push({ row: i + 1, errors: ['SPEC-OBJECT missing IDENTIFIER'] })
      result.skipped++
      continue
    }
    const exist = existingByReqId.get(m.requirementId)
    try {
      if (exist) {
        const updatedReq = await prisma.requirement.update({
          where: { id: exist.id },
          data: {
            title: m.title,
            description: m.description || exist.description,
            priority: m.priority || exist.priority,
            status: m.status || exist.status,
            requirementType: m.requirementType ?? exist.requirementType,
            requirementLevel: m.requirementLevel ?? exist.requirementLevel,
            risk: m.risk ?? exist.risk,
            complexity: m.complexity ?? exist.complexity,
            rationale: m.rationale ?? exist.rationale,
            assumptions: m.assumptions ?? exist.assumptions,
            owner: m.owner ?? exist.owner,
            category: m.category ?? exist.category,
            source: m.source ?? exist.source,
            verificationStatus: m.verificationStatus ?? exist.verificationStatus,
            verificationNotes: m.verificationNotes ?? exist.verificationNotes,
            tags: m.tags ?? exist.tags,
            customAttributes: m.customAttributes
              ? mergeCustomAttributes(exist.customAttributes, m.customAttributes)
              : exist.customAttributes ?? undefined,
          },
        })
        objectIdToDbId.set(m.reqifIdentifier, updatedReq.id)
        try {
          const changes = buildRequirementChangeSummary(exist, updatedReq)
          await notifyRequirementSubscribers({
            projectId,
            requirementId: updatedReq.id,
            actorUserId,
            changes,
            requirementSnapshot: {
              id: updatedReq.id,
              requirementId: updatedReq.requirementId,
              title: updatedReq.title,
            },
          })
        } catch {
          // Notification failure must not fail the import.
        }
        result.updated++
      } else {
        const createdReq = await prisma.requirement.create({
          data: {
            projectId,
            requirementId: m.requirementId,
            title: m.title,
            description: m.description || ' ',
            priority: m.priority || 'medium',
            status: m.status || 'draft',
            stage: '',
            requirementType: m.requirementType ?? undefined,
            requirementLevel: m.requirementLevel ?? undefined,
            risk: m.risk ?? undefined,
            complexity: m.complexity ?? undefined,
            rationale: m.rationale ?? undefined,
            assumptions: m.assumptions ?? undefined,
            owner: m.owner ?? undefined,
            category: m.category ?? undefined,
            source: m.source ?? undefined,
            verificationStatus: m.verificationStatus ?? undefined,
            verificationNotes: m.verificationNotes ?? undefined,
            tags: m.tags ?? undefined,
            customAttributes: m.customAttributes ?? undefined,
          },
        })
        objectIdToDbId.set(m.reqifIdentifier, createdReq.id)
        existingByReqId.set(m.requirementId, createdReq)
        result.created++
      }
    } catch (e) {
      result.errors.push({ row: i + 1, errors: [(e as Error).message || 'Failed to import requirement'] })
      result.skipped++
    }
  }

  // Phase 2: wire parentId from the SPEC-HIERARCHY tree.
  for (const [childObjectRef, parentObjectRef] of parentByObject) {
    const childDbId = objectIdToDbId.get(childObjectRef)
    const parentDbId = objectIdToDbId.get(parentObjectRef)
    if (!childDbId || !parentDbId || childDbId === parentDbId) continue
    try {
      await prisma.requirement.update({
        where: { id: childDbId },
        data: { parentId: parentDbId },
      })
    } catch {
      result.warnings.push(`Could not set parent for SPEC-OBJECT ${childObjectRef}`)
    }
  }

  // SPEC-RELATIONs -> TraceLinks with semantic linkType.
  const relTypeById = new Map(model.specRelationTypes.map((t) => [t.identifier, t]))
  const fellBackCounts = new Map<string, number>()
  for (const rel of model.specRelations) {
    const sourceDbId = objectIdToDbId.get(rel.sourceRef) ?? existingByReqId.get(rel.sourceRef)?.id
    const targetDbId = objectIdToDbId.get(rel.targetRef) ?? existingByReqId.get(rel.targetRef)?.id
    if (!sourceDbId || !targetDbId) continue
    const relType = rel.typeRef ? relTypeById.get(rel.typeRef) : undefined
    const longName = relType?.longName ?? rel.longName
    const { linkType, fellBack } = resolveLinkType(longName)
    if (fellBack && longName) {
      fellBackCounts.set(longName, (fellBackCounts.get(longName) ?? 0) + 1)
    }
    try {
      await traceabilityService.createTraceLink(
        projectId,
        'requirement',
        sourceDbId,
        'requirement',
        targetDbId,
        linkType,
        undefined,
        'Imported from ReqIF',
        actorUserId,
      )
      result.linksCreated++
    } catch {
      // Duplicate / invalid link — ignore.
    }
  }
  for (const [longName, count] of fellBackCounts) {
    result.warnings.push(
      `${count} relation(s) imported as generic 'trace' — unmapped SPEC-RELATION-TYPE: "${longName}"`,
    )
  }

  return result
}

/** Merge an existing customAttributes JSON value with new keys. */
function mergeCustomAttributes(
  existing: unknown,
  incoming: Record<string, string>,
): Record<string, string> {
  const base: Record<string, string> = {}
  if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
    for (const [k, v] of Object.entries(existing as Record<string, unknown>)) {
      if (typeof v === 'string') base[k] = v
    }
  }
  return { ...base, ...incoming }
}

/**
 * Convenience: parse a ReqIF XML string and import it into a project in one
 * call. The single entry point both controller call-sites converge onto.
 */
export async function importReqIFXml(
  projectId: string,
  xml: string,
  actorUserId?: string,
): Promise<ReqIFImportResult> {
  const model = parseReqIFDocument(xml)
  return importModelIntoProject(projectId, model, actorUserId)
}
