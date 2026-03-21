import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Edit2,
  Trash2,
  Copy,
  ClipboardCheck,
  ChevronDown,
  ChevronUp,
  Link2,
  X,
} from 'lucide-react'
import clsx from 'clsx'
import {
  transitionChecklistService,
  type TransitionChecklist,
  type ChecklistItemInput,
} from '../../services/transitionChecklist.service'
import { useLifecycleStore } from '../../store/lifecycleStore'
import { useStatusDefinitionsStore } from '../../store/statusDefinitionsStore'
import ChecklistBuilder from './ChecklistBuilder'

interface ChecklistManagementContentProps {
  searchQuery?: string
}

export default function ChecklistManagementContent({ searchQuery = '' }: ChecklistManagementContentProps) {
  const { projectId } = useParams<{ projectId: string }>()
  const queryClient = useQueryClient()
  const { lifecycles } = useLifecycleStore()
  const { statuses } = useStatusDefinitionsStore()

  const [showBuilder, setShowBuilder] = useState(false)
  const [editingChecklist, setEditingChecklist] = useState<TransitionChecklist | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const [assignLifecycleId, setAssignLifecycleId] = useState('')
  const [assignFromStatusId, setAssignFromStatusId] = useState('')
  const [assignToStatusId, setAssignToStatusId] = useState('')
  const [assignItemType, setAssignItemType] = useState('Requirement')

  const { data: checklistsResp, isLoading } = useQuery({
    queryKey: ['transition-checklists', projectId],
    queryFn: () => transitionChecklistService.list(projectId!),
    enabled: !!projectId,
  })

  const checklists = checklistsResp?.data ?? []
  const filtered = searchQuery.trim()
    ? checklists.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : checklists

  const createMutation = useMutation({
    mutationFn: (data: { name: string; description: string; items: ChecklistItemInput[] }) =>
      transitionChecklistService.create(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transition-checklists', projectId] })
      setShowBuilder(false)
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name: string; description: string; items: ChecklistItemInput[] } }) =>
      transitionChecklistService.update(projectId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transition-checklists', projectId] })
      setEditingChecklist(null)
      setShowBuilder(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => transitionChecklistService.remove(projectId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transition-checklists', projectId] })
      setDeleteConfirm(null)
    },
  })

  const cloneMutation = useMutation({
    mutationFn: async (checklist: TransitionChecklist) => {
      return transitionChecklistService.create(projectId!, {
        name: `${checklist.name} (Copy)`,
        description: checklist.description,
        items: checklist.items.map((i) => ({
          label: i.label,
          description: i.description,
          itemType: i.itemType,
          validationConfig: i.validationConfig as Record<string, unknown>,
          isRequired: i.isRequired,
          sortOrder: i.sortOrder,
        })),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transition-checklists', projectId] })
    },
  })

  const assignMutation = useMutation({
    mutationFn: (data: { checklistId: string; lifecycleId: string; fromStatusId: string; toStatusId: string; itemType: string }) =>
      transitionChecklistService.createAssignment(projectId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transition-checklists', projectId] })
      setShowAssignModal(null)
      setAssignLifecycleId('')
      setAssignFromStatusId('')
      setAssignToStatusId('')
    },
  })

  const removeAssignmentMutation = useMutation({
    mutationFn: (assignmentId: string) => transitionChecklistService.removeAssignment(projectId!, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transition-checklists', projectId] })
    },
  })

  const handleSave = (data: { name: string; description: string; items: ChecklistItemInput[] }) => {
    if (editingChecklist) {
      updateMutation.mutate({ id: editingChecklist.id, data })
    } else {
      createMutation.mutate(data)
    }
  }

  const getStatusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? id
  const getLifecycleName = (id: string) => lifecycles.find((l) => l.id === id)?.name ?? id

  const selectedLifecycle = lifecycles.find((l) => l.id === assignLifecycleId)
  const lifecycleStatusIds = selectedLifecycle?.steps?.map((s) => s.statusId) ?? []
  const lifecycleStatuses = statuses.filter((s) => lifecycleStatusIds.includes(s.id))

  const typeLabel = (t: string) => {
    switch (t) {
      case 'BOOLEAN': return 'Checkbox'
      case 'FIELD_VALIDATION': return 'Field Validation'
      case 'RULE_BASED': return 'Rule-Based'
      case 'CONFIRMATION': return 'Confirmation'
      default: return t
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Transition Checklists</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Create and manage validation checklists enforced during status transitions
          </p>
        </div>
        <button
          onClick={() => {
            setEditingChecklist(null)
            setShowBuilder(true)
          }}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Create Checklist</span>
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading checklists...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <ClipboardCheck size={48} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Checklists Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first transition checklist to enforce validation during status changes.
          </p>
          <button
            onClick={() => {
              setEditingChecklist(null)
              setShowBuilder(true)
            }}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg"
          >
            Create Checklist
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((checklist) => {
            const isExpanded = expandedId === checklist.id
            return (
              <div
                key={checklist.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 overflow-hidden"
              >
                {/* Card header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  onClick={() => setExpandedId(isExpanded ? null : checklist.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <ClipboardCheck size={20} className="text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">{checklist.name}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                          v{checklist.version}
                        </span>
                        {!checklist.isActive && (
                          <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded">
                            Inactive
                          </span>
                        )}
                      </div>
                      {checklist.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{checklist.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {checklist.items.length} items / {checklist.assignments.length} assignments
                    </span>
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 p-4 space-y-4">
                    {/* Items list */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Checklist Items</h4>
                      {checklist.items.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">No items defined</p>
                      ) : (
                        <div className="space-y-1">
                          {checklist.items.map((item, idx) => (
                            <div key={item.id} className="flex items-center gap-2 text-sm py-1 px-2 rounded bg-gray-50 dark:bg-gray-900/30">
                              <span className="text-gray-400 w-5 text-right">{idx + 1}.</span>
                              <span className="text-gray-900 dark:text-white flex-1">{item.label}</span>
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                {typeLabel(item.itemType)}
                              </span>
                              {item.isRequired && (
                                <span className="text-xs text-red-500">Required</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assignments */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned Transitions</h4>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowAssignModal(checklist.id)
                          }}
                          className="px-2 py-1 text-xs bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded flex items-center gap-1"
                        >
                          <Link2 size={12} />
                          Assign to Transition
                        </button>
                      </div>
                      {checklist.assignments.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">Not assigned to any transitions yet</p>
                      ) : (
                        <div className="space-y-1">
                          {checklist.assignments.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-gray-50 dark:bg-gray-900/30"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 dark:text-gray-400">{getLifecycleName(a.lifecycleId)}:</span>
                                <span className="text-gray-900 dark:text-white">
                                  {getStatusName(a.fromStatusId)} &rarr; {getStatusName(a.toStatusId)}
                                </span>
                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                  {a.itemType}
                                </span>
                              </div>
                              <button
                                onClick={() => removeAssignmentMutation.mutate(a.id)}
                                className="p-1 text-gray-400 hover:text-red-500"
                                title="Remove assignment"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          setEditingChecklist(checklist)
                          setShowBuilder(true)
                        }}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-1.5"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        onClick={() => cloneMutation.mutate(checklist)}
                        className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg flex items-center gap-1.5"
                      >
                        <Copy size={14} />
                        Clone
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(checklist.id)}
                        className="px-3 py-1.5 text-sm bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg flex items-center gap-1.5"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Builder Modal */}
      {showBuilder && (
        <ChecklistBuilder
          projectId={projectId!}
          checklist={editingChecklist}
          onSave={handleSave}
          onClose={() => {
            setShowBuilder(false)
            setEditingChecklist(null)
          }}
        />
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowAssignModal(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Assign to Transition</h3>
              <button onClick={() => setShowAssignModal(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Lifecycle</label>
                <select
                  value={assignLifecycleId}
                  onChange={(e) => {
                    setAssignLifecycleId(e.target.value)
                    setAssignFromStatusId('')
                    setAssignToStatusId('')
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select lifecycle...</option>
                  {lifecycles.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Status</label>
                  <select
                    value={assignFromStatusId}
                    onChange={(e) => setAssignFromStatusId(e.target.value)}
                    disabled={!assignLifecycleId}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Select status...</option>
                    {lifecycleStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Status</label>
                  <select
                    value={assignToStatusId}
                    onChange={(e) => setAssignToStatusId(e.target.value)}
                    disabled={!assignLifecycleId}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Select status...</option>
                    {lifecycleStatuses.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Item Type</label>
                <select
                  value={assignItemType}
                  onChange={(e) => setAssignItemType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {['Requirement', 'Function', 'Test', 'Issue', 'Parameter', 'Change Request', 'Task'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setShowAssignModal(null)}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (showAssignModal && assignLifecycleId && assignFromStatusId && assignToStatusId) {
                    assignMutation.mutate({
                      checklistId: showAssignModal,
                      lifecycleId: assignLifecycleId,
                      fromStatusId: assignFromStatusId,
                      toStatusId: assignToStatusId,
                      itemType: assignItemType,
                    })
                  }
                }}
                disabled={!assignLifecycleId || !assignFromStatusId || !assignToStatusId}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-800 dark:bg-gray-600 dark:hover:bg-gray-500 text-white rounded-lg disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setDeleteConfirm(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 size={24} className="text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Checklist</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    This will permanently delete the checklist and all its assignments.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteMutation.mutate(deleteConfirm)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
