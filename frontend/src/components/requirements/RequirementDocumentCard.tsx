import React from 'react'
import { format } from 'date-fns'
import type { Requirement } from 'shared/types/engineering.types'
import type { Link } from 'shared/types/linkage.types'
import type { LinkedElementClickPayload } from './RequirementsPBSTree'
import clsx from 'clsx'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { plainTextFromRichText } from '../../utils/richText'
import { REQUIREMENT_FIELDS, REQUIREMENT_FIELD_LABELS, type RequirementFieldKey } from '../../config/requirementsFields'

/** Inline edit state when document view reuses page-level edit (optional). Accepts page InlineEditState; card only uses title/description. */
export type InlineEditStateForCard = {
  requirementId: string
  field: string
  value: string
}

interface RequirementDocumentCardProps {
  requirement: Requirement
  links: Link[]
  /** Visible column keys (from Requirements table column selector). When provided, the details section will be filtered accordingly. */
  visibleColumnKeys?: string[] | Set<string>
  /** Optional handler to open a linked element preview/details. */
  onLinkedElementClick?: (payload: LinkedElementClickPayload) => void
  projectName?: string
  onRequirementClick?: (req: Requirement) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
  /** Inline edit (from RequirementsPage document view) */
  inlineEdit?: InlineEditStateForCard | null
  onStartInlineEdit?: (req: Requirement, field: 'title' | 'description') => void
  onSaveInlineEdit?: () => void
  onCancelInlineEdit?: () => void
  onInlineEditChange?: (value: string) => void
  inlineInputRef?: React.RefObject<HTMLInputElement | null>
  inlineTextareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onInlineKeyDown?: (e: React.KeyboardEvent) => void
  onDescriptionKeyDown?: (e: React.KeyboardEvent) => void
  isBaselineView?: boolean
  density?: 'comfortable' | 'compact'
  collapsedDetails?: boolean
  collapsedRelationships?: boolean
  onToggleDetails?: () => void
  onToggleRelationships?: () => void
}

function formatLinkType(linkType: string): string {
  return linkType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatEntityType(type: string): string {
  const map: Record<string, string> = {
    requirement: 'Requirement',
    function: 'Function',
    pbs_component: 'PBS Component',
    change_request: 'Change Request',
    issue: 'Issue',
    test_plan: 'Test Plan',
    test_case: 'Test Case',
    verification: 'Verification',
    use_case: 'Use Case',
  }
  return map[type] ?? type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function shortId(id: string | undefined | null): string {
  if (!id) return '—'
  return String(id).slice(0, 8)
}

function looksLikeUuidishToken(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  // UUID v4-like or hex-with-dashes tokens; treat as non-human-friendly "name"
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t)) return true
  // Very long hex-ish strings (ids), sometimes without dashes
  if (/^[0-9a-f]{24,}$/i.test(t)) return true
  return false
}

function stripTrailingIdSuffix(title: string, idShort: string): string {
  const t = title.trim()
  if (!t) return t
  if (!/^[0-9a-f]{8}$/i.test(idShort)) return t
  const re = new RegExp(`\\s*\\(${idShort}\\)\\s*$`, 'i')
  const next = t.replace(re, '').trim()
  return next || t
}

function typePrefix(entityType: string): string | null {
  const t = String(entityType || '')
    .trim()
    .toLowerCase()
    // normalize any separators (spaces, dashes, slashes, etc.) to underscores
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const map: Record<string, string> = {
    requirement: 'REQ',
    issue: 'ISS',
    change_request: 'CR',
    function: 'FUN',
    pbs_component: 'PBS',
    test_case: 'TC',
    testcase: 'TC',
    test_plan: 'TP',
    verification: 'VER',
    interface: 'IF',
    parameter: 'PAR',
    document: 'DOC',
    safety: 'SAFE',
    use_case: 'UC',
  }
  return map[t] ?? null
}

const inputClassName =
  'flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500'
const textareaClassName =
  'flex-1 min-w-[200px] px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y'

export default function RequirementDocumentCard({
  requirement,
  links,
  visibleColumnKeys,
  onLinkedElementClick,
  projectName,
  onRequirementClick,
  draggable: isDraggable,
  onDragStart,
  inlineEdit,
  onStartInlineEdit,
  onSaveInlineEdit,
  onInlineEditChange,
  inlineInputRef,
  inlineTextareaRef,
  onInlineKeyDown,
  onDescriptionKeyDown,
  isBaselineView,
  density = 'comfortable',
  collapsedDetails: collapsedDetailsProp,
  collapsedRelationships: collapsedRelationshipsProp,
  onToggleDetails: onToggleDetailsProp,
  onToggleRelationships: onToggleRelationshipsProp,
}: RequirementDocumentCardProps) {
  const [collapsed, setCollapsed] = React.useState<{ details: boolean; relationships: boolean }>(() => {
    try {
      const stored = localStorage.getItem('requirements-doc-collapsed')
      if (stored) {
        const parsed = JSON.parse(stored) as any
        return { details: !!parsed?.details, relationships: !!parsed?.relationships }
      }
    } catch { /* ignore */ }
    return { details: false, relationships: false }
  })

  const persistCollapsed = React.useCallback((next: { details: boolean; relationships: boolean }) => {
    setCollapsed(next)
    try { localStorage.setItem('requirements-doc-collapsed', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  const collapsedDetails = typeof collapsedDetailsProp === 'boolean' ? collapsedDetailsProp : collapsed.details
  const collapsedRelationships = typeof collapsedRelationshipsProp === 'boolean' ? collapsedRelationshipsProp : collapsed.relationships
  const onToggleDetails = onToggleDetailsProp ?? (() => persistCollapsed({ ...collapsed, details: !collapsed.details }))
  const onToggleRelationships = onToggleRelationshipsProp ?? (() => persistCollapsed({ ...collapsed, relationships: !collapsed.relationships }))
  const canInlineEdit = !isBaselineView && onStartInlineEdit && onSaveInlineEdit && onInlineEditChange
  const isEditingTitle = inlineEdit?.requirementId === requirement.id && inlineEdit?.field === 'title'
  const isEditingDescription = inlineEdit?.requirementId === requirement.id && inlineEdit?.field === 'description'
  const createdFormatted = requirement.createdAt
    ? format(new Date(requirement.createdAt), 'MM/dd/yyyy hh:mm:ss a O')
    : '—'
  const updatedFormatted = requirement.updatedAt
    ? format(new Date(requirement.updatedAt), 'MM/dd/yyyy hh:mm:ss a O')
    : '—'

  const visibleSet: Set<string> | null = React.useMemo(() => {
    if (!visibleColumnKeys) return null
    if (visibleColumnKeys instanceof Set) return visibleColumnKeys
    if (Array.isArray(visibleColumnKeys)) return new Set(visibleColumnKeys)
    return null
  }, [visibleColumnKeys])

  const isVisible = React.useCallback(
    (key: string) => (visibleSet ? visibleSet.has(key) : true),
    [visibleSet]
  )

  const detailsAll: { key: RequirementFieldKey; label: string; value: string | undefined }[] = REQUIREMENT_FIELDS.map((f) => {
    const key = f.key
    const label = REQUIREMENT_FIELD_LABELS[key]
    const value = (() => {
      switch (key) {
        case 'requirementId': return requirement.requirementId ?? undefined
        case 'title': return requirement.title ?? undefined
        case 'description': return requirement.description ? plainTextFromRichText(requirement.description) : undefined
        case 'priority': return requirement.priority ?? undefined
        case 'status': return requirement.reviewStatus ?? requirement.status ?? undefined
        case 'owner': return requirement.owner ?? undefined
        case 'category': return requirement.category ?? undefined
        case 'source': return requirement.source ?? undefined
        case 'requirementType': return requirement.requirementType?.replace(/_/g, ' ') ?? undefined
        case 'requirementLevel': return (requirement as any).requirementLevel ?? undefined
        case 'risk': return (requirement as any).risk ?? undefined
        case 'complexity': return (requirement as any).complexity ?? undefined
        case 'verificationMethod': return requirement.verificationMethod ? plainTextFromRichText(requirement.verificationMethod) : undefined
        case 'verificationStatus': return requirement.verificationStatus || undefined
        case 'verificationDate': return requirement.verificationDate || undefined
        case 'linkedMocCode': return (requirement as any).linkedMocCode || undefined
        case 'acceptanceCriteria': return requirement.acceptanceCriteria ? plainTextFromRichText(requirement.acceptanceCriteria) : undefined
        case 'stage': return requirement.stage || undefined
        case 'rationale': return requirement.rationale ? plainTextFromRichText(requirement.rationale) : undefined
        case 'component': return (requirement as any).component?.name ?? (requirement as any).componentName ?? undefined
        case 'reviewStatus': return requirement.reviewStatus || undefined
        case 'createdAt': return requirement.createdAt ? createdFormatted : undefined
        case 'updatedAt': return requirement.updatedAt ? updatedFormatted : undefined
        default: return undefined
      }
    })()
    return { key, label, value }
  })

  const details = detailsAll.filter((d) => isVisible(d.key))
  const showCreatedUpdatedLine = isVisible('createdAt') || isVisible('updatedAt')

  const relationshipRows = links.map((link) => {
    const isOutgoing = link.sourceType === 'requirement' && link.sourceId === requirement.id
    const direction = isOutgoing ? 'Downstream' : 'Upstream'
    const entityType = String(isOutgoing ? (link.targetType as string) : (link.sourceType as string))
    const rawId = String(isOutgoing ? (link.targetId ?? '') : (link.sourceId ?? ''))
    const idShort = shortId(rawId)
    const preferredId = isOutgoing ? link.targetDisplayId : link.sourceDisplayId
    const prefix = typePrefix(entityType)
    const itemId = preferredId ?? (prefix ? `${prefix}-${idShort}` : `ID-${idShort}`)

    const rawName = String(
      isOutgoing
        ? ((link as any).targetLabel ?? link.targetTitle ?? link.targetDisplayId ?? link.targetId ?? '')
        : ((link as any).sourceLabel ?? link.sourceTitle ?? link.sourceDisplayId ?? link.sourceId ?? '')
    ).trim()

    const fallbackName = !preferredId ? formatEntityType(entityType) : `${formatEntityType(entityType)} (${idShort})`
    const name =
      rawName && !looksLikeUuidishToken(rawName) && rawName !== rawId
        ? stripTrailingIdSuffix(rawName, idShort)
        : fallbackName
    const group = formatEntityType(isOutgoing ? (link.targetType as string) : (link.sourceType as string))
    const relationship = formatLinkType(link.linkType)
    return {
      link,
      itemId,
      name,
      direction,
      project: projectName ?? '—',
      group,
      relationship,
      isOutgoing,
    }
  })

  const [relationshipFilters, setRelationshipFilters] = React.useState<{ direction: 'all' | 'upstream' | 'downstream'; groups: string[] }>(() => {
    try {
      const stored = localStorage.getItem('requirements-doc-relationship-filters')
      if (stored) {
        const parsed = JSON.parse(stored) as any
        const direction = parsed?.direction
        const groups = Array.isArray(parsed?.groups) ? parsed.groups.filter((x: any) => typeof x === 'string') : []
        return {
          direction: direction === 'upstream' || direction === 'downstream' ? direction : 'all',
          groups,
        }
      }
    } catch { /* ignore */ }
    return { direction: 'all', groups: [] }
  })

  const persistRelationshipFilters = React.useCallback((next: { direction: 'all' | 'upstream' | 'downstream'; groups: string[] }) => {
    setRelationshipFilters(next)
    try { localStorage.setItem('requirements-doc-relationship-filters', JSON.stringify(next)) } catch { /* ignore */ }
  }, [])

  const uniqueRelationshipGroups = React.useMemo(() => {
    return Array.from(new Set(relationshipRows.map((r) => r.group).filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [relationshipRows])

  const filteredRelationshipRows = React.useMemo(() => {
    const dir = relationshipFilters.direction
    const groups = relationshipFilters.groups
    return relationshipRows.filter((r) => {
      if (dir !== 'all' && r.direction.toLowerCase() !== dir) return false
      if (groups.length > 0 && !groups.includes(r.group)) return false
      return true
    })
  }, [relationshipRows, relationshipFilters.direction, relationshipFilters.groups])

  return (
    <div
      className={clsx(
        'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden',
        isDraggable && 'cursor-grab'
      )}
      draggable={isDraggable}
      onDragStart={onDragStart}
    >
      {/* Header */}
      <div
        className={clsx(
          'border-b border-gray-100 dark:border-gray-700/50',
          density === 'compact' ? 'px-4 py-3' : 'px-5 py-4'
        )}
      >
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          <span className="font-mono text-gray-600 dark:text-gray-400 mr-2">
            {requirement.requirementId ?? '—'}
          </span>
          {isEditingTitle && inlineInputRef && onInlineKeyDown && onSaveInlineEdit ? (
            <input
              ref={inlineInputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={inlineEdit.value}
              onChange={(e) => onInlineEditChange?.(e.target.value)}
              onKeyDown={onInlineKeyDown}
              onBlur={onSaveInlineEdit}
              className={clsx(inputClassName, 'w-full max-w-md')}
            />
          ) : (
            <button
              type="button"
              onClick={() => onRequirementClick?.(requirement)}
              onDoubleClick={
                canInlineEdit
                  ? (e) => {
                      e.stopPropagation()
                      onStartInlineEdit?.(requirement, 'title')
                    }
                  : undefined
              }
              title={canInlineEdit ? 'Double-click to edit' : undefined}
              className={clsx(
                onRequirementClick &&
                  'text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer'
              )}
            >
              {requirement.title}
            </button>
          )}
        </h2>
        {showCreatedUpdatedLine && (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {isVisible('createdAt') && <span>Created: {createdFormatted}</span>}
            {isVisible('createdAt') && isVisible('updatedAt') && <span> · </span>}
            {isVisible('updatedAt') && <span>Updated: {updatedFormatted}</span>}
          </p>
        )}
      </div>

      {/* Details section */}
      <div className={clsx(density === 'compact' ? 'px-4 py-3' : 'px-5 py-4')}>
        <button
          type="button"
          onClick={onToggleDetails}
          className={clsx(
            'w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3',
            onToggleDetails && 'hover:text-gray-900 dark:hover:text-white'
          )}
          title={collapsedDetails ? 'Expand details' : 'Collapse details'}
        >
          <span className="flex items-center gap-2">
            {collapsedDetails ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            Requirement Details
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">({details.length})</span>
          </span>
        </button>
        {!collapsedDetails && (
          <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
            <tbody>
              {details.map(({ key, label, value }) => {
                const isTitleRow = key === 'title'
                const isDescriptionRow = key === 'description'
                const showDescriptionTextarea =
                  isDescriptionRow && isEditingDescription && inlineTextareaRef && onDescriptionKeyDown && onSaveInlineEdit

                return (
                  <tr key={key} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
                    <td className="px-3 py-2 w-1/3 font-medium text-gray-600 dark:text-gray-400 bg-gray-50/50 dark:bg-gray-900/30">
                      {label}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                      {showDescriptionTextarea ? (
                        <textarea
                          ref={inlineTextareaRef as React.RefObject<HTMLTextAreaElement>}
                          value={inlineEdit!.value}
                          onChange={(e) => onInlineEditChange?.(e.target.value)}
                          onKeyDown={onDescriptionKeyDown}
                          onBlur={onSaveInlineEdit}
                          rows={3}
                          className={textareaClassName}
                        />
                      ) : isTitleRow && isEditingTitle ? (
                        inlineEdit?.value ?? '—'
                      ) : isTitleRow && canInlineEdit ? (
                        <span
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
                          title="Double-click to edit"
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            onStartInlineEdit?.(requirement, 'title')
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && onStartInlineEdit?.(requirement, 'title')}
                        >
                          {value ?? '—'}
                        </span>
                      ) : isDescriptionRow && canInlineEdit ? (
                        <span
                          role="button"
                          tabIndex={0}
                          className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 block"
                          title="Double-click to edit"
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            onStartInlineEdit?.(requirement, 'description')
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && onStartInlineEdit?.(requirement, 'description')}
                        >
                          {value ?? '—'}
                        </span>
                      ) : (
                        value ?? '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Relationships section */}
      <div className={clsx(density === 'compact' ? 'px-4 py-3' : 'px-5 py-4', 'border-t border-gray-100 dark:border-gray-700/50')}>
        <button
          type="button"
          onClick={onToggleRelationships}
          className={clsx(
            'w-full flex items-center justify-between text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3',
            onToggleRelationships && 'hover:text-gray-900 dark:hover:text-white'
          )}
          title={collapsedRelationships ? 'Expand relationships' : 'Collapse relationships'}
        >
          <span className="flex items-center gap-2">
            {collapsedRelationships ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            Relationships
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">({relationshipRows.length})</span>
          </span>
        </button>
        {!collapsedRelationships && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex rounded-md border border-gray-200 dark:border-gray-700 overflow-hidden">
                {(['all', 'upstream', 'downstream'] as const).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => persistRelationshipFilters({ ...relationshipFilters, direction: d })}
                    className={clsx(
                      'px-2.5 py-1 text-xs font-medium transition-colors',
                      relationshipFilters.direction === d
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {d === 'all' ? 'All' : d === 'upstream' ? 'Upstream' : 'Downstream'}
                  </button>
                ))}
              </div>
              {uniqueRelationshipGroups.length > 0 && (
                <select
                  value={relationshipFilters.groups[0] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    persistRelationshipFilters({ ...relationshipFilters, groups: v ? [v] : [] })
                  }}
                  className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
                  title="Filter by type"
                >
                  <option value="">Type: All</option>
                  {uniqueRelationshipGroups.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              )}
              {(relationshipFilters.direction !== 'all' || relationshipFilters.groups.length > 0) && (
                <button
                  type="button"
                  onClick={() => persistRelationshipFilters({ direction: 'all', groups: [] })}
                  className="text-xs px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  Clear filters
                </button>
              )}
            </div>

            {filteredRelationshipRows.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">No relationships</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-900/50">
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                        Item ID
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                        Name
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                        Direction
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                        Project
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                        Group
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                        Relationship
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRelationshipRows.map((row, idx) => (
                      <tr
                        key={idx}
                        onClick={() => {
                          if (!onLinkedElementClick) return
                          const l = row.link as any
                          const st = (l.linkSourceType ?? l.sourceType ?? 'requirement') as any
                          const sid = (l.linkSourceId ?? l.sourceId ?? requirement.id) as string
                          const tt = (l.linkTargetType ?? l.targetType) as any
                          const tid = (l.linkTargetId ?? l.targetId) as string
                          const outgoing = row.isOutgoing !== false
                          onLinkedElementClick({
                            sourceType: st,
                            sourceId: sid,
                            targetType: tt,
                            targetId: tid,
                            isOutgoing: outgoing,
                            contextRequirementId: requirement.id,
                            link: {
                              sourceType: st,
                              sourceId: sid,
                              targetType: tt,
                              targetId: tid,
                              targetDisplayId: outgoing ? (l.targetDisplayId ?? row.itemId) : undefined,
                              targetTitle: outgoing ? (l.targetTitle ?? row.name) : undefined,
                              targetLabel: outgoing ? (l.targetLabel ?? row.name) : undefined,
                              sourceDisplayId: !outgoing ? (l.sourceDisplayId ?? row.itemId) : undefined,
                              sourceTitle: !outgoing ? (l.sourceTitle ?? row.name) : undefined,
                              linkType: l.linkType,
                            },
                          })
                        }}
                        className={clsx(
                          "border-b border-gray-200 dark:border-gray-600 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-900/20",
                          onLinkedElementClick && "cursor-pointer"
                        )}
                      >
                        <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                          {row.itemId}
                        </td>
                        <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                          <span className="inline-flex items-center gap-1 group/name">
                            <span className={clsx(onLinkedElementClick && 'group-hover/name:underline')}>
                              {row.name}
                            </span>
                            {onLinkedElementClick && <ChevronRight size={14} className="opacity-0 group-hover/name:opacity-60 transition-opacity" />}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.direction}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.project}</td>
                        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{row.group}</td>
                        <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                          {row.relationship}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
