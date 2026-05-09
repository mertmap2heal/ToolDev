import React, { memo, useState, useCallback } from 'react'
import { Folder, FileText, Edit2, Trash2, MoreHorizontal, Star } from 'lucide-react'
import clsx from 'clsx'
import { format } from 'date-fns'
import { useDraggable } from '@dnd-kit/core'
import type { Parameter, ParameterFolder } from 'shared/types/engineering.types'
import type { ParameterWithUsage } from '../../services/parameter.service'

// v2: type tag pill colour bucket
function typeTagBucket(t: string | null | undefined): 'float' | 'int' | 'bool' | 'str' | 'array' | '' {
  if (!t) return ''
  const lower = t.toLowerCase()
  if (lower.includes('float') || lower.includes('double') || lower.includes('real') || lower.includes('number')) return 'float'
  if (lower.includes('int') || lower.includes('uint')) return 'int'
  if (lower.includes('bool')) return 'bool'
  if (lower.includes('str') || lower.includes('text') || lower.includes('char')) return 'str'
  if (lower.includes('array') || lower.includes('list') || lower.includes('vec')) return 'array'
  return ''
}

// v2: status pill class
function statusClass(s: string | null | undefined): string {
  const v = (s ?? 'draft').toLowerCase()
  if (v === 'approved' || v === 'released') return 'released'
  if (v === 'review' || v === 'in_review' || v === 'in review') return 'review'
  if (v === 'obsolete' || v === 'deprecated') return 'deprecated'
  return 'draft'
}

function statusLabel(s: string | null | undefined): string {
  const v = (s ?? 'draft').toLowerCase()
  if (v === 'approved') return 'Approved'
  if (v === 'released') return 'Released'
  if (v === 'review' || v === 'in_review' || v === 'in review') return 'In review'
  if (v === 'obsolete') return 'Obsolete'
  if (v === 'deprecated') return 'Deprecated'
  return 'Draft'
}

// Local-only "starred" set, persisted to localStorage. The list is
// shared across all rows; toggling broadcasts a custom event so any
// row currently mounted reflects the change without re-rendering the
// full table.
const STAR_KEY = 'param-starred-v1'
function readStarred(): Set<string> {
  try {
    const raw = localStorage.getItem(STAR_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as string[])
  } catch {
    return new Set()
  }
}
function writeStarred(set: Set<string>) {
  try {
    localStorage.setItem(STAR_KEY, JSON.stringify([...set]))
    window.dispatchEvent(new CustomEvent('param-star-change'))
  } catch {
    /* ignore */
  }
}

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
  // Scenario overlay. When set, the value cell shows this instead of
  // param.defaultValue with a purple "scenario" badge — read-only.
  scenarioOverride?: string
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
    scenarioOverride,
  } = props

  const folder = param.folderId ? foldersById.get(param.folderId) : undefined
  const leafName = (n: string | undefined) => n?.split(/[\\/]/).pop()?.trim() || n
  const parentFolder = folder?.parentId ? foldersById.get(folder.parentId) : null
  const folderPath = folder
    ? parentFolder
      ? `${leafName(parentFolder.name)} / ${leafName(folder.name)}`
      : leafName(folder.name)
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

  const tagBucket = typeTagBucket(param.dataType)
  const stClass = statusClass(param.status)
  const stLabel = statusLabel(param.status)
  const requirementCount = (param as ParameterWithUsage).requirementCount

  const [starred, setStarred] = useState<boolean>(() => readStarred().has(param.id))
  const toggleStar = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const set = readStarred()
    if (set.has(param.id)) set.delete(param.id)
    else set.add(param.id)
    writeStarred(set)
    setStarred(set.has(param.id))
  }, [param.id])
  React.useEffect(() => {
    const handler = () => setStarred(readStarred().has(param.id))
    window.addEventListener('param-star-change', handler)
    return () => window.removeEventListener('param-star-change', handler)
  }, [param.id])

  return (
    <tr
      ref={rowRef}
      data-index={dataIndex}
      className={clsx(selected && 'is-selected', isDragging && 'opacity-40')}
      style={{
        borderLeft: folderColor ? `3px solid ${folderColor}` : undefined,
        cursor: 'grab',
        height: 36,
      }}
      {...attributes}
      {...listeners}
    >
      <td className="col-check" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          className="pv-check"
          checked={selected}
          onChange={() => onToggleSelection(param.id)}
        />
      </td>
      <td
        className="col-name"
        onClick={(e) => {
          e.stopPropagation()
          onOpenDetail(param)
        }}
        style={{ cursor: 'pointer' }}
      >
        <div className="cell-name">
          <button
            type="button"
            className={clsx('star', starred && 'is-on')}
            aria-label={starred ? 'Unstar parameter' : 'Star parameter'}
            title={starred ? 'Unstar' : 'Star'}
            onClick={toggleStar}
          >
            <Star size={13} fill={starred ? 'currentColor' : 'none'} />
          </button>
          <span className="nm" title={param.name}>
            <span style={{ color: 'var(--pv-blue-ink)' }}>{param.name}</span>
          </span>
          {showFolderBadge && folderPath && (
            <span
              className="id"
              title={folderPath}
              style={folder?.color ? { color: folder.color } : undefined}
            >
              <Folder size={10} />
              {folderPath}
            </span>
          )}
        </div>
      </td>
      {visibleCols.has('type') && (
        <td>
          {param.dataType ? <span className={clsx('type-tag', tagBucket)}>{param.dataType}</span> : <span style={{ color: 'var(--pv-fg-4)' }}>—</span>}
        </td>
      )}
      {visibleCols.has('value') && (
        <td
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
              style={{
                width: '100%', padding: '2px 6px', fontFamily: 'var(--pv-font-mono)', fontSize: 12,
                border: '1px solid var(--pv-blue)', borderRadius: 3, background: 'var(--pv-bg)',
                color: 'var(--pv-fg)', outline: 'none',
              }}
            />
          ) : (
            <div className={clsx('cell-value', param.formula && 'computed')}>
              {param.formula && (
                <span className="fx" title={`Computed: ${param.formula}`}>ƒ</span>
              )}
              {scenarioOverride !== undefined ? (
                <>
                  <span className="num" style={{ color: '#7c3aed', fontWeight: 600 }}>
                    {scenarioOverride || '—'}
                  </span>
                  <span
                    title={`Scenario overlay (was ${param.defaultValue || '—'})`}
                    style={{
                      flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      height: 16, padding: '0 5px', borderRadius: 3,
                      background: 'rgba(124,58,237,0.10)', color: '#7c3aed',
                      fontFamily: 'var(--pv-font-mono)', fontSize: 10, fontWeight: 700,
                      border: '1px solid rgba(124,58,237,0.3)',
                    }}
                  >
                    SCN
                  </span>
                </>
              ) : (
                <span className="num">{param.defaultValue || '—'}</span>
              )}
            </div>
          )}
        </td>
      )}
      {visibleCols.has('computed') && (
        <td>
          <div className="cell-value" style={{ color: computedVal ? 'var(--pv-blue-ink)' : 'var(--pv-fg-3)' }}>
            <span className="num">{computedVal ?? (param.formula ? '…' : '—')}</span>
          </div>
        </td>
      )}
      {visibleCols.has('unit') && (
        <td className="cell-unit">{param.unit || '—'}</td>
      )}
      {visibleCols.has('description') && (
        <td>
          <span className="cell-desc" title={param.description ?? ''}>
            {param.description || '—'}
          </span>
        </td>
      )}
      {visibleCols.has('folder') && (
        <td onClick={(e) => e.stopPropagation()}>
          <select
            aria-label="Move parameter to folder"
            value={param.folderId ?? ''}
            onChange={(e) => {
              const v = e.target.value
              onMoveToFolder(param.id, v === '' ? null : v)
            }}
            className="pv-pill compact"
            style={{ maxWidth: 140 }}
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
        <td className="cell-source">
          {param.sourceFunction ? (
            <a onClick={() => onViewSource(param)}>
              {param.sourceFunction.functionId || 'N/A'}: {param.sourceFunction.name}
            </a>
          ) : (
            <span className="none">manual entry</span>
          )}
        </td>
      )}
      {visibleCols.has('status') && (
        <td>
          <span className={clsx('pv-status', stClass)}>{stLabel}</span>
        </td>
      )}
      {visibleCols.has('usedIn') && (
        <td className="cell-used">
          {requirementCount != null ? (
            <>
              <span className="num">{requirementCount}</span> refs
              <span className="bar"><i style={{ width: `${Math.min(100, (requirementCount / 40) * 100)}%` }} /></span>
            </>
          ) : (
            <span style={{ color: 'var(--pv-fg-4)' }}>—</span>
          )}
        </td>
      )}
      {visibleCols.has('created') && (
        <td className="cell-updated">
          {format(new Date(param.createdAt), 'd MMM, HH:mm')}
        </td>
      )}
      <td className="col-actions">
        <span className="row-actions">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenChangeRequest(param)
            }}
            title="Change Request"
            className="pv-icon-btn"
            style={{ width: 22, height: 22 }}
          >
            <FileText size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => onEditClick(e, param)}
            title="Edit"
            className="pv-icon-btn"
            style={{ width: 22, height: 22 }}
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => onDeleteClick(e, param.id, param.name)}
            disabled={deleteConfirmPending}
            title="Delete"
            className={clsx('pv-icon-btn', 'danger', deleteConfirmPending && 'opacity-40')}
            style={{ width: 22, height: 22 }}
          >
            <Trash2 size={13} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onOpenDetail(param)
            }}
            title="More"
            className="pv-icon-btn"
            style={{ width: 22, height: 22 }}
          >
            <MoreHorizontal size={14} />
          </button>
        </span>
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
