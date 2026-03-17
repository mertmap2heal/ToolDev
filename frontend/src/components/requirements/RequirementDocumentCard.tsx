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

const inputClassName =
  'flex-1 px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500'
const textareaClassName =
  'flex-1 min-w-[200px] px-2 py-1 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-y'

export default function RequirementDocumentCard({
  requirement,
  links,
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

  const details: { label: string; value: string | undefined }[] = [
    { label: 'Project ID', value: requirement.requirementId ?? undefined },
    { label: 'Global ID', value: requirement.id ? `GID-${requirement.id.slice(-5)}` : undefined },
    { label: 'Name', value: requirement.title },
    { label: 'Description', value: requirement.description || undefined },
    {
      label: 'Requirement Category',
      value: requirement.category ?? requirement.requirementType?.replace(/_/g, ' '),
    },
    { label: 'Rationale', value: requirement.rationale || undefined },
    { label: 'Verification Method', value: requirement.verificationMethod || undefined },
    {
      label: 'Status',
      value: requirement.reviewStatus ?? requirement.status ?? undefined,
    },
    { label: 'Derived?', value: requirement.source === 'Derived' ? 'Yes' : 'No' },
  ]

  const relationshipRows = links.map((link) => {
    const isOutgoing = link.sourceType === 'requirement' && link.sourceId === requirement.id
    const direction = isOutgoing ? 'Downstream' : 'Upstream'
    const itemId = isOutgoing ? (link.targetDisplayId ?? link.targetId?.slice(0, 8)) : (link.sourceDisplayId ?? link.sourceId?.slice(0, 8))
    const name = isOutgoing ? (link.targetTitle ?? link.targetId) : (link.sourceTitle ?? link.sourceId)
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
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Created: {createdFormatted} · Updated: {updatedFormatted}
        </p>
      </div>

      {/* Details section */}
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Requirement Details
        </h3>
        <table className="w-full text-sm border-collapse border border-gray-200 dark:border-gray-600">
          <tbody>
            {details.map(({ label, value }) => {
              const isNameRow = label === 'Name'
              const isDescriptionRow = label === 'Description'
              const showDescriptionTextarea =
                isDescriptionRow && isEditingDescription && inlineTextareaRef && onDescriptionKeyDown && onSaveInlineEdit

              return (
                <tr key={label} className="border-b border-gray-200 dark:border-gray-600 last:border-b-0">
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
                    ) : isNameRow && isEditingTitle ? (
                      inlineEdit?.value ?? '—'
                    ) : isNameRow && canInlineEdit ? (
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
