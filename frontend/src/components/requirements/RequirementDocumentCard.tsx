import React from 'react'
import { format } from 'date-fns'
import type { Requirement } from 'shared/types/engineering.types'
import type { Link } from 'shared/types/linkage.types'
import clsx from 'clsx'

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

function decodeHtmlEntities(input: string): string {
  const withNamed = input
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  return withNamed.replace(/&#(\d+);/g, (m, code) => {
    const n = Number(code)
    return Number.isFinite(n) ? String.fromCharCode(n) : m
  })
}

function plainTextFromRichText(input: string): string {
  const decoded = decodeHtmlEntities(input)
  return decoded.replace(/<[^>]*>/g, '').trim()
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
  const t = entityType.toLowerCase().replace(/-/g, '_')
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
}: RequirementDocumentCardProps) {
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

  const detailsAll: { key: string; label: string; value: string | undefined }[] = [
    { key: 'requirementId', label: 'ID', value: requirement.requirementId ?? undefined },
    { key: 'title', label: 'Title', value: requirement.title ?? undefined },
    { key: 'description', label: 'Description', value: requirement.description ? plainTextFromRichText(requirement.description) : undefined },
    { key: 'priority', label: 'Priority', value: requirement.priority ?? undefined },
    { key: 'status', label: 'Status', value: requirement.reviewStatus ?? requirement.status ?? undefined },
    { key: 'owner', label: 'Owner', value: requirement.owner ?? undefined },
    { key: 'category', label: 'Category', value: requirement.category ?? undefined },
    { key: 'source', label: 'Source', value: requirement.source ?? undefined },
    { key: 'requirementType', label: 'Type', value: requirement.requirementType?.replace(/_/g, ' ') ?? undefined },
    { key: 'requirementLevel', label: 'Level', value: requirement.requirementLevel ?? undefined },
    { key: 'risk', label: 'Risk', value: requirement.risk ?? undefined },
    { key: 'complexity', label: 'Complexity', value: requirement.complexity ?? undefined },
    { key: 'verificationMethod', label: 'Verification Method', value: requirement.verificationMethod ? plainTextFromRichText(requirement.verificationMethod) : undefined },
    { key: 'verificationStatus', label: 'Verification Status', value: requirement.verificationStatus || undefined },
    { key: 'verificationDate', label: 'Verification Date', value: requirement.verificationDate || undefined },
    { key: 'linkedMocCode', label: 'MoC', value: (requirement as any).linkedMocCode || undefined },
    { key: 'acceptanceCriteria', label: 'Acceptance Criteria', value: requirement.acceptanceCriteria ? plainTextFromRichText(requirement.acceptanceCriteria) : undefined },
    { key: 'stage', label: 'Stage', value: requirement.stage || undefined },
    { key: 'rationale', label: 'Rationale', value: requirement.rationale ? plainTextFromRichText(requirement.rationale) : undefined },
    { key: 'component', label: 'Component', value: (requirement as any).component?.name ?? (requirement as any).componentName ?? undefined },
    { key: 'reviewStatus', label: 'Review Status', value: requirement.reviewStatus || undefined },
    { key: 'createdAt', label: 'Created', value: requirement.createdAt ? createdFormatted : undefined },
    { key: 'updatedAt', label: 'Updated', value: requirement.updatedAt ? updatedFormatted : undefined },
  ]

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
    const itemId = preferredId ?? (prefix ? `${prefix}-${idShort}` : idShort)

    const rawName = String(
      isOutgoing
        ? ((link as any).targetLabel ?? link.targetTitle ?? link.targetDisplayId ?? link.targetId ?? '')
        : ((link as any).sourceLabel ?? link.sourceTitle ?? link.sourceDisplayId ?? link.sourceId ?? '')
    ).trim()

    const fallbackName =
      // If we already show the short id in the Item ID column, don't repeat it in Name.
      !preferredId && prefix
        ? formatEntityType(entityType)
        : `${formatEntityType(entityType)} (${idShort})`
    const name =
      rawName && !looksLikeUuidishToken(rawName) && rawName !== rawId
        ? stripTrailingIdSuffix(rawName, idShort)
        : fallbackName
    const group = formatEntityType(isOutgoing ? (link.targetType as string) : (link.sourceType as string))
    const relationship = formatLinkType(link.linkType)
    return {
      itemId,
      name,
      direction,
      project: projectName ?? '—',
      group,
      relationship,
    }
  })

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
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700/50">
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
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Requirement Details
        </h3>
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
      </div>

      {/* Relationships section */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700/50">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Relationships
        </h3>
        {relationshipRows.length === 0 ? (
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
                {relationshipRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-200 dark:border-gray-600 last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-900/20"
                  >
                    <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                      {row.itemId}
                    </td>
                    <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.name}</td>
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
      </div>
    </div>
  )
}
