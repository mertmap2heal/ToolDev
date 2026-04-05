import type { Link as LinkRecord } from 'shared/types/linkage.types'
import type { Requirement } from 'shared/types/engineering.types'

/** Flat PBS/component row (same shape as RequirementsPage flatComponents). */
export type PBSFlatComponent = { id: string; name: string; pbsCode?: string | null; description?: string | null }

/** Issue shape from API/store (may include nulls). */
export type BuildRequirementLinkedItemsIssue = {
  id: string
  title: string
  description?: string | null
  issueKey?: string | null
  createdByUser?: { id: string; name: string; email: string }
}

/** Normalized issue on a linked row (UI / strict consumers). */
export type RequirementLinkedItemIssue = {
  id: string
  title: string
  issueKey?: string
  createdByUser?: { id: string; name: string; email: string }
}

export type BuildRequirementLinkedItemsChangeRequest = {
  id: string
  title: string
  description?: string | null
  crId?: string | null
}

export type BuildRequirementLinkedItemsFunction = {
  id: string
  name: string
  description?: string | null
  functionId?: string | null
}

export type RequirementLinkedItemRow = {
  /** Stable row key for React lists */
  id: string
  targetType: string
  targetId: string
  label?: string
  title?: string
  description?: string
  displayId?: string
  linkType?: string
  /** From the requirement's perspective (for preview popover). */
  isOutgoing: boolean
  /** Actual link endpoints for TraceLink-backed rows. */
  linkSourceType: string
  linkSourceId: string
  linkTargetType: string
  linkTargetId: string
  issue?: RequirementLinkedItemIssue
}

export type BuildRequirementLinkedItemsContext = {
  issues: BuildRequirementLinkedItemsIssue[]
  changeRequests: BuildRequirementLinkedItemsChangeRequest[]
  functions: BuildRequirementLinkedItemsFunction[]
  requirements: Requirement[]
  flatComponents: PBSFlatComponent[]
}

const norm = (t: string | undefined) => (t ?? '').toLowerCase().replace(/-/g, '_')

function isRequirementEntityType(t: string | undefined): boolean {
  const n = norm(t)
  return n === 'requirement' || n === 'hazard' || n === 'risk'
}

function keyOf(l: LinkRecord): string {
  return l.id ?? `${l.sourceType}-${l.sourceId}-${l.targetType}-${l.targetId}`
}

export function hasAllocatedToComponent(
  links: LinkRecord[],
  reqId: string,
  componentId: string
): boolean {
  return links.some((l) => {
    const st = norm(l.sourceType)
    const tt = norm(l.targetType)
    const lt = norm(l.linkType)
    if (lt !== 'allocated_to' && lt !== 'allocate') return false
    if (st === 'requirement' && l.sourceId === reqId && tt === 'pbs_component' && l.targetId === componentId)
      return true
    if (tt === 'requirement' && l.targetId === reqId && st === 'pbs_component' && l.sourceId === componentId)
      return true
    return false
  })
}

function getPBSDisplayId(comp: PBSFlatComponent | undefined, componentId: string): string {
  const code = comp?.pbsCode?.trim()
  if (code) return code.startsWith('OPBS') ? code : code.startsWith('PBS') ? 'O' + code : code
  return 'OPBS-' + componentId.slice(0, 8)
}

function formatPBSLabel(comp: PBSFlatComponent | undefined, componentId: string): string {
  const name = comp?.name?.trim() ?? ''
  const idPart = getPBSDisplayId(comp, componentId)
  return name ? `${idPart}-${name}` : idPart
}

function enrichRow(
  targetType: string,
  targetId: string,
  linkType: string | undefined,
  ctx: BuildRequirementLinkedItemsContext
): Omit<RequirementLinkedItemRow, 'id' | 'isOutgoing' | 'linkSourceType' | 'linkSourceId' | 'linkTargetType' | 'linkTargetId'> {
  const tt = norm(targetType)
  const item: Omit<
    RequirementLinkedItemRow,
    'id' | 'isOutgoing' | 'linkSourceType' | 'linkSourceId' | 'linkTargetType' | 'linkTargetId'
  > = {
    targetType,
    targetId,
    label: `${targetType}:${targetId}`,
    linkType,
  }

  if (tt === 'issue') {
    const issue = ctx.issues.find((i) => i.id === targetId)
    if (issue) {
      item.title = issue.title
      item.description = issue.description ?? undefined
      item.displayId = issue.issueKey || issue.id.substring(0, 8)
      item.issue = {
        id: issue.id,
        title: issue.title,
        issueKey: issue.issueKey ?? undefined,
        createdByUser: issue.createdByUser,
      }
    }
  } else if (tt === 'change_request') {
    const cr = ctx.changeRequests.find((c) => c.id === targetId)
    if (cr) {
      item.title = cr.title
      item.description = cr.description ?? undefined
      item.displayId = cr.crId || cr.id.substring(0, 8)
    }
  } else if (isRequirementEntityType(targetType)) {
    const req = ctx.requirements.find((r) => r.id === targetId)
    if (req) {
      item.title = req.title
      item.description = req.description
      item.displayId = req.requirementId || req.id.substring(0, 8)
    }
  } else if (tt === 'function') {
    const func = ctx.functions.find((f) => f.id === targetId)
    if (func) {
      item.title = func.name
      item.description = func.description ?? undefined
      item.displayId = func.functionId || func.id.substring(0, 8)
    }
  } else if (tt === 'pbs_component') {
    const comp = ctx.flatComponents.find((c) => c.id === targetId)
    if (comp) {
      item.title = comp.name
      item.description = comp.description ?? undefined
      item.displayId = comp.pbsCode || getPBSDisplayId(comp, targetId)
    } else {
      item.displayId = `PBS:${targetId.slice(0, 8)}`
    }
  }

  item.label = item.title ?? item.label
  return item
}

/**
 * All edges touching this requirement from project `effectiveLinks`, bidirectional,
 * deduped by link id, plus synthetic PBS allocation when `requirement.componentId` is set
 * and no equivalent allocated_to link exists (matches RequirementsPBSTree behavior).
 */
export function buildRequirementLinkedItems(
  requirementId: string,
  requirement: Requirement | undefined,
  effectiveLinks: LinkRecord[],
  ctx: BuildRequirementLinkedItemsContext
): RequirementLinkedItemRow[] {
  const rows: RequirementLinkedItemRow[] = []
  const seen = new Set<string>()

  for (const l of effectiveLinks) {
    const st = norm(l.sourceType)
    const tt = norm(l.targetType)
    let otherType: string | undefined
    let otherId: string | undefined
    let isOutgoing: boolean
    const linkSourceType = l.sourceType
    const linkSourceId = l.sourceId
    const linkTargetType = l.targetType
    const linkTargetId = l.targetId

    if (isRequirementEntityType(l.sourceType) && l.sourceId === requirementId) {
      otherType = l.targetType
      otherId = l.targetId
      isOutgoing = true
    } else if (isRequirementEntityType(l.targetType) && l.targetId === requirementId) {
      otherType = l.sourceType
      otherId = l.sourceId
      isOutgoing = false
    } else {
      continue
    }

    if (!otherType || !otherId) continue

    const k = keyOf(l)
    if (seen.has(k)) continue
    seen.add(k)

    const enriched = enrichRow(otherType, otherId, l.linkType, ctx)
    rows.push({
      id: l.id ?? k,
      ...enriched,
      isOutgoing,
      linkSourceType,
      linkSourceId,
      linkTargetType,
      linkTargetId,
    })
  }

  const compId = requirement?.componentId
  if (compId && !hasAllocatedToComponent(effectiveLinks, requirementId, compId)) {
    const comp = ctx.flatComponents.find((c) => c.id === compId)
    const label = formatPBSLabel(comp, compId)
    const synthKey = `synthetic-pbs-${requirementId}-${compId}`
    rows.push({
      id: synthKey,
      targetType: 'pbs_component',
      targetId: compId,
      label,
      title: label,
      description: comp?.description ?? undefined,
      displayId: getPBSDisplayId(comp, compId),
      linkType: 'allocated_to',
      isOutgoing: true,
      linkSourceType: 'requirement',
      linkSourceId: requirementId,
      linkTargetType: 'pbs_component',
      linkTargetId: compId,
    })
  }

  return rows
}

export function countRequirementLinkedItems(
  requirementId: string,
  requirement: Requirement | undefined,
  effectiveLinks: LinkRecord[],
  ctx: BuildRequirementLinkedItemsContext
): number {
  return buildRequirementLinkedItems(requirementId, requirement, effectiveLinks, ctx).length
}

/**
 * For traceability matrix: true if requirement `reqId` is linked to target `targetId` of type `linkageTargetType`,
 * using the same bidirectional + synthetic PBS rules as `buildRequirementLinkedItems`.
 */
export function isRequirementLinkedToTarget(
  reqId: string,
  requirement: Requirement | undefined,
  targetId: string,
  linkageTargetType: string,
  effectiveLinks: LinkRecord[],
  ctx: BuildRequirementLinkedItemsContext
): boolean {
  const want = norm(linkageTargetType)
  const items = buildRequirementLinkedItems(reqId, requirement, effectiveLinks, ctx)
  return items.some((row) => norm(row.targetType) === want && row.targetId === targetId)
}
