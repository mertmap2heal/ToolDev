import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { Search, X, Filter, ChevronDown, ChevronUp, Plus, Edit2, Trash2, ChevronRight, ChevronLeft, FileText, Settings, AlertCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import CreateRequirementModal from '../../components/requirements/CreateRequirementModal'
import EditRequirementModal from '../../components/requirements/EditRequirementModal'
import DeleteRequirementModal from '../../components/requirements/DeleteRequirementModal'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { changeRequestService } from '../../services/changeRequest.service'
import type { Requirement } from '../../../shared/types/engineering.types'
import clsx from 'clsx'
import { format } from 'date-fns'

interface ExpandedRow {
  requirementId: string
  children: Requirement[]
  linkedFunctions: Array<{ id: string; functionId?: string; name: string }>
  linkedIssues: Array<{ id: string; title: string }>
  linkedChangeRequests: Array<{ id: string; title: string }>
}

export default function RequirementsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [editingRequirement, setEditingRequirement] = useState<Requirement | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState<Requirement | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [requirementData, setRequirementData] = useState<Map<string, ExpandedRow>>(new Map())
  const [parentRequirement, setParentRequirement] = useState<Requirement | null>(null)
  
  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [ownerFilter, setOwnerFilter] = useState<string>('all')
  const [sourceFilter, setSourceFilter] = useState<string>('all')

  const queryClient = useQueryClient()

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await requirementService.getRequirements(projectId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load requirements')
    },
    enabled: !!projectId,
  })

  // Fetch functions for linking
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch issues for linking
  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Fetch change requests for linking
  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await changeRequestService.getChangeRequests(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const deleteRequirementMutation = useMutation({
    mutationFn: (requirementId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.deleteRequirement(projectId, requirementId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete requirement error:', error)
      alert(error?.error || 'Failed to delete requirement')
      setDeleteConfirmation(null)
    },
  })

  // Build hierarchy tree
  const buildHierarchy = (reqs: Requirement[]): Requirement[] => {
    const reqMap = new Map<string, Requirement>()
    const rootReqs: Requirement[] = []

    // First pass: create map
    reqs.forEach((req) => {
      reqMap.set(req.id, { ...req, children: [] })
    })

    // Second pass: build tree
    reqs.forEach((req) => {
      const reqWithChildren = reqMap.get(req.id)!
      if (req.parentId && reqMap.has(req.parentId)) {
        const parent = reqMap.get(req.parentId)!
        if (!parent.children) parent.children = []
        parent.children.push(reqWithChildren)
      } else {
        rootReqs.push(reqWithChildren)
      }
    })

    return rootReqs
  }

  // Get linked elements for a requirement
  const getLinkedElements = (requirementId: string): ExpandedRow => {
    // Find functions linked to this requirement
    const linkedFunctions = functions
      .filter((func) => func.sourceReqId === requirementId)
      .map((func) => ({
        id: func.id,
        functionId: func.functionId,
        name: func.name,
      }))

    // Find issues linked to this requirement (via traceability or direct link)
    const linkedIssues = issues
      .filter((issue) => {
        // This would need to be enhanced with actual traceability links
        return issue.title.toLowerCase().includes(requirementId.toLowerCase()) ||
               issue.description.toLowerCase().includes(requirementId.toLowerCase())
      })
      .map((issue) => ({
        id: issue.id,
        title: issue.title,
      }))

    // Find change requests linked to this requirement
    const linkedChangeRequests = changeRequests
      .filter((cr) => {
        // This would need to be enhanced with actual traceability links
        return cr.title.toLowerCase().includes(requirementId.toLowerCase()) ||
               cr.description.toLowerCase().includes(requirementId.toLowerCase())
      })
      .map((cr) => ({
        id: cr.id,
        title: cr.title,
      }))

    // Get children
    const children = requirements.filter((req) => req.parentId === requirementId)

    return {
      requirementId,
      children,
      linkedFunctions,
      linkedIssues,
      linkedChangeRequests,
    }
  }

  const toggleRow = (requirementId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(requirementId)) {
        newSet.delete(requirementId)
      } else {
        newSet.add(requirementId)
        // Load linked elements when expanding
        if (!requirementData.has(requirementId)) {
          setRequirementData((prev) => {
            const newMap = new Map(prev)
            newMap.set(requirementId, getLinkedElements(requirementId))
            return newMap
          })
        }
      }
      return newSet
    })
  }

  // Filter requirements
  const filteredRequirements = useMemo(() => {
    return requirements.filter((req) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchesSearch =
          req.title.toLowerCase().includes(query) ||
          req.description.toLowerCase().includes(query) ||
          req.requirementId?.toLowerCase().includes(query) ||
          req.category?.toLowerCase().includes(query)
        if (!matchesSearch) return false
      }

      // Status filter
      if (statusFilter !== 'all' && req.status !== statusFilter) {
        return false
      }

      // Priority filter
      if (priorityFilter !== 'all' && req.priority !== priorityFilter) {
        return false
      }

      // Category filter
      if (categoryFilter !== 'all') {
        if (categoryFilter === 'unassigned' && req.category) {
          return false
        }
        if (categoryFilter !== 'unassigned' && req.category !== categoryFilter) {
          return false
        }
      }

      // Owner filter
      if (ownerFilter !== 'all') {
        if (ownerFilter === 'unassigned' && req.owner) {
          return false
        }
        if (ownerFilter !== 'unassigned' && req.owner !== ownerFilter) {
          return false
        }
      }

      // Source filter
      if (sourceFilter !== 'all') {
        if (sourceFilter === 'unassigned' && req.source) {
          return false
        }
        if (sourceFilter !== 'unassigned' && req.source !== sourceFilter) {
          return false
        }
      }

      return true
    })
  }, [requirements, searchQuery, statusFilter, priorityFilter, categoryFilter, ownerFilter, sourceFilter])

  const hierarchyRequirements = useMemo(() => {
    return buildHierarchy(filteredRequirements)
  }, [filteredRequirements])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const renderRequirementRow = (req: Requirement, level: number = 0) => {
    const isExpanded = expandedRows.has(req.id)
    const hasChildren = req.children && req.children.length > 0
    const rowData = requirementData.get(req.id)
    const linkedFunctionsCount = functions.filter((f) => f.sourceReqId === req.id).length

    return (
      <>
        <tr
          key={req.id}
          className={clsx(
            'hover:bg-gray-50 dark:hover:bg-gray-700/50',
            level > 0 && 'bg-gray-50/50 dark:bg-gray-900/30'
          )}
        >
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 24}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleRow(req.id)}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
                  ) : (
                    <ChevronRight size={16} className="text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              ) : (
                <div className="w-6" />
              )}
              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">
                {req.requirementId || req.id.substring(0, 8)}
              </span>
            </div>
          </td>
          <td className="px-4 py-3">
            <span className="font-medium text-gray-900 dark:text-white">{req.title}</span>
          </td>
          <td className="px-4 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {req.category || '—'}
            </span>
          </td>
          <td className="px-4 py-3">
            <span className={clsx('px-2 py-1 rounded-full text-xs font-medium', getPriorityColor(req.priority))}>
              {req.priority}
            </span>
          </td>
          <td className="px-4 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">{req.status || 'draft'}</span>
          </td>
          <td className="px-4 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">{req.owner || '—'}</span>
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditingRequirement(req)
                }}
                className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                title="Edit requirement"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirmation(req)
                }}
                className="p-1.5 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                title="Delete requirement"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </td>
        </tr>
        {isExpanded && rowData && (
          <>
            {/* Linked Functions */}
            {rowData.linkedFunctions.length > 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-2 bg-blue-50/50 dark:bg-blue-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <Settings size={14} />
                      Linked Functions ({rowData.linkedFunctions.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedFunctions.map((func) => (
                        <div
                          key={func.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {func.functionId || func.id.substring(0, 8)}
                          </span>{' '}
                          - {func.name}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Linked Issues */}
            {rowData.linkedIssues.length > 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-2 bg-yellow-50/50 dark:bg-yellow-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-yellow-600 dark:text-yellow-400 mb-2 flex items-center gap-2">
                      <AlertCircle size={14} />
                      Linked Issues ({rowData.linkedIssues.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedIssues.map((issue) => (
                        <div
                          key={issue.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          {issue.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Linked Change Requests */}
            {rowData.linkedChangeRequests.length > 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-2 bg-purple-50/50 dark:bg-purple-900/10">
                  <div className="pl-8">
                    <p className="text-xs font-medium text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
                      <FileText size={14} />
                      Linked Change Requests ({rowData.linkedChangeRequests.length})
                    </p>
                    <div className="space-y-1">
                      {rowData.linkedChangeRequests.map((cr) => (
                        <div
                          key={cr.id}
                          className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700"
                        >
                          {cr.title}
                        </div>
                      ))}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {/* Description */}
            <tr>
              <td colSpan={7} className="px-4 py-3 bg-gray-50 dark:bg-gray-900/50">
                <div className="pl-8">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Description</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                    {req.description}
                  </p>
                  {req.acceptanceCriteria && (
                    <>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 mt-3">
                        Acceptance Criteria
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {req.acceptanceCriteria}
                      </p>
                    </>
                  )}
                </div>
              </td>
            </tr>
          </>
        )}
        {/* Render children if expanded */}
        {isExpanded && hasChildren && req.children && (
          <>
            {req.children.map((child) => {
              const childReq = requirements.find((r) => r.id === child.id)
              return childReq ? renderRequirementRow(childReq, level + 1) : null
            })}
          </>
        )}
      </>
    )
  }

  const handleDeleteClick = (req: Requirement) => {
    const hasChildren = requirements.some((r) => r.parentId === req.id)
    const linkedFunctionsCount = functions.filter((f) => f.sourceReqId === req.id).length
    
    if (hasChildren || linkedFunctionsCount > 0) {
      // Show warning modal
      setDeleteConfirmation(req)
    } else {
      // Direct delete
      if (window.confirm(`Are you sure you want to delete requirement "${req.requirementId || req.title}"?`)) {
        deleteRequirementMutation.mutate(req.id)
      }
    }
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      deleteRequirementMutation.mutate(deleteConfirmation.id)
    }
  }

  // Get unique values for filters
  const uniqueStatuses = Array.from(new Set(requirements.map((r) => r.status).filter(Boolean)))
  const uniqueCategories = Array.from(new Set(requirements.map((r) => r.category).filter(Boolean)))
  const uniqueOwners = Array.from(new Set(requirements.map((r) => r.owner).filter(Boolean)))
  const uniqueSources = Array.from(new Set(requirements.map((r) => r.source).filter(Boolean)))

  return (
    <div className="space-y-6">
      <ProjectNavigation />

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Requirements</h2>
        <button
          onClick={() => {
            setParentRequirement(null)
            setIsCreateModalOpen(true)
          }}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          <span>Create Requirement</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search requirements by title, description, ID, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Priority
                </label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Priorities</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Category
                </label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Categories</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
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
                  {uniqueOwners.map((owner) => (
                    <option key={owner} value={owner}>
                      {owner}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                  Source
                </label>
                <select
                  value={sourceFilter}
                  onChange={(e) => setSourceFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Sources</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueSources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Requirements Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requirement ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading requirements...
                  </td>
                </tr>
              ) : hierarchyRequirements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    {requirements.length === 0
                      ? 'No requirements found. Click "Create Requirement" to get started.'
                      : 'No requirements match your search or filter criteria.'}
                  </td>
                </tr>
              ) : (
                hierarchyRequirements.map((req) => renderRequirementRow(req))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {isCreateModalOpen && projectId && (
        <CreateRequirementModal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false)
            setParentRequirement(null)
          }}
          projectId={projectId}
          parentRequirement={parentRequirement}
        />
      )}

      {editingRequirement && projectId && (
        <EditRequirementModal
          isOpen={!!editingRequirement}
          onClose={() => setEditingRequirement(null)}
          projectId={projectId}
          requirement={editingRequirement}
        />
      )}

      {deleteConfirmation && (
        <DeleteRequirementModal
          isOpen={!!deleteConfirmation}
          requirement={deleteConfirmation}
          hasChildren={requirements.some((r) => r.parentId === deleteConfirmation.id)}
          linkedFunctionsCount={functions.filter((f) => f.sourceReqId === deleteConfirmation.id).length}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isDeleting={deleteRequirementMutation.isPending}
        />
      )}
    </div>
  )
}
