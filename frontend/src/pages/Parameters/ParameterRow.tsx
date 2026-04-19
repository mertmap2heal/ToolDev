import React, { memo } from 'react'
import { Folder, FileText, Edit2, Trash2 } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { useDraggable } from '@dnd-kit/core'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'
import type { ParameterWithUsage } from '../../services/parameter.service'

export type ColKey =
  | 'description'
  | 'type'
  | 'value'
  | 'computed'
  | 'unit'
  | 'folder'
  | 'source'
  | 'status'
  | 'usedIn'
  | 'created'

const ROW_HOVER = 'hover:bg-gray-200/20 dark:hover:bg-gray-400/10'

export interface ParameterRowProps {
  param: ParameterWithUsage
  visibleCols: Set<ColKey>
  showGroups: boolean
  selectedFolderId: string | null
  selected: boolean
  foldersById: Map<string, ParameterFolder>
  computedVal: string | undefined
  isInlineEditing: boolean
  inlineEditValue: string
  deleteConfirmPending: boolean
  folderOptions: Array<{ value: string; label: string }>
  onToggleSelection: (paramId: string) => void
  onOpenDetail: (param: Parameter) => void
  onStartInlineEdit: (param: Parameter) => void
  onInlineEditChange: (v: string) => void
  onSaveInlineEdit: (paramId: string) => void
  onCancelInlineEdit: () => void
  onViewSource: (param: Parameter) => void
  onMoveToFolder: (paramId: string, folderId: string | null) => void
  onOpenChangeRequest: (param: Parameter) => void
  onEditClick: (e: React.MouseEvent, param: Parameter) => void
  onDeleteClick: (e: React.MouseEvent, paramId: string, paramName: string) => void
  // Virtualiser hooks (phase 2c-iii). When rendered inside TanStack
  // Virtual, the parent supplies measureRef + dataIndex so the
  // virtualiser can measure real heights via ResizeObserver.
  measureRef?: (el: HTMLElement | null) => void
  dataIndex?: number
}

function ParameterRowImpl(props: ParameterRowProps) {
  const {
    param,
    visibleCols,
    showGroups,
    selectedFolderId,
    selected,
    foldersById,
    computedVal,
    isInlineEditing,
    inlineEditValue,
    deleteConfirmPending,
    folderOptions,
    onToggleSelection,
    onOpenDetail,
    onStartInlineEdit,
    onInlineEditChange,
    onSaveInlineEdit,
    onCancelInlineEdit,
    onViewSource,
    onMoveToFolder,
    onOpenChangeRequest,
    onEditClick,
    onDeleteClick,
    measureRef,
    dataIndex,
  } = props

  const folder = param.folderId ? foldersById.get(param.folderId) : undefined
  const parentFolder = folder?.parentId ? foldersById.get(folder.parentId) : null
  const folderPath = folder
    ? parentFolder
      ? `${parentFolder.name} / ${folder.name}`
      : folder.name
    : null
  const showFolderBadge =
    folder && !showGroups && selectedFolderId !== null && selectedFolderId !== param.folderId

  const folderColor = showGroups ? null : folder?.color
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `param-${param.id}`,
  })
  const rowRef = (el: HTMLTableRowElement | null) => {
    setNodeRef(el)
    if (measureRef) measureRef(el)
  }

  return (
    <tr
      ref={rowRef}
      data-index={dataIndex}
      className={clsx(
        'cursor-grab border-b border-gray-200 dark:border-gray-700',
        ROW_HOVER,
        isDragging && 'opacity-40',
      )}
      // #278: folder colour is user-assigned hex, not a design token.
      // Phase 2c-iii: height pinned to 36 px so the virtualizer's
      // spacer-row math stays exact -- prevents drift + blank gaps
      // on fast scroll without needing measureElement (which froze
      // the tab via known tanstack/virtual #997 #1001).
      style={{
        borderLeft: folderColor ? `3px solid ${folderColor}` : '3px solid transparent',
        height: 36,
      }}
      {...attributes}
      {...listeners}
    >
      <td
        className="px-3 py-2 w-8 sticky left-0 z-[1] bg-gray-50 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelection(param.id)}
          className="cursor-pointer"
        />
      </td>
      <td className="px-3 py-1.5 sticky left-8 z-[1] bg-gray-50 dark:bg-gray-800 shadow-[2px_0_4px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={() => onOpenDetail(param)}
          className="bg-transparent border-none cursor-pointer text-blue-600 dark:text-blue-400 font-semibold text-xs p-0 whitespace-nowrap block"
        >
          {param.name}
        </button>
        {showFolderBadge && folderPath && (
          <span
            className="inline-flex items-center gap-[3px] text-[10px] mt-px text-gray-600 dark:text-gray-400"
            style={folder?.color ? { color: folder.color } : undefined}
          >
            <Folder size={9} className="shrink-0" />
            {folderPath}
          </span>
        )}
      </td>
      {visibleCols.has('description') && (
        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 max-w-[200px]">
          <span
            className="overflow-hidden block text-ellipsis whitespace-nowrap"
            title={param.description ?? ''}
          >
            {param.description || '—'}
          </span>
        </td>
      )}
      {visibleCols.has('type') && (
        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{param.dataType || '—'}</td>
      )}
      {visibleCols.has('value') && (
        <td
          className="px-3 py-2 font-mono text-gray-900 dark:text-gray-100 min-w-[80px]"
          onClick={(e) => {
            if (!isInlineEditing) {
              e.stopPropagation()
              onStartInlineEdit(param)
            }
          }}
          title={isInlineEditing ? undefined : 'Click to edit value'}
        >
          {isInlineEditing ? (
            <input
              autoFocus
              value={inlineEditValue}
              onChange={(e) => onInlineEditChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation()
                  onSaveInlineEdit(param.id)
                }
                if (e.key === 'Escape') {
                  e.stopPropagation()
                  onCancelInlineEdit()
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-1.5 py-0.5 font-mono text-xs border border-blue-600 dark:border-blue-400 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 outline-none"
            />
          ) : (
            <span className="flex items-center gap-[5px]">
              <span>{param.defaultValue || '—'}</span>
              {param.formula && (
                <span
                  title={param.formula}
                  className="inline-flex items-center justify-center px-1.5 py-px rounded text-[10px] font-bold font-serif italic bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 cursor-default shrink-0"
                >
                  f
                </span>
              )}
            </span>
          )}
        </td>
      )}
      {visibleCols.has('computed') && (
        <td
          className={clsx(
            'px-3 py-2 font-mono text-[11px]',
            computedVal ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400',
          )}
        >
          {computedVal ?? (param.formula ? '…' : '—')}
        </td>
      )}
      {visibleCols.has('unit') && (
        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">{param.unit || '—'}</td>
      )}
      {visibleCols.has('folder') && (
        <td
          className="px-3 py-2 text-gray-600 dark:text-gray-400"
          onClick={(e) => e.stopPropagation()}
        >
          <select
            aria-label="Move parameter to folder"
            value={param.folderId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onMoveToFolder(param.id, v === '' ? null : v)
            }}
            className="text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 px-1.5 py-0.5 max-w-[140px]"
          >
            <option value="">— Ungrouped</option>
            {folderOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </td>
      )}
      {visibleCols.has('source') && (
        <td className="px-3 py-2 text-gray-600 dark:text-gray-400">
          {param.sourceFunction ? (
            <button
              type="button"
              onClick={() => onViewSource(param)}
              className="bg-transparent border-none cursor-pointer text-blue-600 dark:text-blue-400 text-xs p-0"
            >
              {param.sourceFunction.functionId || 'N/A'}: {param.sourceFunction.name}
            </button>
          ) : (
            '—'
          )}
        </td>
      )}
      {visibleCols.has('status') && (
        <td className="px-3 py-2">
          <span
            className={clsx(
              'px-[7px] py-0.5 rounded-[10px] text-[10px] font-semibold',
              (param.status ?? 'draft') === 'approved' &&
                'bg-green-500/10 text-green-700 dark:text-green-400',
              (param.status ?? 'draft') === 'obsolete' &&
                'bg-gray-200/30 dark:bg-gray-400/15 text-gray-600 dark:text-gray-400',
              (param.status ?? 'draft') === 'draft' &&
                'bg-amber-500/10 text-amber-700 dark:text-amber-400',
            )}
          >
            {param.status ?? 'draft'}
          </span>
        </td>
      )}
      {visibleCols.has('usedIn') && (
        <td className="px-3 py-2">
          {(param as ParameterWithUsage).requirementCount != null ? (
            <button
              type="button"
              onClick={() => onOpenDetail(param)}
              className="bg-transparent border-none cursor-pointer text-blue-600 dark:text-blue-400 font-semibold text-xs p-0"
            >
              {(param as ParameterWithUsage).requirementCount}
            </button>
          ) : (
            '—'
          )}
        </td>
      )}
      {visibleCols.has('created') && (
        <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">
          {format(new Date(param.createdAt), 'MMM dd, yyyy')}
        </td>
      )}
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onOpenChangeRequest(param)
            }}
            title="Change Request"
            className="bg-transparent border-none cursor-pointer p-[3px] rounded text-green-500 hover:bg-green-500/10 transition-colors"
          >
            <FileText size={14} />
          </button>
          <button
            onClick={(e) => onEditClick(e, param)}
            title="Edit"
            className="bg-transparent border-none cursor-pointer p-[3px] rounded text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950 transition-colors"
          >
            <Edit2 size={14} />
          </button>
          <button
            onClick={(e) => onDeleteClick(e, param.id, param.name)}
            disabled={deleteConfirmPending}
            title="Delete"
            className={clsx(
              'bg-transparent border-none cursor-pointer p-[3px] rounded text-red-500 hover:bg-red-500/10 transition-colors',
              deleteConfirmPending && 'opacity-40',
            )}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </td>
    </tr>
  )
}

/**
 * React.memo with default shallow compare. Every prop is either a
 * primitive, a stable callback (useCallback'd by the parent), or a
 * reference that only changes when the param's data actually changes
 * (`param` itself, `foldersById` Map, the `folderOptions` array).
 *
 * The `visibleCols` Set and `selected` boolean are the two props that
 * can flip per-row; shallow compare catches both.
 */
const ParameterRow = memo(ParameterRowImpl)
export default ParameterRow
