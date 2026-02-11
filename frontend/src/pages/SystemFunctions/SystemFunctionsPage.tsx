import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Plus, AlertCircle, Trash2, Edit2, Filter, ChevronUp, FileText } from 'lucide-react'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import CreateFunctionModal from '../../components/functions/CreateFunctionModal'
import DeleteFunctionModal from '../../components/functions/DeleteFunctionModal'
import RaiseIssueModal from '../../components/functions/RaiseIssueModal'
import ParameterTextRenderer from '../../components/functions/ParameterTextRenderer'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import type { SystemFunction } from 'shared/types/engineering.types'
import type { Issue } from 'shared/types/engineering.types'
import type { ChangeRequest } from 'shared/types/engineering.types'


interface ExpandedRow {
  functionId: string
  linkedRequirements: Array<{ id: string; description: string }>
  linkedTestCases: Array<{ id: string; description: string }>
  linkedMilestones: Array<{ id: string; description: string }>
  linkedIssues: Array<{ id: string; title: string; description: string }>
  linkedChangeRequests: Array<{ id: string; title: string; description: string }>
}

export default function SystemFunctionsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [functionData, setFunctionData] = useState<Map<string, ExpandedRow>>(new Map())
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isRaiseIssueModalOpen, setIsRaiseIssueModalOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; name: string; functionId: string } | null>(null)
  const [changeRequestModal, setChangeRequestModal] = useState<{ isOpen: boolean; sourceId: string; sourceName: string } | null>(null)
  const [selectedFunctions, setSelectedFunctions] = useState<Set<string>>(new Set())
  const [editingFunctions, setEditingFunctions] = useState<Map<string, Partial<SystemFunction>>>(new Map())
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [verificationMethodFilter, setVerificationMethodFilter] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: functions = [], isLoading } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await functionService.getFunctions(projectId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load functions')
    },
    enabled: !!projectId,
  })

  // Fetch issues for linked elements
  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch change requests for linked elements
  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Filter functions based on selected filters
  const filteredFunctions = functions.filter((func) => {
    // Status filter
    if (statusFilter !== 'all' && func.status !== statusFilter) {
      return false
    }

    // Owner filter
    if (ownerFilter !== 'all') {
      if (ownerFilter === 'unassigned' && func.owner) {
        return false
      }
      if (ownerFilter !== 'unassigned' && func.owner !== ownerFilter) {
        return false
      }
    }

    // Verification Method filter
    if (verificationMethodFilter !== 'all') {
      if (verificationMethodFilter === 'unassigned' && func.verificationMethod) {
        return false
      }
      if (verificationMethodFilter !== 'unassigned' && func.verificationMethod !== verificationMethodFilter) {
        return false
      }
    }

    return true
  })

  const deleteFunctionMutation = useMutation({
    mutationFn: (functionId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return functionService.deleteFunction(projectId, functionId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete function error:', error)
      alert(error?.error || 'Failed to delete function')
      setDeleteConfirmation(null)
    },
  })

  const updateFunctionMutation = useMutation({
    mutationFn: ({ functionId, data }: { functionId: string; data: Partial<SystemFunction> }) => {
      if (!projectId) throw new Error('Project ID required')
      return functionService.updateFunction(projectId, functionId, data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] }) // Invalidate parameters since description might have changed
    },
    onError: (error: any) => {
      console.error('Update function error:', error)
      alert(error?.error || 'Failed to update function')
    },
  })

  // Get linked elements for a function
  const getLinkedElements = (functionId: string): ExpandedRow => {
    // Find issues linked to this function
    const linkedIssues = issues
      .filter((issue) => issue.relatedFunctionIds?.includes(functionId))
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
        description: issue.description,
      }))

    // Find change requests linked to this function
    const linkedChangeRequests = changeRequests
      .filter((cr) => cr.sourceType === 'function' && cr.sourceId === functionId)
      .map((cr) => ({
        id: cr.id,
        title: cr.title,
        description: cr.description,
      }))

    // Mock data for requirements, test cases, and milestones (to be replaced with API calls)
    const mockData = functionId === '1' ? {
      linkedRequirements: [
        { id: 'REQ-01', description: 'Requirement Description' },
      ],
      linkedTestCases: [
        { id: 'TC-01', description: 'Test Case Description' },
      ],
      linkedMilestones: [
        { id: 'PM-01', description: 'Start and Due Date of the Function' },
      ],
    } : {
      linkedRequirements: [],
      linkedTestCases: [],
      linkedMilestones: [],
    }

    return {
      functionId,
      ...mockData,
      linkedIssues,
      linkedChangeRequests,
    }
  }

  const toggleRow = (functionId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(functionId)) {
        newSet.delete(functionId)
        // Exit edit mode when collapsing
        setEditingFunctions((prevEdit) => {
          const newMap = new Map(prevEdit)
          newMap.delete(functionId)
          return newMap
        })
      } else {
        newSet.add(functionId)
        // Load linked elements when expanding via arrow
        if (!functionData.has(functionId)) {
          setFunctionData((prev) => {
            const newMap = new Map(prev)
            newMap.set(functionId, getLinkedElements(functionId))
            return newMap
          })
        }
        // Exit edit mode when expanding via arrow (view mode only)
        setEditingFunctions((prevEdit) => {
          const newMap = new Map(prevEdit)
          newMap.delete(functionId)
          return newMap
        })
      }
      return newSet
    })
  }

  const formatFunctionId = (func: SystemFunction, index: number) => {
    // Use user-provided functionId if available, otherwise generate one
    if (func.functionId) {
      return func.functionId
    }
    // Fallback to auto-generated ID if not provided
    return `FUNC-${String(index + 1).padStart(2, '0')}`
  }

  const getStatusDisplay = (status?: string) => {
    if (!status) return '<Draft/Work in Progress/In Review/Done>'
    const statusMap: Record<string, string> = {
      'draft': 'Draft',
      'work-in-progress': 'Work in Progress',
      'in-review': 'In Review',
      'done': 'Done',
    }
    return statusMap[status] || status
  }

  const handleDeleteClick = (e: React.MouseEvent, func: SystemFunction, functionId: string) => {
    e.stopPropagation()
    setDeleteConfirmation({ id: func.id, name: func.name, functionId })
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      deleteFunctionMutation.mutate(deleteConfirmation.id)
    }
  }

  const handleCancelDelete = () => {
    setDeleteConfirmation(null)
  }

  const handleSelectFunction = (functionId: string, checked: boolean) => {
    setSelectedFunctions((prev) => {
      const newSet = new Set(prev)
      if (checked) {
        newSet.add(functionId)
      } else {
        newSet.delete(functionId)
      }
      return newSet
    })
  }

  const handleEditClick = (e: React.MouseEvent, func: SystemFunction) => {
    e.stopPropagation()
    // Initialize editing state with current function data
    setEditingFunctions((prev) => {
      const newMap = new Map(prev)
      newMap.set(func.id, {
        description: func.description || '',
        status: func.status || 'draft',
        owner: func.owner || '',
        verificationMethod: func.verificationMethod || '',
      })
      return newMap
    })
    // Expand the row if not already expanded
    if (!expandedRows.has(func.id)) {
      setExpandedRows((prev) => {
        const newSet = new Set(prev)
        newSet.add(func.id)
        return newSet
      })
    }
  }

  const handleFieldChange = (functionId: string, field: keyof SystemFunction, value: string) => {
    setEditingFunctions((prev) => {
      const newMap = new Map(prev)
      const current = newMap.get(functionId) || {}
      newMap.set(functionId, { ...current, [field]: value })
      return newMap
    })
  }

  const handleSaveFunction = (func: SystemFunction) => {
    const editedData = editingFunctions.get(func.id)
    if (!editedData) return

    const updateData: Partial<SystemFunction> = {
      description: editedData.description,
      status: editedData.status,
      owner: editedData.owner,
      verificationMethod: editedData.verificationMethod,
    }

    updateFunctionMutation.mutate({ functionId: func.id, data: updateData })
    // Clear editing state after save
    setEditingFunctions((prev) => {
      const newMap = new Map(prev)
      newMap.delete(func.id)
      return newMap
    })
  }

  const handleCancelEdit = (functionId: string) => {
    setEditingFunctions((prev) => {
      const newMap = new Map(prev)
      newMap.delete(functionId)
      return newMap
    })
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedFunctions(new Set(filteredFunctions.map((f) => f.id)))
    } else {
      setSelectedFunctions(new Set())
    }
  }

  const isAllSelected = filteredFunctions.length > 0 && filteredFunctions.every((f) => selectedFunctions.has(f.id))
  const isIndeterminate = filteredFunctions.some((f) => selectedFunctions.has(f.id)) && !isAllSelected

  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Functions</h2>
        <div className="flex items-center gap-3">
          {projectId && <SafetyLinkPanel variant="impact" count={2} />}
          {selectedFunctions.size > 0 && (
            <button
              onClick={() => setIsRaiseIssueModalOpen(true)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2 transition-colors"
            >
              <AlertCircle size={16} />
              <span>Raise Issue</span>
            </button>
          )}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus size={16} />
            <span>Create a new function</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          {isFiltersExpanded ? (
            <ChevronUp size={18} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown size={18} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
        {isFiltersExpanded && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="draft">Draft</option>
                  <option value="work-in-progress">Work in Progress</option>
                  <option value="in-review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              {/* Owner Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Owner
                </label>
                <select
                  value={ownerFilter}
                  onChange={(e) => setOwnerFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Owners</option>
                  <option value="unassigned">Unassigned</option>
                  {Array.from(new Set(functions.map((f) => f.owner).filter(Boolean))).map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>

              {/* Verification Method Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Verification Method
                </label>
                <select
                  value={verificationMethodFilter}
                  onChange={(e) => setVerificationMethodFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Methods</option>
                  <option value="unassigned">Unassigned</option>
                  {Array.from(new Set(functions.map((f) => f.verificationMethod).filter(Boolean))).map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left w-12">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate
                    }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                    onClick={(e) => e.stopPropagation()}
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12"></th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Function ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Function Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status of the Function
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Owner of the Function
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Verification Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading functions...
                  </td>
                </tr>
              ) : filteredFunctions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {functions.length === 0
                      ? 'No functions found. Create your first function to get started.'
                      : 'No functions match your filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredFunctions.map((func, index) => {
                  const isExpanded = expandedRows.has(func.id)
                  const functionId = formatFunctionId(func, index)
                  const linkedData = functionData.get(func.id)
                  const isEditing = editingFunctions.has(func.id)
                  const editedData = editingFunctions.get(func.id)
                  const displayData = isEditing && editedData ? { ...func, ...editedData } : func

                  const isSelected = selectedFunctions.has(func.id)

                  return (
                    <>
                      <tr
                        key={func.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer ${
                          isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                        onClick={() => toggleRow(func.id)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => handleSelectFunction(func.id, e.target.checked)}
                            className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {isExpanded ? (
                            <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                          ) : (
                            <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {functionId}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {func.name || '<Function n 01>'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 max-w-md">
                          {func.description ? (
                            projectId ? (
                              <div className={isExpanded ? "" : "max-h-12 overflow-hidden"} title={func.description}>
                                <ParameterTextRenderer text={func.description} projectId={projectId} />
                              </div>
                            ) : (
                              <p className={isExpanded ? "whitespace-pre-wrap break-words" : "truncate"} title={func.description}>
                                {isExpanded 
                                  ? func.description
                                  : (func.description.length > 100 
                                      ? `${func.description.substring(0, 100)}...` 
                                      : func.description)}
                              </p>
                            )
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {getStatusDisplay(func.status)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {func.owner || '—'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {func.verificationMethod || '—'}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setChangeRequestModal({
                                  isOpen: true,
                                  sourceId: func.id,
                                  sourceName: `${func.functionId || 'N/A'}: ${func.name}`,
                                })
                              }}
                              className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded text-green-600 dark:text-green-400"
                              title="Create Change Request"
                            >
                              <FileText size={16} />
                            </button>
                            <button
                              onClick={(e) => handleEditClick(e, func)}
                              className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400"
                              title="Edit function"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={(e) => handleDeleteClick(e, func, functionId)}
                              disabled={deleteFunctionMutation.isPending && deleteConfirmation?.id === func.id}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Delete function"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    {isExpanded && (
                      <tr key={`${func.id}-expanded`} className="bg-gray-50 dark:bg-gray-900/50">
                        <td colSpan={9} className="px-4 py-4">
                          <div className="space-y-4">
                            {/* Show editable fields only when in edit mode (pen clicked) */}
                            {isEditing ? (
                              <>
                                {/* Description */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Description
                                  </label>
                                  <textarea
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                    rows={3}
                                    value={displayData.description || ''}
                                    placeholder="<Description of the Function>"
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleFieldChange(func.id, 'description', e.target.value)}
                                  />
                                </div>

                                {/* Status */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Status of the Function
                                  </label>
                                  <select
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={displayData.status || 'draft'}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleFieldChange(func.id, 'status', e.target.value)}
                                  >
                                    <option value="draft">Draft</option>
                                    <option value="work-in-progress">Work in Progress</option>
                                    <option value="in-review">In Review</option>
                                    <option value="done">Done</option>
                                  </select>
                                </div>

                                {/* Owner */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Owner of the Function
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter owner name"
                                    value={displayData.owner || ''}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleFieldChange(func.id, 'owner', e.target.value)}
                                  />
                                </div>

                                {/* Verification Method */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Verification Method
                                  </label>
                                  <input
                                    type="text"
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter verification method"
                                    value={displayData.verificationMethod || ''}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleFieldChange(func.id, 'verificationMethod', e.target.value)}
                                  />
                                </div>

                                {/* Save/Cancel buttons */}
                                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleCancelEdit(func.id)
                                    }}
                                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                                    disabled={updateFunctionMutation.isPending}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSaveFunction(func)
                                    }}
                                    disabled={updateFunctionMutation.isPending}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    {updateFunctionMutation.isPending ? 'Saving...' : 'Save Changes'}
                                  </button>
                                </div>
                              </>
                            ) : (
                              /* Show linked elements only when arrow clicked (view mode) */
                              linkedData && (
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Linked Function Elements
                                  </label>
                                  <div className="space-y-2">
                                    {linkedData.linkedRequirements.length > 0 && (
                                      <>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                                          Requirements
                                        </div>
                                        {linkedData.linkedRequirements.map((req) => (
                                          <div
                                            key={req.id}
                                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                          >
                                            <span>•</span>
                                            <span>
                                              {req.id}: {req.description}
                                            </span>
                                            <button className="text-blue-600 dark:text-blue-400 hover:underline ml-2">
                                              → See Related/Linked Items
                                            </button>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    {linkedData.linkedTestCases.length > 0 && (
                                      <>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 mt-3">
                                          Test Cases
                                        </div>
                                        {linkedData.linkedTestCases.map((tc) => (
                                          <div
                                            key={tc.id}
                                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                          >
                                            <span>•</span>
                                            <span>
                                              {tc.id}: {tc.description}
                                            </span>
                                            <button className="text-blue-600 dark:text-blue-400 hover:underline ml-2">
                                              → See Related/Linked Items
                                            </button>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    {linkedData.linkedMilestones.length > 0 && (
                                      <>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 mt-3">
                                          Milestones
                                        </div>
                                        {linkedData.linkedMilestones.map((ms) => (
                                          <div
                                            key={ms.id}
                                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                          >
                                            <span>•</span>
                                            <span>{ms.id}: {ms.description}</span>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    {linkedData.linkedIssues.length > 0 && (
                                      <>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 mt-3">
                                          Issues
                                        </div>
                                        {linkedData.linkedIssues.map((issue) => (
                                          <div
                                            key={issue.id}
                                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                          >
                                            <span>•</span>
                                            <span>
                                              {issue.title}: {issue.description}
                                            </span>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (projectId) {
                                                  window.location.href = `/projects/${projectId}/issues`
                                                }
                                              }}
                                              className="text-blue-600 dark:text-blue-400 hover:underline ml-2"
                                            >
                                              → See Related/Linked Items
                                            </button>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    {linkedData.linkedChangeRequests.length > 0 && (
                                      <>
                                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1 mt-3">
                                          Change Requests
                                        </div>
                                        {linkedData.linkedChangeRequests.map((cr) => (
                                          <div
                                            key={cr.id}
                                            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                                          >
                                            <span>•</span>
                                            <span>
                                              {cr.title}: {cr.description}
                                            </span>
                                            <button 
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                if (projectId) {
                                                  window.location.href = `/projects/${projectId}/change-requests`
                                                }
                                              }}
                                              className="text-blue-600 dark:text-blue-400 hover:underline ml-2"
                                            >
                                              → See Related/Linked Items
                                            </button>
                                          </div>
                                        ))}
                                      </>
                                    )}
                                    {linkedData.linkedRequirements.length === 0 &&
                                      linkedData.linkedTestCases.length === 0 &&
                                      linkedData.linkedMilestones.length === 0 &&
                                      linkedData.linkedIssues.length === 0 &&
                                      linkedData.linkedChangeRequests.length === 0 && (
                                        <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                                          No linked elements found.
                                        </div>
                                      )}
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {projectId && (
        <>
          <CreateFunctionModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            projectId={projectId}
          />
          <RaiseIssueModal
            isOpen={isRaiseIssueModalOpen}
            onClose={() => setIsRaiseIssueModalOpen(false)}
            projectId={projectId}
            selectedFunctions={filteredFunctions.filter((f) => selectedFunctions.has(f.id))}
          />
          <DeleteFunctionModal
            isOpen={deleteConfirmation !== null}
            functionName={deleteConfirmation?.name || ''}
            functionId={deleteConfirmation?.functionId || ''}
            onConfirm={handleConfirmDelete}
            onCancel={handleCancelDelete}
            isDeleting={deleteFunctionMutation.isPending}
          />
          {changeRequestModal && projectId && (
            <CreateChangeRequestModal
              isOpen={changeRequestModal.isOpen}
              onClose={() => setChangeRequestModal(null)}
              projectId={projectId}
              sourceType="function"
              sourceId={changeRequestModal.sourceId}
              sourceName={changeRequestModal.sourceName}
            />
          )}
        </>
      )}
    </div>
  )
}
