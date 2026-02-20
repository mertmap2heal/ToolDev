import { useState, useMemo, useEffect } from 'react'
import { Plus, Filter, Download, Search, RefreshCw, ArrowUpDown, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useSearchParams } from 'react-router-dom'
import { changeRequestService } from '../../services/changeRequest.service'
import CreateChangeRequestModal from '../../components/changeRequests/CreateChangeRequestModal'
import ChangeRequestDetailDrawer from '../../components/changeRequests/ChangeRequestDetailDrawer'
import { format } from 'date-fns'
import clsx from 'clsx'
import type { ChangeRequest } from 'shared/types/engineering.types'

import RequirementDetailDrawer from '../../components/requirements/RequirementDetailDrawer'
import { requirementService } from '../../services/requirement.service'
import type { Requirement } from 'shared/types/engineering.types'

type SortField = 'crId' | 'title' | 'priority' | 'status' | 'updatedAt' | 'requestedBy'
type SortOrder = 'asc' | 'desc'

export default function ChangeRequestsPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchParams] = useSearchParams()
  const focusId = searchParams.get('focusId')
  const queryClient = useQueryClient()

  // State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedChangeRequest, setSelectedChangeRequest] = useState<ChangeRequest | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Requirement Drawer State
  const [selectedRequirement, setSelectedRequirement] = useState<Requirement | null>(null)
  const [isReqDrawerOpen, setIsReqDrawerOpen] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  const [sortField, setSortField] = useState<SortField>('updatedAt')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // Data Fetching
  const { data: changeRequests = [], isLoading, refetch } = useQuery({
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

  // Fetch Requirements for ID mapping
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Requirement ID Map for quick lookup
  const reqIdMap = useMemo(() => {
    const map: Record<string, string> = {}
    requirements.forEach(req => {
      map[req.id] = req.requirementId || req.id
    })
    return map
  }, [requirements])

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (!projectId) throw new Error('Project ID required')
      return changeRequestService.deleteChangeRequest(projectId, id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests', projectId] })
      if (selectedChangeRequest) {
        setIsDrawerOpen(false)
        setSelectedChangeRequest(null)
      }
    },
  })

  // Handle Deep Links
  useEffect(() => {
    if (!focusId || changeRequests.length === 0) return
    const cr = changeRequests.find(item => item.id === focusId || item.crId === focusId)
    if (cr) {
      setSelectedChangeRequest(cr)
      setIsDrawerOpen(true)
    }
  }, [focusId, changeRequests])

  // Filtering & Sorting
  const filteredChangeRequests = useMemo(() => {
    return changeRequests.filter((cr) => {
      // Search
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const matchTitle = cr.title.toLowerCase().includes(query)
        const matchDesc = cr.description.toLowerCase().includes(query)
        const matchId = cr.crId?.toLowerCase().includes(query) || false
        if (!matchTitle && !matchDesc && !matchId) return false
      }

      // Filters
      if (statusFilter.length > 0 && !statusFilter.includes(cr.status)) return false
      if (priorityFilter.length > 0 && !priorityFilter.includes(cr.priority)) return false

      return true
    }).sort((a, b) => {
      const aValue = a[sortField] || ''
      const bValue = b[sortField] || ''

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }, [changeRequests, searchQuery, statusFilter, priorityFilter, sortField, sortOrder])

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc') // Default to desc for new field
    }
  }

  const handleRowClick = (cr: ChangeRequest) => {
    setSelectedChangeRequest(cr)
    setIsDrawerOpen(true)
  }

  const handleReqClick = (e: React.MouseEvent, reqId: string) => {
    e.stopPropagation()
    const req = requirements.find(r => r.id === reqId)
    if (req) {
      setSelectedRequirement(req)
      setIsReqDrawerOpen(true)
    }
  }

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedRows(new Set(filteredChangeRequests.map(cr => cr.id)))
    } else {
      setSelectedRows(new Set())
    }
  }

  const handleSelectRow = (id: string, e: React.SyntheticEvent) => {
    e.stopPropagation()
    const newSelected = new Set(selectedRows)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedRows(newSelected)
  }

  const handleDelete = (cr: ChangeRequest) => {
    if (window.confirm(`Are you sure you want to delete ${cr.crId || 'this change request'}?`)) {
      deleteMutation.mutate(cr.id)
    }
  }

  // UI Helpers
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 bg-red-50 dark:bg-red-900/20'
      case 'high': return 'text-orange-600 bg-orange-50 dark:bg-orange-900/20'
      case 'medium': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20'
      case 'low': return 'text-green-600 bg-green-50 dark:bg-green-900/20'
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle size={14} className="text-green-500" />
      case 'rejected': return <AlertCircle size={14} className="text-red-500" />
      case 'in-review': return <Clock size={14} className="text-blue-500" />
      default: return <Clock size={14} className="text-gray-400" />
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-shrink-0 pr-6">

      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto space-y-6 pr-6">
          {/* Header / Toolbar */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Change Requests</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage and track changes to requirements and design artifacts.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                <Download size={16} />
                Export
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
              >
                <Plus size={16} />
                New Change Request
              </button>
            </div>
          </div>

          {/* Search & Filters Card */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search change requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  className={clsx(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors border",
                    isFiltersOpen || statusFilter.length > 0 || priorityFilter.length > 0
                      ? "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600"
                  )}
                >
                  <Filter size={16} />
                  Filters
                  {(statusFilter.length > 0 || priorityFilter.length > 0) && (
                    <span className="bg-blue-600 text-white text-xs px-1.5 rounded-full">
                      {statusFilter.length + priorityFilter.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => refetch()}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>

            {/* Filters Accordion */}
            {isFiltersOpen && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Status</label>
                  <div className="space-y-1">
                    {['pending', 'in-review', 'approved', 'rejected'].map(status => (
                      <label key={status} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={statusFilter.includes(status)}
                          onChange={(e) => {
                            if (e.target.checked) setStatusFilter([...statusFilter, status])
                            else setStatusFilter(statusFilter.filter(s => s !== status))
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="capitalize">{status.replace('-', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">Priority</label>
                  <div className="space-y-1">
                    {['low', 'medium', 'high', 'critical'].map(p => (
                      <label key={p} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={priorityFilter.includes(p)}
                          onChange={(e) => {
                            if (e.target.checked) setPriorityFilter([...priorityFilter, p])
                            else setPriorityFilter(priorityFilter.filter(s => s !== p))
                          }}
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="capitalize">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table Content */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden flex-1 min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredChangeRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                  <Filter size={32} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No change requests found</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-sm">
                  {searchQuery || statusFilter.length > 0 ? "Try adjusting your filters or search query." : "Get started by creating a new change request."}
                </p>
                {!searchQuery && statusFilter.length === 0 && (
                  <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Create Change Request
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto h-full">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.1)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                          checked={selectedRows.size > 0 && selectedRows.size === filteredChangeRequests.length}
                          onChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleSort('crId')}>
                        <div className="flex items-center gap-1">ID <ArrowUpDown size={12} className="opacity-50" /></div>
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleSort('title')}>
                        <div className="flex items-center gap-1">Title <ArrowUpDown size={12} className="opacity-50" /></div>
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                        Source
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleSort('status')}>
                        <div className="flex items-center gap-1">Status <ArrowUpDown size={12} className="opacity-50" /></div>
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleSort('priority')}>
                        <div className="flex items-center gap-1">Priority <ArrowUpDown size={12} className="opacity-50" /></div>
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleSort('requestedBy')}>
                        <div className="flex items-center gap-1">Requested By <ArrowUpDown size={12} className="opacity-50" /></div>
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700" onClick={() => handleSort('updatedAt')}>
                        <div className="flex items-center gap-1">Updated <ArrowUpDown size={12} className="opacity-50" /></div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {filteredChangeRequests.map((cr) => (
                      <tr
                        key={cr.id}
                        onClick={() => handleRowClick(cr)}
                        className={clsx(
                          "group hover:bg-blue-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer",
                          selectedChangeRequest?.id === cr.id ? "bg-blue-50 dark:bg-gray-700/50" : ""
                        )}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            checked={selectedRows.has(cr.id)}
                            onChange={(e) => handleSelectRow(cr.id, e)}
                          />
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-gray-600 dark:text-gray-400">
                          {cr.crId || <span className="text-gray-300">-</span>}
                        </td>
                        <td className="px-4 py-3 max-w-md">
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{cr.description}</div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          {cr.requirementLinks && cr.requirementLinks.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {cr.requirementLinks.map(link => (
                                <button
                                  key={link.requirement.id}
                                  onClick={(e) => handleReqClick(e, link.requirement.id)}
                                  className="text-left font-mono text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                >
                                  {link.requirement.requirementId || link.requirement.id.substring(0, 8)}
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              <span className="capitalize">{cr.sourceType}</span>
                              {cr.sourceType === 'requirement' && cr.sourceId ? (
                                <button
                                  onClick={(e) => handleReqClick(e, cr.sourceId!)}
                                  className="text-left font-mono text-xs text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  {reqIdMap[cr.sourceId] || cr.sourceId.substring(0, 8)}
                                </button>
                              ) : (
                                <span className="font-mono text-xs text-gray-400">{cr.sourceId ? cr.sourceId.substring(0, 8) : '-'}</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {getStatusIcon(cr.status)}
                            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">{cr.status.replace('-', ' ')}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={clsx("px-2 py-0.5 rounded text-xs font-medium capitalize", getPriorityColor(cr.priority))}>
                            {cr.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                          {cr.requestedBy || 'Unknown'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(cr.updatedAt), 'MMM d, yyyy')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Modals placed within scrolling container like RequirementsPage */}
          <CreateChangeRequestModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            projectId={projectId!}
          />
        </div>

        {/* Detail Drawer - Sibling to scrolling content */}
        <ChangeRequestDetailDrawer
          isOpen={isDrawerOpen}
          changeRequest={selectedChangeRequest}
          projectId={projectId!}
          onClose={() => setIsDrawerOpen(false)}
          onEdit={() => {
            setIsCreateModalOpen(true)
          }}
          onDelete={handleDelete}
        />

        {/* Requirement Detail Drawer */}
        <RequirementDetailDrawer
          isOpen={isReqDrawerOpen}
          requirement={selectedRequirement}
          projectId={projectId!}
          onClose={() => setIsReqDrawerOpen(false)}
          onEdit={() => { }}
          onDelete={() => { }}
        />
      </div>
    </div>
  )
}
