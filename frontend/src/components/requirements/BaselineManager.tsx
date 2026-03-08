import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Archive, Trash2, Plus, ArrowLeftRight, Calendar, User, FileText, Search, CheckSquare, Square, ChevronRight, ChevronLeft, Eye, Download, Link2, AlertTriangle, Box, Workflow } from 'lucide-react'
import { baselineService } from '../../services/baseline.service'
import { requirementService } from '../../services/requirement.service'
import { verificationService } from '../../services/verification.service'
import { componentService } from '../../services/component.service'
import { functionService } from '../../services/function.service'
import BaselineViewModal from './BaselineViewModal'
import BaselineExportModal from './BaselineExportModal'
import BaselineComparisonModal from './BaselineComparisonModal'
import { LINKAGE_V1 } from '../../config/featureFlags'
import type { Baseline } from 'shared/types/engineering.types'
import type { ComponentTreeNode } from 'shared/types/project.types'
import { format } from 'date-fns'
import clsx from 'clsx'

function ComponentNodeRow({
  node,
  selectedIds,
  onToggle,
  depth,
}: {
  node: ComponentTreeNode
  selectedIds: Set<string>
  onToggle: (id: string) => void
  depth: number
}) {
  const children = node.children ?? []
  const isSelected = selectedIds.has(node.id)
  return (
    <>
      <label
        className={clsx(
          'flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors',
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
        )}
        style={{ marginLeft: depth * 12, marginRight: 8 }}
      >
        <button type="button" onClick={() => onToggle(node.id)} className="shrink-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
          {isSelected ? <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" /> : <Square size={18} />}
        </button>
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{node.name}</span>
      </label>
      {children.map((child) => (
        <ComponentNodeRow key={child.id} node={child} selectedIds={selectedIds} onToggle={onToggle} depth={depth + 1} />
      ))}
    </>
  )
}

interface BaselineManagerProps {
  projectId: string
  onClose: () => void
  /** When set (e.g. from URL openBaselines=1&baselineId=), open the view modal for this baseline on mount */
  initialBaselineId?: string
  /** Called when user clicks "View in Requirements Page" to navigate to requirements with baselineId in URL */
  onViewInRequirementsPage?: (baselineId: string) => void
}

/**
 * BaselineManager component provides functionality to create, manage, and
 * compare requirement baselines. Baselines freeze the state of all
 * requirements at a point in time for audits and milestone tracking.
 */
type CreateBaselineStep = 'details' | 'scope' | 'select-requirements'

export default function BaselineManager({ projectId, onClose, onViewInRequirementsPage, initialBaselineId }: BaselineManagerProps) {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [createStep, setCreateStep] = useState<CreateBaselineStep>('details')
  const [newBaselineName, setNewBaselineName] = useState('')
  const [newBaselineDescription, setNewBaselineDescription] = useState('')
  const [newBaselineType, setNewBaselineType] = useState('')
  const [newReviewType, setNewReviewType] = useState('')
  const [newSupersedesBaselineId, setNewSupersedesBaselineId] = useState('')
  const [newConfigurationAuthority, setNewConfigurationAuthority] = useState<'government' | 'contractor' | ''>('')
  const [newFdAL, setNewFdAL] = useState('')
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<Set<string>>(new Set())
  const [selectedComponentIds, setSelectedComponentIds] = useState<Set<string>>(new Set())
  const [selectedFunctionIds, setSelectedFunctionIds] = useState<Set<string>>(new Set())
  const [requirementSearchQuery, setRequirementSearchQuery] = useState('')
  const [selectedBaselines, setSelectedBaselines] = useState<string[]>([])
  const [viewingBaselineId, setViewingBaselineId] = useState<string | null>(null)
  const [exportingBaselineId, setExportingBaselineId] = useState<string | null>(null)
  const [comparingBaselines, setComparingBaselines] = useState<{ baselineAId: string; baselineBId: string } | null>(null)
  const [showViewInArchiveLink, setShowViewInArchiveLink] = useState(false)

  const queryClient = useQueryClient()

  // When opened with initialBaselineId (e.g. from Version History "View baseline"), open that baseline's view modal
  useEffect(() => {
    if (initialBaselineId) {
      setViewingBaselineId(initialBaselineId)
    }
  }, [initialBaselineId])

  // Fetch baselines
  const { data: baselines = [], isLoading } = useQuery({
    queryKey: ['baselines', projectId],
    queryFn: async () => {
      const response = await baselineService.getBaselines(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch requirements for selection
  const { data: requirements = [], isLoading: loadingRequirements } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && isCreateModalOpen,
  })

  // Fetch component tree and functions for scope step
  const { data: componentTree = [], isLoading: loadingComponents } = useQuery({
    queryKey: ['component-tree', projectId],
    queryFn: async () => {
      const response = await componentService.getComponentTree(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && isCreateModalOpen,
  })
  const { data: functions = [], isLoading: loadingFunctions } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && isCreateModalOpen,
  })

  // Fetch custom baseline types and review types from settings
  const { data: baselineTypesRes } = useQuery({
    queryKey: ['custom-options', projectId, 'BASELINE_TYPE'],
    queryFn: () => verificationService.getCustomOptions(projectId, 'BASELINE_TYPE'),
    enabled: !!projectId,
  })
  const { data: reviewTypesRes } = useQuery({
    queryKey: ['custom-options', projectId, 'BASELINE_REVIEW_TYPE'],
    queryFn: () => verificationService.getCustomOptions(projectId, 'BASELINE_REVIEW_TYPE'),
    enabled: !!projectId,
  })
  // Fallback defaults when custom options API fails or returns empty (e.g. 500 errors)
  const DEFAULT_BASELINE_TYPES = [
    { value: 'functional', label: 'Functional (SRR)' },
    { value: 'allocated', label: 'Allocated (PDR)' },
    { value: 'product', label: 'Product (CDR)' },
    { value: 'milestone', label: 'Milestone' },
    { value: 'custom', label: 'Custom' },
  ]
  const DEFAULT_REVIEW_TYPES = [
    { value: 'SRR', label: 'SRR - System Requirements Review' },
    { value: 'PDR', label: 'PDR - Preliminary Design Review' },
    { value: 'CDR', label: 'CDR - Critical Design Review' },
  ]
  const baselineTypeOptions =
    baselineTypesRes?.success && Array.isArray(baselineTypesRes.data) && baselineTypesRes.data.length > 0
      ? (baselineTypesRes.data as { value: string }[]).map((o) => ({
          value: o.value,
          label: o.value.charAt(0).toUpperCase() + o.value.slice(1),
        }))
      : DEFAULT_BASELINE_TYPES
  const reviewTypeOptions =
    reviewTypesRes?.success && Array.isArray(reviewTypesRes.data) && reviewTypesRes.data.length > 0
      ? (reviewTypesRes.data as { value: string }[]).map((o) => ({ value: o.value, label: o.value }))
      : DEFAULT_REVIEW_TYPES

  // Filter requirements based on search
  const filteredRequirements = useMemo(() => {
    if (!requirementSearchQuery.trim()) return requirements
    const query = requirementSearchQuery.toLowerCase()
    return requirements.filter((req) => {
      return (
        req.title.toLowerCase().includes(query) ||
        req.requirementId?.toLowerCase().includes(query) ||
        req.description.toLowerCase().includes(query) ||
        req.category?.toLowerCase().includes(query)
      )
    })
  }, [requirements, requirementSearchQuery])

  // Create baseline mutation
  const createMutation = useMutation({
    mutationFn: () => baselineService.createBaseline(projectId, {
      name: newBaselineName,
      description: newBaselineDescription || undefined,
      requirementIds: selectedRequirementIds.size > 0 ? Array.from(selectedRequirementIds) : undefined,
      componentIds: selectedComponentIds.size > 0 ? Array.from(selectedComponentIds) : undefined,
      functionIds: selectedFunctionIds.size > 0 ? Array.from(selectedFunctionIds) : undefined,
      baselineType: newBaselineType || undefined,
      reviewType: newReviewType || undefined,
      supersedesBaselineId: newSupersedesBaselineId || undefined,
      configurationAuthority: newConfigurationAuthority || undefined,
      fdAL: newFdAL || undefined,
    }),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['baselines', projectId] })
        setShowViewInArchiveLink(true)
        setIsCreateModalOpen(false)
        setCreateStep('details')
        setNewBaselineName('')
        setNewBaselineDescription('')
        setNewBaselineType('')
        setNewReviewType('')
        setNewSupersedesBaselineId('')
        setNewConfigurationAuthority('')
        setNewFdAL('')
        setSelectedRequirementIds(new Set())
        setSelectedComponentIds(new Set())
        setSelectedFunctionIds(new Set())
        setRequirementSearchQuery('')
      } else {
        alert(response.error || 'Failed to create baseline')
      }
    },
    onError: (error: any) => {
      console.error('Create baseline error:', error)
      let errorMessage = 'Failed to create baseline'
      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }
      
      // Show more helpful error messages
      if (errorMessage.includes('Database schema') || 
          errorMessage.includes('Unknown model') || 
          errorMessage.includes('does not exist') ||
          errorMessage.includes('Cannot read properties') ||
          errorMessage.includes('npx prisma')) {
        alert(`Database Error: ${errorMessage}\n\nPlease run: cd backend && npx prisma generate && npx prisma db push`)
      } else {
        alert(`Error: ${errorMessage}`)
      }
    },
  })

  // Delete baseline mutation
  const deleteMutation = useMutation({
    mutationFn: (baselineId: string) => baselineService.deleteBaseline(projectId, baselineId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['baselines', projectId] })
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to delete baseline')
    },
  })

  // Toggle baseline selection for comparison
  const toggleSelection = (baselineId: string) => {
    setSelectedBaselines((prev) => {
      if (prev.includes(baselineId)) {
        return prev.filter((id) => id !== baselineId)
      }
      if (prev.length >= 2) {
        return [prev[1], baselineId]
      }
      return [...prev, baselineId]
    })
  }

  // Toggle requirement selection
  const toggleRequirement = (requirementId: string) => {
    setSelectedRequirementIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(requirementId)) {
        newSet.delete(requirementId)
      } else {
        newSet.add(requirementId)
      }
      return newSet
    })
  }

  // Select all filtered requirements
  const selectAllFiltered = () => {
    setSelectedRequirementIds(new Set(filteredRequirements.map((r) => r.id)))
  }

  // Deselect all
  const deselectAll = () => {
    setSelectedRequirementIds(new Set())
  }

  // Handle next step in create flow
  const handleNextStep = () => {
    if (createStep === 'details') {
      if (!newBaselineName.trim()) {
        alert('Please enter a baseline name')
        return
      }
      setCreateStep('scope')
    } else if (createStep === 'scope') {
      setCreateStep('select-requirements')
    }
  }

  const toggleComponent = (componentId: string) => {
    setSelectedComponentIds((prev) => {
      const next = new Set(prev)
      if (next.has(componentId)) next.delete(componentId)
      else next.add(componentId)
      return next
    })
  }

  const toggleFunction = (functionId: string) => {
    setSelectedFunctionIds((prev) => {
      const next = new Set(prev)
      if (next.has(functionId)) next.delete(functionId)
      else next.add(functionId)
      return next
    })
  }

  // Handle create baseline
  const handleCreate = () => {
    // If no requirements selected, backend will include all requirements
    // This is the expected behavior - user can leave empty to baseline everything
    createMutation.mutate()
  }

  // Handle cancel/create modal close
  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false)
    setCreateStep('details')
    setNewBaselineName('')
    setNewBaselineDescription('')
    setNewBaselineType('')
    setNewReviewType('')
    setNewSupersedesBaselineId('')
    setNewConfigurationAuthority('')
    setNewFdAL('')
    setSelectedRequirementIds(new Set())
    setSelectedComponentIds(new Set())
    setSelectedFunctionIds(new Set())
    setRequirementSearchQuery('')
  }

  // Handle delete baseline
  const handleDelete = (baseline: Baseline) => {
    if (baseline.status === 'locked') {
      alert('Cannot delete a locked baseline')
      return
    }
    if (window.confirm(`Delete baseline "${baseline.name}"?`)) {
      deleteMutation.mutate(baseline.id)
    }
  }

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'locked':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'archived':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Archive className="text-blue-500" size={24} />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Baseline Manager
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {baselines.length} baseline{baselines.length !== 1 ? 's' : ''} created
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1"
            >
              <Plus size={14} />
              Create Baseline
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {showViewInArchiveLink && (
          <div className="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 flex items-center justify-between gap-2">
            <span className="text-sm text-green-800 dark:text-green-300">Baseline created.</span>
            <Link
              to={`/projects/${projectId}/archive#baselines`}
              className="text-sm font-medium text-green-700 dark:text-green-400 hover:underline"
            >
              View in Archive
            </Link>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Loading baselines...
            </div>
          ) : baselines.length === 0 ? (
            <div className="text-center py-8">
              <Archive size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
              <p className="text-lg font-medium text-gray-900 dark:text-white">
                No baselines created
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Create a baseline to snapshot all current requirements for future reference.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                Click "Create Baseline" in the header above to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {baselines.map((baseline) => (
                <div
                  key={baseline.id}
                  className={clsx(
                    'flex items-center gap-4 p-4 border rounded-lg transition-colors',
                    selectedBaselines.includes(baseline.id)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  )}
                >
                  {/* Selection Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedBaselines.includes(baseline.id)}
                    onChange={() => toggleSelection(baseline.id)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                  />

                  {/* Baseline Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-medium text-gray-900 dark:text-white truncate">
                        {baseline.name}
                      </h3>
                      <span className={clsx('px-2 py-0.5 text-xs font-medium rounded-full', getStatusColor(baseline.status))}>
                        {baseline.status}
                      </span>
                      {baseline.baselineType && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {baseline.baselineType}
                        </span>
                      )}
                      {baseline.reviewType && (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                          {baseline.reviewType}
                        </span>
                      )}
                    </div>
                    {baseline.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate mb-1">
                        {baseline.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <FileText size={12} />
                        {baseline.itemCount || 0} requirements
                      </span>
                      {LINKAGE_V1 && (baseline.linksCount != null || baseline.suspectLinksCount != null) && (
                        <>
                          <span className="flex items-center gap-1">
                            <Link2 size={12} />
                            {baseline.linksCount ?? 0} links
                          </span>
                          {(baseline.suspectLinksCount ?? 0) > 0 && (
                            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <AlertTriangle size={12} />
                              {baseline.suspectLinksCount} suspect
                            </span>
                          )}
                        </>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {format(new Date(baseline.createdAt), 'PP')}
                      </span>
                      {baseline.createdByName && (
                        <span className="flex items-center gap-1">
                          <User size={12} />
                          {baseline.createdByName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setViewingBaselineId(baseline.id)}
                      className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                      title="View baseline"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => setExportingBaselineId(baseline.id)}
                      className="p-2 text-purple-600 hover:text-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded"
                      title="Export baseline"
                    >
                      <Download size={16} />
                    </button>
                    {baseline.status !== 'locked' && (
                      <button
                        onClick={() => handleDelete(baseline)}
                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                        title="Delete baseline"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer with Compare */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {selectedBaselines.length === 2 ? (
              <span className="text-blue-600 dark:text-blue-400">
                Select "Compare" to see differences between baselines
              </span>
            ) : selectedBaselines.length === 1 ? (
              'Select one more baseline to compare'
            ) : (
              'Select two baselines to compare them'
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedBaselines.length === 2 && (
              <button
                onClick={() => setComparingBaselines({ baselineAId: selectedBaselines[0], baselineBId: selectedBaselines[1] })}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
              >
                <ArrowLeftRight size={16} />
                Compare
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>

        {/* Create Modal - Multi-step wizard */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[600px] max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Create New Baseline
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Step {createStep === 'details' ? 1 : createStep === 'scope' ? 2 : 3} of 3
                  </p>
                </div>
                <button
                  onClick={handleCloseCreateModal}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <X size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6">
                {createStep === 'details' ? (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Baseline Name *
                      </label>
                      <input
                        type="text"
                        value={newBaselineName}
                        onChange={(e) => setNewBaselineName(e.target.value)}
                        placeholder="e.g., Release 1.0, Sprint 5 End"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Description (optional)
                      </label>
                      <textarea
                        value={newBaselineDescription}
                        onChange={(e) => setNewBaselineDescription(e.target.value)}
                        placeholder="Purpose of this baseline..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Baseline Type (optional)
                      </label>
                      <select
                        value={newBaselineType}
                        onChange={(e) => setNewBaselineType(e.target.value || '')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">— Select type —</option>
                        {baselineTypeOptions.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Review / Milestone (optional)
                      </label>
                      <select
                        value={newReviewType}
                        onChange={(e) => setNewReviewType(e.target.value || '')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">— Select review —</option>
                        {reviewTypeOptions.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Supersedes Baseline (optional)
                      </label>
                      <select
                        value={newSupersedesBaselineId}
                        onChange={(e) => setNewSupersedesBaselineId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">— None —</option>
                        {baselines.filter((b) => b.status === 'locked' || b.status === 'archived').map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Configuration Authority (optional)
                      </label>
                      <select
                        value={newConfigurationAuthority}
                        onChange={(e) => setNewConfigurationAuthority((e.target.value || '') as 'government' | 'contractor' | '')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">— None —</option>
                        <option value="government">Government</option>
                        <option value="contractor">Contractor</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        FDAL / DAL (optional)
                      </label>
                      <input
                        type="text"
                        value={newFdAL}
                        onChange={(e) => setNewFdAL(e.target.value)}
                        placeholder="e.g. A, B, C, D, E"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm text-blue-700 dark:text-blue-300">
                      Next you can scope by PBS components and/or functions, then choose which requirements to include.
                    </div>
                  </div>
                ) : createStep === 'scope' ? (
                  <div className="space-y-5">
                    <div className="rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        Optionally select PBS components and/or system functions. Requirements under selected components (and their children) or linked to selected functions will be included. You can also skip and choose requirements in the next step.
                      </p>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Box size={18} className="text-blue-500 dark:text-blue-400" />
                          PBS Components
                        </h4>
                        {selectedComponentIds.size > 0 && (
                          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                            {selectedComponentIds.size} selected
                          </span>
                        )}
                      </div>
                      <div className="max-h-44 overflow-y-auto p-2">
                        {loadingComponents ? (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <Box size={32} className="mb-2 opacity-50" />
                            <span className="text-sm">Loading components…</span>
                          </div>
                        ) : componentTree.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <Box size={32} className="mb-2 opacity-50" />
                            <span className="text-sm">No components found</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {componentTree.map((node: ComponentTreeNode) => (
                              <ComponentNodeRow
                                key={node.id}
                                node={node}
                                selectedIds={selectedComponentIds}
                                onToggle={toggleComponent}
                                depth={0}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <Workflow size={18} className="text-indigo-500 dark:text-indigo-400" />
                          System Functions
                        </h4>
                        {selectedFunctionIds.size > 0 && (
                          <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                            {selectedFunctionIds.size} selected
                          </span>
                        )}
                      </div>
                      <p className="px-4 pt-2 pb-1 text-xs text-gray-500 dark:text-gray-400">
                        Requirements linked to selected functions will be included.
                      </p>
                      <div className="max-h-44 overflow-y-auto p-2">
                        {loadingFunctions ? (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <Workflow size={32} className="mb-2 opacity-50" />
                            <span className="text-sm">Loading functions…</span>
                          </div>
                        ) : functions.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-8 text-gray-500 dark:text-gray-400">
                            <Workflow size={32} className="mb-2 opacity-50" />
                            <span className="text-sm">No functions found</span>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {functions.map((fn: { id: string; name: string; functionId?: string }) => {
                              const isSelected = selectedFunctionIds.has(fn.id)
                              return (
                                <label
                                  key={fn.id}
                                  className={clsx(
                                    'flex items-center gap-3 py-2 px-3 rounded-md cursor-pointer transition-colors',
                                    isSelected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleFunction(fn.id)}
                                    className="shrink-0 text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                  >
                                    {isSelected ? (
                                      <CheckSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    ) : (
                                      <Square size={18} />
                                    )}
                                  </button>
                                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400 shrink-0 w-20 truncate">{fn.functionId || fn.id.slice(0, 8)}</span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{fn.name}</span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(selectedComponentIds.size > 0 || selectedFunctionIds.size > 0) && (
                      <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-3">
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Scoped by <strong>{selectedComponentIds.size}</strong> component(s) and <strong>{selectedFunctionIds.size}</strong> function(s). Select requirements below to narrow, or leave all selected to include every requirement from the scope.
                        </p>
                      </div>
                    )}
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          <FileText size={18} className="text-gray-500 dark:text-gray-400" />
                          Select Requirements to Include
                        </h4>
                        <div className="flex items-center gap-2">
                          {selectedRequirementIds.size > 0 ? (
                            <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              {selectedRequirementIds.size} of {requirements.length} selected
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              All {requirements.length} will be included
                            </span>
                          )}
                          <span className="text-gray-300 dark:text-gray-600">·</span>
                          <button
                            type="button"
                            onClick={selectAllFiltered}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={deselectAll}
                            className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                          >
                            Deselect all
                          </button>
                        </div>
                      </div>
                      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                          <input
                            type="text"
                            value={requirementSearchQuery}
                            onChange={(e) => setRequirementSearchQuery(e.target.value)}
                            placeholder="Search by title, ID, or description…"
                            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-blue-400"
                          />
                        </div>
                      </div>
                      <div className="max-h-80 overflow-y-auto p-2">
                        {loadingRequirements ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                            <FileText size={36} className="mb-3 opacity-50" />
                            <span className="text-sm">Loading requirements…</span>
                          </div>
                        ) : filteredRequirements.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
                            <Search size={36} className="mb-3 opacity-50" />
                            <span className="text-sm">{requirementSearchQuery ? 'No requirements match your search' : 'No requirements found'}</span>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredRequirements.map((req) => {
                              const isSelected = selectedRequirementIds.has(req.id)
                              return (
                                <label
                                  key={req.id}
                                  className={clsx(
                                    'flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-colors',
                                    isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                  )}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleRequirement(req.id)}
                                    className="mt-0.5 shrink-0 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                  >
                                    {isSelected ? (
                                      <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                                    ) : (
                                      <Square size={18} />
                                    )}
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                                        {req.requirementId || req.id.substring(0, 8)}
                                      </span>
                                      <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-1">
                                        {req.title}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                      {req.description.replace(/<[^>]*>/g, '').substring(0, 120)}
                                      {req.description.length > 120 ? '…' : ''}
                                    </p>
                                  </div>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={handleCloseCreateModal}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  {(createStep === 'scope' || createStep === 'select-requirements') && (
                    <button
                      onClick={() => setCreateStep(createStep === 'scope' ? 'details' : 'scope')}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center gap-2"
                    >
                      <ChevronLeft size={16} />
                      Back
                    </button>
                  )}
                  {createStep === 'details' ? (
                    <button
                      onClick={handleNextStep}
                      disabled={!newBaselineName.trim()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2"
                    >
                      Next: Scope
                      <ChevronRight size={16} />
                    </button>
                  ) : createStep === 'scope' ? (
                    <button
                      onClick={handleNextStep}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                    >
                      Next: Select Requirements
                      <ChevronRight size={16} />
                    </button>
                  ) : (
                    <button
                      onClick={handleCreate}
                      disabled={createMutation.isPending}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg"
                    >
                      {createMutation.isPending ? 'Creating...' : 'Create Baseline'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Baseline Modal */}
      {viewingBaselineId && (
        <BaselineViewModal
          projectId={projectId}
          baselineId={viewingBaselineId}
          onClose={() => setViewingBaselineId(null)}
          onViewInRequirementsPage={onViewInRequirementsPage}
        />
      )}

      {/* Export Baseline Modal */}
      {exportingBaselineId && (
        <BaselineExportModal
          projectId={projectId}
          baselineId={exportingBaselineId}
          onClose={() => setExportingBaselineId(null)}
        />
      )}

      {/* Comparison Modal */}
      {comparingBaselines && (
        <BaselineComparisonModal
          projectId={projectId}
          baselineAId={comparingBaselines.baselineAId}
          baselineBId={comparingBaselines.baselineBId}
          onClose={() => setComparingBaselines(null)}
        />
      )}
    </div>
  )
}
