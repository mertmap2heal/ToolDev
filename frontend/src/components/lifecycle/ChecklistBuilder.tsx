import React, { useState, useMemo, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  AlertTriangle,
  FileText,
  Shield,
} from 'lucide-react'
import clsx from 'clsx'
import type { ChecklistItemInput } from '../../services/transitionChecklist.service'
import type { TransitionChecklist } from '../../services/transitionChecklist.service'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import {
  APPLICABLE_ENTITY_ITEM_TYPES,
  lifecycleStatusesInOrder,
  toStatusOptionsForTransition,
} from './checklistTransitionSelects'

const ITEM_TYPES = [
  { value: 'BOOLEAN', label: 'Checkbox', description: 'Manual confirmation checkbox', icon: CheckCircle },
  { value: 'FIELD_VALIDATION', label: 'Field Validation', description: 'Validate a specific field value', icon: FileText },
  { value: 'RULE_BASED', label: 'Rule-Based', description: 'Automated rule check (e.g. uniqueness)', icon: Shield },
  { value: 'CONFIRMATION', label: 'Confirmation', description: 'Acknowledgment text the user must confirm', icon: AlertTriangle },
]

const VALIDATION_FIELDS = [
  'title', 'description', 'owner', 'requirementId', 'priority', 'status',
  'acceptanceCriteria', 'verificationMethod', 'source', 'category', 'rationale',
]

const VALIDATION_OPERATORS = [
  { value: 'NOT_EMPTY', label: 'Is not empty' },
  { value: 'MIN_LENGTH', label: 'Minimum length' },
  { value: 'MATCHES_REGEX', label: 'Matches pattern' },
  { value: 'IS_UNIQUE', label: 'Is unique' },
]

export interface ChecklistInitialAssignment {
  lifecycleId: string
  fromStatusId: string
  toStatusId: string
  itemType: string
}

interface ChecklistBuilderProps {
  projectId: string
  checklist?: TransitionChecklist | null
  serverError?: string | null
  isSubmitting?: boolean
  onSave: (data: {
    name: string
    description: string
    items: ChecklistItemInput[]
    initialAssignment?: ChecklistInitialAssignment
  }) => void
  onClose: () => void
}

export default function ChecklistBuilder({
  projectId: _projectId,
  checklist,
  serverError,
  isSubmitting = false,
  onSave,
  onClose,
}: ChecklistBuilderProps) {
  const isCreate = !checklist
  const { lifecycles } = useLifecycleStore()
  const { statuses } = useStatusDefinitionsStore()

  const [name, setName] = useState(checklist?.name ?? '')
  const [description, setDescription] = useState(checklist?.description ?? '')
  const [createLifecycleId, setCreateLifecycleId] = useState('')
  const [createFromStatusId, setCreateFromStatusId] = useState('')
  const [createToStatusId, setCreateToStatusId] = useState('')
  const [createApplicableItemType, setCreateApplicableItemType] = useState<string>('Requirement')
  const [items, setItems] = useState<ChecklistItemInput[]>(
    checklist?.items?.map((i) => ({
      id: i.id,
      label: i.label,
      description: i.description ?? '',
      itemType: i.itemType,
      validationConfig: (i.validationConfig as Record<string, unknown>) ?? {},
      isRequired: i.isRequired,
      sortOrder: i.sortOrder,
    })) ?? []
  )
  const [expandedItem, setExpandedItem] = useState<number | null>(null)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const selectedCreateLifecycle = useMemo(
    () => lifecycles.find((l) => l.id === createLifecycleId),
    [lifecycles, createLifecycleId]
  )
  const createLifecycleStatusesOrdered = useMemo(
    () => lifecycleStatusesInOrder(selectedCreateLifecycle, statuses),
    [selectedCreateLifecycle, statuses]
  )
  const createToStatusOptions = useMemo(
    () =>
      toStatusOptionsForTransition(
        selectedCreateLifecycle,
        createFromStatusId,
        createLifecycleStatusesOrdered
      ),
    [selectedCreateLifecycle, createFromStatusId, createLifecycleStatusesOrdered]
  )

  useEffect(() => {
    if (!isCreate) return
    if (createToStatusId && !createToStatusOptions.some((s) => s.id === createToStatusId)) {
      setCreateToStatusId('')
    }
  }, [isCreate, createToStatusId, createToStatusOptions])

  const assignmentComplete =
    !!createLifecycleId &&
    !!createFromStatusId &&
    !!createToStatusId &&
    createFromStatusId !== createToStatusId

  const addItem = () => {
    setItems([
      ...items,
      {
        label: '',
        description: '',
        itemType: 'BOOLEAN',
        validationConfig: {},
        isRequired: true,
        sortOrder: items.length,
      },
    ])
    setExpandedItem(items.length)
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
    if (expandedItem === idx) setExpandedItem(null)
  }

  const updateItem = (idx: number, updates: Partial<ChecklistItemInput>) => {
    setItems(items.map((item, i) => (i === idx ? { ...item, ...updates } : item)))
  }

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return
    const updated = [...items]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    setItems(updated.map((item, i) => ({ ...item, sortOrder: i })))
    setExpandedItem(to)
  }

  const handleSave = () => {
    if (!name.trim()) return
    if (isCreate) {
      if (!assignmentComplete) return
      onSave({
        name: name.trim(),
        description: description.trim(),
        items: items.map((item, i) => ({ ...item, sortOrder: i })),
        initialAssignment: {
          lifecycleId: createLifecycleId,
          fromStatusId: createFromStatusId,
          toStatusId: createToStatusId,
          itemType: createApplicableItemType,
        },
      })
      return
    }
    onSave({
      name: name.trim(),
      description: description.trim(),
      items: items.map((item, i) => ({ ...item, sortOrder: i })),
    })
  }

  const saveDisabled =
    isSubmitting ||
    !name.trim() ||
    (isCreate && !assignmentComplete) ||
    (isCreate && lifecycles.length === 0)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        data-testid="checklist-builder-modal"
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {checklist ? 'Edit Checklist' : 'Create Checklist'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(serverError || (isCreate && lifecycles.length === 0)) && (
            <div
              data-testid="checklist-builder-error"
              role="alert"
              className={clsx(
                'rounded-lg border px-3 py-2 text-sm',
                serverError
                  ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200'
                  : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200'
              )}
            >
              {serverError ??
                'Add at least one lifecycle in Lifecycle Library (Lifecycle Settings) before creating a transition checklist.'}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Draft to In Review Checklist"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe when and why this checklist is used"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {isCreate && (
            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                When this checklist applies
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                The checklist runs only for the selected item type when it uses this lifecycle and moves from the first
                status to the second. Different lifecycles can use different checklists for the same named transition.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lifecycle</label>
                <select
                  data-testid="checklist-create-lifecycle"
                  value={createLifecycleId}
                  onChange={(e) => {
                    setCreateLifecycleId(e.target.value)
                    setCreateFromStatusId('')
                    setCreateToStatusId('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select lifecycle...</option>
                  {lifecycles.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From status</label>
                  <select
                    data-testid="checklist-create-from-status"
                    value={createFromStatusId}
                    onChange={(e) => {
                      setCreateFromStatusId(e.target.value)
                      setCreateToStatusId('')
                    }}
                    disabled={!createLifecycleId}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Select status...</option>
                    {createLifecycleStatusesOrdered.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To status</label>
                  <select
                    data-testid="checklist-create-to-status"
                    value={createToStatusId}
                    onChange={(e) => setCreateToStatusId(e.target.value)}
                    disabled={!createLifecycleId}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Select status...</option>
                    {createToStatusOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Applicable item type
                </label>
                <select
                  data-testid="checklist-create-item-type"
                  value={createApplicableItemType}
                  onChange={(e) => setCreateApplicableItemType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {APPLICABLE_ENTITY_ITEM_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Checklist Items */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                Checklist Items ({items.length})
              </h4>
              <button
                onClick={addItem}
                className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg flex items-center gap-1.5"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                No checklist items yet. Click "Add Item" to start building.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => {
                  const typeInfo = ITEM_TYPES.find((t) => t.value === item.itemType) ?? ITEM_TYPES[0]
                  const TypeIcon = typeInfo.icon
                  const isExpanded = expandedItem === idx
                  return (
                    <div
                      key={idx}
                      className={clsx(
                        'border rounded-lg transition-colors',
                        isExpanded
                          ? 'border-blue-300 dark:border-blue-600 bg-blue-50/50 dark:bg-blue-900/10'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                      )}
                    >
                      {/* Item header row */}
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          className="text-gray-400 cursor-grab hover:text-gray-600 dark:hover:text-gray-300"
                          title="Drag to reorder"
                          onMouseDown={() => setDragIdx(idx)}
                        >
                          <GripVertical size={16} />
                        </button>
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <TypeIcon size={14} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-900 dark:text-white truncate">
                            {item.label || `Item ${idx + 1}`}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                            ({typeInfo.label})
                          </span>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => moveItem(idx, idx - 1)}
                            disabled={idx === 0}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => moveItem(idx, idx + 1)}
                            disabled={idx === items.length - 1}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-30"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={() => setExpandedItem(isExpanded ? null : idx)}
                            className="p-1 text-gray-400 hover:text-blue-500"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button
                            onClick={() => removeItem(idx)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && (
                        <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Label</label>
                              <input
                                type="text"
                                value={item.label}
                                onChange={(e) => updateItem(idx, { label: e.target.value })}
                                placeholder="e.g. Description is filled in"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Type</label>
                              <select
                                value={item.itemType ?? 'BOOLEAN'}
                                onChange={(e) => updateItem(idx, { itemType: e.target.value, validationConfig: {} })}
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                {ITEM_TYPES.map((t) => (
                                  <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description (optional)</label>
                            <input
                              type="text"
                              value={item.description ?? ''}
                              onChange={(e) => updateItem(idx, { description: e.target.value })}
                              placeholder="Additional guidance for the reviewer"
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                          </div>

                          {/* Type-specific config */}
                          {(item.itemType === 'FIELD_VALIDATION' || item.itemType === 'RULE_BASED') && (
                            <div className="p-3 bg-gray-50 dark:bg-gray-900/30 rounded border border-gray-200 dark:border-gray-700 space-y-2">
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Field</label>
                                  <select
                                    value={(item.validationConfig?.field as string) ?? ''}
                                    onChange={(e) =>
                                      updateItem(idx, {
                                        validationConfig: { ...item.validationConfig, field: e.target.value },
                                      })
                                    }
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  >
                                    <option value="">Select field...</option>
                                    {VALIDATION_FIELDS.map((f) => (
                                      <option key={f} value={f}>{f}</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Operator</label>
                                  <select
                                    value={(item.validationConfig?.operator as string) ?? ''}
                                    onChange={(e) =>
                                      updateItem(idx, {
                                        validationConfig: { ...item.validationConfig, operator: e.target.value },
                                      })
                                    }
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  >
                                    <option value="">Select operator...</option>
                                    {VALIDATION_OPERATORS.map((o) => (
                                      <option key={o.value} value={o.value}>{o.label}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              {((item.validationConfig?.operator as string) === 'MIN_LENGTH' ||
                                (item.validationConfig?.operator as string) === 'MATCHES_REGEX') && (
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                    {(item.validationConfig?.operator as string) === 'MIN_LENGTH' ? 'Minimum Length' : 'Regex Pattern'}
                                  </label>
                                  <input
                                    type="text"
                                    value={(item.validationConfig?.value as string) ?? ''}
                                    onChange={(e) =>
                                      updateItem(idx, {
                                        validationConfig: { ...item.validationConfig, value: e.target.value },
                                      })
                                    }
                                    placeholder={
                                      (item.validationConfig?.operator as string) === 'MIN_LENGTH' ? 'e.g. 10' : 'e.g. ^REQ-\\d+'
                                    }
                                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          {item.itemType === 'CONFIRMATION' && (
                            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/10 rounded border border-yellow-200 dark:border-yellow-700">
                              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                                Confirmation Text
                              </label>
                              <textarea
                                value={(item.validationConfig?.confirmationText as string) ?? ''}
                                onChange={(e) =>
                                  updateItem(idx, {
                                    validationConfig: { ...item.validationConfig, confirmationText: e.target.value },
                                  })
                                }
                                rows={2}
                                placeholder="Text that the user must acknowledge before proceeding"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                              />
                            </div>
                          )}

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={item.isRequired ?? true}
                              onChange={(e) => updateItem(idx, { isRequired: e.target.checked })}
                              className="rounded border-gray-300 dark:border-gray-600 text-blue-600"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Required</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
          >
            Cancel
          </button>
          <button
            data-testid="checklist-builder-save"
            onClick={handleSave}
            disabled={saveDisabled}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg disabled:opacity-50"
          >
            {checklist ? 'Save Changes' : 'Create Checklist'}
          </button>
        </div>
      </div>
    </div>
  )
}
