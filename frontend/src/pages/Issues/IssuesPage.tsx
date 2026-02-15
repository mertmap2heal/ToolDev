import { useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Filter, AlertCircle, X, Edit2, Trash2, Plus, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { issueService } from '../../services/issue.service'
import { functionService } from '../../services/function.service'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import IssueSourceDetailsModal from '../../components/issues/IssueSourceDetailsModal'
import CreateIssueModal from '../../components/issues/CreateIssueModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import type { Issue } from 'shared/types/engineering.types'
import type { SystemFunction } from 'shared/types/engineering.types'
import clsx from 'clsx'
import { format } from 'date-fns'

export default function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [priorityFilter, setPriorityFilter] = useState<string>(searchParams.get('priority') || 'all')
  const [ownerFilter, setOwnerFilter] = useState<string>(searchParams.get('owner') || 'all')
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<string>('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; title: string } | null>(null)
  const [viewingSource, setViewingSource] = useState<Issue | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [changeRequestModal, setChangeRequestModal] = useState<{ isOpen: boolean; sourceId: string; sourceName: string } | null>(null)
  const queryClient = useQueryClient()

  const { data: issues = [], isLoading: issuesLoading } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const response = await issueService.getIssues(projectId)
      if (response.success && response.data) {
        return response.data
      }
      throw new Error(response.error || 'Failed to load issues')
    },
    enabled: !!projectId,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await functionService.getFunctions(projectId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
    enabled: !!projectId,
  })

  const getFunctionName = (functionId: string): string => {
    const func = functions.find((f) => f.id === functionId)
    return func ? `${func.functionId || 'N/A'}: ${func.name}` : 'Unknown Function'
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
      case 'open':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'in-progress':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const filteredIssues = issues.filter((issue) => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesTitle = issue.title.toLowerCase().includes(query)
      const matchesDescription = issue.description.toLowerCase().includes(query)
      const matchesOwner = issue.owner?.toLowerCase().includes(query) || false
      if (!matchesTitle && !matchesDescription && !matchesOwner) {
        return false
      }
    }

    // Status filter
    if (statusFilter !== 'all' && issue.status !== statusFilter) {
      return false
    }

    // Priority filter
    if (priorityFilter !== 'all' && issue.priority !== priorityFilter) {
      return false
    }

    // Owner filter
    if (ownerFilter !== 'all') {
      if (ownerFilter === 'unassigned' && issue.owner) {
        return false
      }
      if (ownerFilter !== 'unassigned' && issue.owner !== ownerFilter) {
        return false
      }
    }

    return true
  })

  const uniqueOwners = Array.from(new Set(issues.map((issue) => issue.owner).filter(Boolean)))

  const updateIssueStatusMutation = useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: string }) => {
      if (!projectId) throw new Error('Project ID required')
      return issueService.updateIssue(projectId, issueId, { status: status as Issue['status'] })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setEditingIssueId(null)
      setEditingStatus('')
    },
    onError: (error: any) => {
      console.error('Update issue status error:', error)
      alert(error?.error || 'Failed to update issue status')
      setEditingIssueId(null)
      setEditingStatus('')
    },
  })

  const deleteIssueMutation = useMutation({
    mutationFn: (issueId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return issueService.deleteIssue(projectId, issueId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setDeleteConfirmation(null)
    },
    onError: (error: any) => {
      console.error('Delete issue error:', error)
      alert(error?.error || 'Failed to delete issue')
      setDeleteConfirmation(null)
    },
  })

  const handleEditClick = (e: React.MouseEvent, issue: Issue) => {
    e.stopPropagation()
    setEditingIssueId(issue.id)
    setEditingStatus(issue.status)
  }

  const handleStatusChange = (issueId: string, newStatus: string) => {
    setEditingStatus(newStatus)
    updateIssueStatusMutation.mutate({ issueId, status: newStatus })
  }

  const handleDeleteClick = (e: React.MouseEvent, issue: Issue) => {
    e.stopPropagation()
    setDeleteConfirmation({ id: issue.id, title: issue.title })
  }

  const handleIssueRowClick = (issueId: string) => {
    // Preserve current filter state in URL
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (priorityFilter !== 'all') params.set('priority', priorityFilter)
    if (ownerFilter !== 'all') params.set('owner', ownerFilter)

    const queryString = params.toString()
    navigate(`/projects/${projectId}/issues/${issueId}${queryString ? `?${queryString}` : ''}`)
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      deleteIssueMutation.mutate(deleteConfirmation.id)
    }
  }

  return (
    <div className="space-y-6">


      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Issues</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={16} />
          <span>Create a new issue</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search issues..."
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
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Priority Filter */}
              <div>
                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Priorities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              {/* Owner Filter */}
              <div>
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
            </div>
          </div>
        )}
      </div>

      {/* Issues Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 min-h-[400px]">
        <div className="overflow-x-auto h-full">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-32">
                  ID
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {issuesLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                    Loading issues...
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                    {issues.length === 0
                      ? 'No issues found. Create your first issue from the Functions page.'
                      : 'No issues match your filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr
                    key={issue.id}
                    onClick={() => handleIssueRowClick(issue.id)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                  >
                    <td className="px-3 py-2">
                      <span className="font-mono text-sm text-blue-600 dark:text-blue-400">
                        {issue.issueKey || `#${issue.id.slice(0, 8)}`}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle
                          size={14}
                          className={clsx(
                            issue.priority === 'critical' && 'text-red-500',
                            issue.priority === 'high' && 'text-orange-500',
                            issue.priority === 'medium' && 'text-yellow-500',
                            issue.priority === 'low' && 'text-blue-500'
                          )}
                        />
                        <span className="font-medium text-sm text-gray-900 dark:text-white">{issue.title}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={clsx(
                          'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                          getPriorityColor(issue.priority)
                        )}
                      >
                        {issue.priority.charAt(0).toUpperCase() + issue.priority.slice(1)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {editingIssueId === issue.id ? (
                        <select
                          value={editingStatus}
                          onChange={(e) => handleStatusChange(issue.id, e.target.value)}
                          className={clsx(
                            'px-2 py-1 text-xs font-medium rounded-full border-0 focus:outline-none focus:ring-2 focus:ring-blue-500',
                            getStatusColor(editingStatus),
                            'bg-transparent'
                          )}
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        >
                          <option value="open">Open</option>
                          <option value="in-progress">In Progress</option>
                          <option value="closed">Closed</option>
                        </select>
                      ) : (
                        <span
                          className={clsx(
                            'inline-flex px-2 py-1 text-xs font-medium rounded-full',
                            getStatusColor(issue.status)
                          )}
                        >
                          {issue.status.charAt(0).toUpperCase() + issue.status.slice(1).replace('-', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {issue.owner || <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(issue.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setChangeRequestModal({
                              isOpen: true,
                              sourceId: issue.id,
                              sourceName: issue.title,
                            })
                          }}
                          className="p-1 hover:bg-green-100 dark:hover:bg-green-900/20 rounded text-green-600 dark:text-green-400"
                          title="Create Change Request"
                        >
                          <FileText size={16} />
                        </button>
                        <button
                          onClick={(e) => handleEditClick(e, issue)}
                          className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded text-blue-600 dark:text-blue-400"
                          title="Edit status"
                          disabled={updateIssueStatusMutation.isPending && editingIssueId === issue.id}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(e, issue)}
                          disabled={deleteIssueMutation.isPending && deleteConfirmation?.id === issue.id}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete issue"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteConfirmation && (
        <DeleteConfirmationModal
          isOpen={!!deleteConfirmation}
          itemName={deleteConfirmation.title}
          itemType="issue"
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteConfirmation(null)}
          isDeleting={deleteIssueMutation.isPending}
        />
      )}

      {viewingSource && (
        <IssueSourceDetailsModal
          isOpen={!!viewingSource}
          onClose={() => setViewingSource(null)}
          issue={viewingSource}
          functions={functions}
        />
      )}

      {projectId && (
        <>
          <CreateIssueModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            projectId={projectId}
          />
          {changeRequestModal && (
            <CreateChangeRequestModal
              isOpen={changeRequestModal.isOpen}
              onClose={() => setChangeRequestModal(null)}
              projectId={projectId}
              sourceType="issue"
              sourceId={changeRequestModal.sourceId}
              sourceName={changeRequestModal.sourceName}
            />
          )}
        </>
      )}
    </div>
  )
}
