import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Search, X, Filter, ChevronDown, ChevronUp, FileText, ExternalLink, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import ProjectNavigation from '../../components/projects/ProjectNavigation'
import { changeRequestService } from '../../services/changeRequest.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { parameterService } from '../../services/parameter.service'
import ChangeRequestDetailsModal from '../../components/changeRequests/ChangeRequestDetailsModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import type { ChangeRequest } from '../../../shared/types/engineering.types'
import type { SystemFunction } from '../../../shared/types/engineering.types'
import type { Issue } from '../../../shared/types/engineering.types'
import type { Parameter } from '../../../shared/types/engineering.types'
import clsx from 'clsx'
import { format } from 'date-fns'

export default function ChangeRequestsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<string>('all')
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<ChangeRequest | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const { data: changeRequests = [], isLoading } = useQuery({
    queryKey: ['change-requests', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await changeRequestService.getChangeRequests(projectId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load change requests')
    },
    enabled: !!projectId,
  })

  // Fetch all source items for linking
  const { data: functionsData } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: issuesData } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: parametersData } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await parameterService.getParameters(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Ensure arrays with fallback
  const functions = Array.isArray(functionsData) ? functionsData : []
  const issues = Array.isArray(issuesData) ? issuesData : []
  const parameters = Array.isArray(parametersData) ? parametersData : []

  const getSourceItem = (cr: ChangeRequest) => {
    if (cr.sourceType === 'function') {
      if (!Array.isArray(functions)) return null
      const func = functions.find((f) => f.id === cr.sourceId)
      return func ? { type: 'function', item: func, name: `${func.functionId || 'N/A'}: ${func.name}` } : null
    } else if (cr.sourceType === 'issue') {
      if (!Array.isArray(issues)) return null
      const issue = issues.find((i) => i.id === cr.sourceId)
      return issue ? { type: 'issue', item: issue, name: issue.title } : null
    } else if (cr.sourceType === 'parameter') {
      if (!Array.isArray(parameters)) return null
      const param = parameters.find((p) => p.id === cr.sourceId)
      return param ? { type: 'parameter', item: param, name: param.name } : null
    }
    return null
  }

  const handleSourceClick = (cr: ChangeRequest) => {
    if (!projectId) return
    if (cr.sourceType === 'function') {
      navigate(`/projects/${projectId}/functions`)
    } else if (cr.sourceType === 'issue') {
      navigate(`/projects/${projectId}/issues`)
    } else if (cr.sourceType === 'parameter') {
      navigate(`/projects/${projectId}/parameters`)
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'low':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      case 'in-review':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const filteredChangeRequests = changeRequests.filter((cr) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = cr.title.toLowerCase().includes(query)
      const matchesDescription = cr.description.toLowerCase().includes(query)
      const matchesRequestedBy = cr.requestedBy?.toLowerCase().includes(query) || false
      const sourceItem = getSourceItem(cr)
      const matchesSource = sourceItem?.name.toLowerCase().includes(query) || false
      if (!matchesTitle && !matchesDescription && !matchesRequestedBy && !matchesSource) {
        return false
      }
    }

    if (statusFilter !== 'all' && cr.status !== statusFilter) {
      return false
    }

    if (priorityFilter !== 'all' && cr.priority !== priorityFilter) {
      return false
    }

    if (sourceTypeFilter !== 'all' && cr.sourceType !== sourceTypeFilter) {
      return false
    }

    return true
  })

  const uniqueStatuses = Array.from(new Set(changeRequests.map((cr) => cr.status)))
  const uniquePriorities = Array.from(new Set(changeRequests.map((cr) => cr.priority)))
  const uniqueSourceTypes = Array.from(new Set(changeRequests.map((cr) => cr.sourceType)))

  return (
    <div className="space-y-6">
      <ProjectNavigation />
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Change Requests</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          <span>Create a new change request</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search change requests..."
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Priorities</option>
                  {uniquePriorities.map((priority) => (
                    <option key={priority} value={priority}>
                      {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Type</label>
                <select
                  value={sourceTypeFilter}
                  onChange={(e) => setSourceTypeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Source Types</option>
                  {uniqueSourceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Change Requests Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Requested By
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading change requests...
                  </td>
                </tr>
              ) : filteredChangeRequests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    No change requests found
                  </td>
                </tr>
              ) : (
                filteredChangeRequests.map((cr) => {
                  const sourceItem = getSourceItem(cr)
                  const sourceFunction = cr.sourceType === 'function' && Array.isArray(functions) ? functions.find((f) => f.id === cr.sourceId) : null
                  const sourceIssue = cr.sourceType === 'issue' && Array.isArray(issues) ? issues.find((i) => i.id === cr.sourceId) : null
                  const sourceParameter = cr.sourceType === 'parameter' && Array.isArray(parameters) ? parameters.find((p) => p.id === cr.sourceId) : null
                  
                  return (
                    <tr
                      key={cr.id}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelectedChangeRequest(cr)
                      }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900 dark:text-white">{cr.title}</span>
                          {cr.description && (
                            <span className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
                              {cr.description}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {sourceItem ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSourceClick(cr)
                            }}
                            className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline cursor-pointer group"
                          >
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                              {cr.sourceType.charAt(0).toUpperCase() + cr.sourceType.slice(1)}
                            </span>
                            <span className="font-medium">{sourceItem.name}</span>
                            <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500">
                            {cr.sourceType}: {cr.sourceId.substring(0, 8)}...
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            getPriorityColor(cr.priority)
                          )}
                        >
                          {cr.priority.charAt(0).toUpperCase() + cr.priority.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={clsx(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                            getStatusColor(cr.status)
                          )}
                        >
                          {cr.status.charAt(0).toUpperCase() + cr.status.slice(1).replace('-', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {cr.requestedBy || '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(cr.createdAt), 'MMM dd, yyyy')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Change Request Details Modal */}
      {selectedChangeRequest && (
        <ChangeRequestDetailsModal
          isOpen={!!selectedChangeRequest}
          onClose={() => setSelectedChangeRequest(null)}
          changeRequest={selectedChangeRequest}
          sourceFunction={
            selectedChangeRequest.sourceType === 'function'
              ? functions.find((f) => f.id === selectedChangeRequest.sourceId) || null
              : null
          }
          sourceIssue={
            selectedChangeRequest.sourceType === 'issue'
              ? issues.find((i) => i.id === selectedChangeRequest.sourceId) || null
              : null
          }
          sourceParameter={
            selectedChangeRequest.sourceType === 'parameter'
              ? parameters.find((p) => p.id === selectedChangeRequest.sourceId) || null
              : null
          }
        />
      )}

      {/* Create Change Request Modal */}
      {projectId && (
        <CreateChangeRequestModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          projectId={projectId}
        />
      )}
    </div>
  )
}
