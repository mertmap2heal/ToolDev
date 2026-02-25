import { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Filter, AlertCircle, X, Edit2, Trash2, Plus, ChevronDown, ChevronUp, FileText, Code } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { issueService } from '../../services/issue.service'
import { functionService } from '../../services/function.service'
import DeleteConfirmationModal from '../../components/projects/DeleteConfirmationModal'
import IssueSourceDetailsModal from '../../components/issues/IssueSourceDetailsModal'
import CreateIssueModal from '../../components/issues/CreateIssueModal'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import type { Issue, IssueType, IssueLabel } from 'shared/types/engineering.types'
import type { SystemFunction } from 'shared/types/engineering.types'
import clsx from 'clsx'

const ISSUE_TYPE_LABELS: Record<string, string> = {
  specification_error: 'Specification',
  design_error: 'Design',
  coding_error: 'Coding',
  documentation_error: 'Documentation',
  interface_error: 'Interface',
  other: 'Other',
}

import { format } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import { authService } from '../../services/auth.service'

export default function IssuesPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all')
  const [priorityFilter, setPriorityFilter] = useState<string>(searchParams.get('priority') || 'all')
  const [ownerFilter, setOwnerFilter] = useState<string>(searchParams.get('owner') || 'all')
  const [assigneeFilter, setAssigneeFilter] = useState<string>(searchParams.get('assignee') || 'all')
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>(searchParams.get('type') || 'all')
  const [editingIssueId, setEditingIssueId] = useState<string | null>(null)
  const [editingStatus, setEditingStatus] = useState<string>('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; title: string } | null>(null)
  const [viewingSource, setViewingSource] = useState<Issue | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [changeRequestModal, setChangeRequestModal] = useState<{ isOpen: boolean; sourceId: string; sourceName: string } | null>(null)
  const [labelFilterId, setLabelFilterId] = useState<string>(searchParams.get('label') || 'all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState<'status' | 'assignee' | 'label' | null>(null)
  const [bulkStatus, setBulkStatus] = useState('')
  const [bulkAssigneeId, setBulkAssigneeId] = useState('')
  const [bulkLabelId, setBulkLabelId] = useState('')
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuthStore()

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

  const { data: projectLabels = [] } = useQuery({
    queryKey: ['labels', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await issueService.getProjectLabels(projectId)
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: usersList = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await authService.getUsers()
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: !!projectId && (bulkAction === 'assignee' || assigneeFilter !== 'all'),
  })

  // Sync filters and search to URL so state is shareable and survives refresh
  useEffect(() => {
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (priorityFilter !== 'all') params.set('priority', priorityFilter)
    if (ownerFilter !== 'all') params.set('owner', ownerFilter)
    if (assigneeFilter !== 'all') params.set('assignee', assigneeFilter)
    if (issueTypeFilter !== 'all') params.set('type', issueTypeFilter)
    if (labelFilterId !== 'all') params.set('label', labelFilterId)
    setSearchParams(params, { replace: true })
  }, [searchQuery, statusFilter, priorityFilter, ownerFilter, assigneeFilter, issueTypeFilter, labelFilterId, setSearchParams])

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
      const matchesAssignee = issue.assignee?.name?.toLowerCase().includes(query) || false
      if (!matchesTitle && !matchesDescription && !matchesOwner && !matchesAssignee) {
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

    // Owner filter (legacy free-text)
    if (ownerFilter !== 'all') {
      if (ownerFilter === 'unassigned' && issue.owner) {
        return false
      }
      if (ownerFilter !== 'unassigned' && issue.owner !== ownerFilter) {
        return false
      }
    }

    // Assignee filter (by user id)
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        if (issue.assigneeId) return false
      } else if (issue.assigneeId !== assigneeFilter) {
        return false
      }
    }

    // Issue type (DO-178C) filter
    if (issueTypeFilter !== 'all' && issue.issueType !== issueTypeFilter) {
      return false
    }

    // Label filter
    if (labelFilterId !== 'all' && !(issue.labelIds || []).includes(labelFilterId)) {
      return false
    }

    return true
  })

  const uniqueOwners = Array.from(new Set(issues.map((issue) => issue.owner).filter(Boolean)))
  // Unique assignees from issues (id + name for dropdown)
  const uniqueAssignees = Array.from(
    new Map(
      issues
        .filter((i) => i.assigneeId && i.assignee)
        .map((i) => [i.assigneeId!, { id: i.assigneeId!, name: i.assignee!.name }])
    ).values()
  )

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
    const params = new URLSearchParams()
    if (searchQuery) params.set('q', searchQuery)
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (priorityFilter !== 'all') params.set('priority', priorityFilter)
    if (ownerFilter !== 'all') params.set('owner', ownerFilter)
    if (assigneeFilter !== 'all') params.set('assignee', assigneeFilter)
    if (issueTypeFilter !== 'all') params.set('type', issueTypeFilter)
    if (labelFilterId !== 'all') params.set('label', labelFilterId)
    const queryString = params.toString()
    navigate(`/projects/${projectId}/issues/${issueId}${queryString ? `?${queryString}` : ''}`)
  }

  const handleConfirmDelete = () => {
    if (deleteConfirmation) {
      deleteIssueMutation.mutate(deleteConfirmation.id)
    }
  }

  const toggleSelect = (e: React.MouseEvent, issueId: string) => {
    e.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(issueId)) next.delete(issueId)
      else next.add(issueId)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredIssues.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredIssues.map((i) => i.id)))
    }
  }

  const applyQuickFilter = (preset: 'my' | 'open' | 'unassigned') => {
    if (preset === 'my') {
      setAssigneeFilter(currentUser?.id ?? 'all')
      setStatusFilter('all')
    } else if (preset === 'open') {
      setStatusFilter('open')
      setAssigneeFilter('all')
    } else {
      setAssigneeFilter('unassigned')
      setStatusFilter('all')
    }
  }

  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ issueIds, status }: { issueIds: string[]; status: string }) => {
      if (!projectId) throw new Error('Project ID required')
      await Promise.all(
        issueIds.map((id) => issueService.updateIssue(projectId, id, { status: status as Issue['status'] }))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setSelectedIds(new Set())
      setBulkAction(null)
    },
  })

  const bulkUpdateAssigneeMutation = useMutation({
    mutationFn: async ({ issueIds, assigneeId }: { issueIds: string[]; assigneeId: string | null }) => {
      if (!projectId) throw new Error('Project ID required')
      await Promise.all(
        issueIds.map((id) => issueService.updateIssue(projectId, id, { assigneeId: assigneeId || undefined }))
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setSelectedIds(new Set())
      setBulkAction(null)
    },
  })

  const bulkUpdateLabelMutation = useMutation({
    mutationFn: async ({ issueIds, labelId }: { issueIds: string[]; labelId: string }) => {
      if (!projectId) throw new Error('Project ID required')
      for (const id of issueIds) {
        const issue = issues.find((i) => i.id === id)
        const current = issue?.labelIds || []
        const next = current.includes(labelId) ? current : [...current, labelId]
        await issueService.updateIssue(projectId, id, { labelIds: next })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setSelectedIds(new Set())
      setBulkAction(null)
    },
  })

  const bulkDeleteMutation = useMutation({
    mutationFn: async (issueIds: string[]) => {
      if (!projectId) throw new Error('Project ID required')
      await Promise.all(issueIds.map((id) => issueService.deleteIssue(projectId, id)))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
      setSelectedIds(new Set())
      setBulkAction(null)
    },
  })

  const handleBulkStatus = () => {
    if (bulkStatus && selectedIds.size > 0) {
      bulkUpdateStatusMutation.mutate({ issueIds: Array.from(selectedIds), status: bulkStatus })
    }
  }

  const handleBulkAssignee = () => {
    if (selectedIds.size > 0) {
      bulkUpdateAssigneeMutation.mutate({
        issueIds: Array.from(selectedIds),
        assigneeId: bulkAssigneeId || null,
      })
    }
  }

  const handleBulkLabel = () => {
    if (bulkLabelId && selectedIds.size > 0) {
      bulkUpdateLabelMutation.mutate({ issueIds: Array.from(selectedIds), labelId: bulkLabelId })
    }
  }

  const handleBulkDelete = () => {
    if (selectedIds.size > 0 && window.confirm(`Delete ${selectedIds.size} issue(s)?`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds))
    }
  }

  return (
    <div className="space-y-6">


      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Issues</h2>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm"
        >
          <Plus size={16} />
          <span>Create a new issue</span>
        </button>
      </div>

      {/* Quick filters */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => applyQuickFilter('my')}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          My issues
        </button>
        <button
          type="button"
          onClick={() => applyQuickFilter('open')}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Open
        </button>
        <button
          type="button"
          onClick={() => applyQuickFilter('unassigned')}
          className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          Unassigned
        </button>
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
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
            <Filter size={16} className="text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters</span>
          </div>
          {isFiltersExpanded ? (
            <ChevronUp size={16} className="text-gray-600 dark:text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-600 dark:text-gray-400" />
          )}
        </button>
        {isFiltersExpanded && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                  <option value="resolved">Resolved</option>
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

              {/* Assignee Filter */}
              <div>
                <select
                  value={assigneeFilter}
                  onChange={(e) => setAssigneeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Assignees</option>
                  <option value="unassigned">Unassigned</option>
                  {uniqueAssignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Owner Filter (legacy) */}
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

              {/* Issue Type (DO-178C) Filter */}
              <div>
                <select
                  value={issueTypeFilter}
                  onChange={(e) => setIssueTypeFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Types</option>
                  {(Object.keys(ISSUE_TYPE_LABELS) as IssueType[]).map((t) => (
                    <option key={t} value={t}>
                      {ISSUE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Label Filter */}
              <div>
                <select
                  value={labelFilterId}
                  onChange={(e) => setLabelFilterId(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Labels</option>
                  {projectLabels.map((l: { id: string; name: string; color: string }) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-600 dark:text-gray-400 hover:underline"
          >
            Clear
          </button>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkAction || ''}
              onChange={(e) => setBulkAction((e.target.value || null) as typeof bulkAction)}
              className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="">Bulk action...</option>
              <option value="status">Change status</option>
              <option value="assignee">Assign to</option>
              <option value="label">Add label</option>
            </select>
            {bulkAction === 'status' && (
              <>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="">Status...</option>
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
                <button
                  type="button"
                  onClick={handleBulkStatus}
                  disabled={!bulkStatus || bulkUpdateStatusMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply
                </button>
              </>
            )}
            {bulkAction === 'assignee' && (
              <>
                <select
                  value={bulkAssigneeId}
                  onChange={(e) => setBulkAssigneeId(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="">User...</option>
                  {usersList.map((u: { id: string; name: string; email?: string }) => (
                    <option key={u.id} value={u.id}>{u.name || u.email}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkAssignee}
                  disabled={bulkUpdateAssigneeMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply
                </button>
              </>
            )}
            {bulkAction === 'label' && (
              <>
                <select
                  value={bulkLabelId}
                  onChange={(e) => setBulkLabelId(e.target.value)}
                  className="px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  <option value="">Label...</option>
                  {projectLabels.map((l: { id: string; name: string }) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleBulkLabel}
                  disabled={!bulkLabelId || bulkUpdateLabelMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Add
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            className="px-3 py-1.5 text-sm border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
          >
            Delete selected
          </button>
        </div>
      )}

      {/* Issues Table */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 min-h-[400px]">
        <div className="overflow-x-auto h-full">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
              <tr>
                <th className="px-2 py-2 w-10">
                  <input
                    type="checkbox"
                    checked={filteredIssues.length > 0 && selectedIds.size === filteredIssues.length}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
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
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                  Type
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Assignee
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Labels
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
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
                    Loading issues...
                  </td>
                </tr>
              ) : filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-gray-500 dark:text-gray-400">
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
                    className={clsx(
                      'hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer',
                      selectedIds.has(issue.id) && 'bg-blue-50/50 dark:bg-blue-900/10'
                    )}
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(issue.id)}
                        onChange={() => {}}
                        onClick={(e) => toggleSelect(e, issue.id)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
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
                          <option value="resolved">Resolved</option>
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
                    <td className="px-3 py-2">
                      {issue.issueType ? (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                          {ISSUE_TYPE_LABELS[issue.issueType] ?? issue.issueType}
                        </span>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
                      {issue.assignee?.name ?? issue.owner ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(issue.labels && issue.labels.length > 0)
                          ? issue.labels.map((l) => (
                              <span
                                key={l.id}
                                className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                                style={{
                                  backgroundColor: `${l.color}20`,
                                  color: l.color,
                                }}
                              >
                                {l.name}
                              </span>
                            ))
                          : (issue.labelIds || [])
                              .map((lid) => projectLabels.find((pl: IssueLabel) => pl.id === lid))
                              .filter((lab): lab is IssueLabel => lab != null)
                              .map((lab) => (
                                <span
                                  key={lab.id}
                                  className="inline-flex px-2 py-0.5 text-xs font-medium rounded"
                                  style={{
                                    backgroundColor: `${lab.color}20`,
                                    color: lab.color,
                                  }}
                                >
                                  {lab.name}
                                </span>
                              ))}
                        {(!issue.labels || issue.labels.length === 0) && (!issue.labelIds || issue.labelIds.length === 0) && (
                          <span className="text-gray-400 dark:text-gray-500">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                      {format(new Date(issue.createdAt), 'MMM dd, yyyy')}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewingSource(issue)
                          }}
                          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                          title="View source"
                        >
                          <Code size={16} />
                        </button>
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
