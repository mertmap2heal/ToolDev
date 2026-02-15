import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Search, Filter, ChevronDown, ChevronUp, Archive, RotateCcw, Trash2, AlertTriangle, Clock } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

import SafetyLinkPanel from '../../components/safety/SafetyLinkPanel'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import { requirementService } from '../../services/requirement.service'
import type { Requirement } from 'shared/types/engineering.types'

export default function ArchivePage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'requirements' | 'issues'>('requirements')
  const [confirmRestore, setConfirmRestore] = useState<Requirement | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Requirement | null>(null)
  const queryClient = useQueryClient()

  // Fetch recently deleted requirements
  const { data: deletedRequirements = [], isLoading } = useQuery({
    queryKey: ['deleted-requirements', projectId],
    queryFn: async () => {
      if (!projectId) return []
      const response = await requirementService.getRecentlyDeletedRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId && activeTab === 'requirements',
  })

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: (requirementId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.restoreRequirement(projectId, requirementId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-requirements', projectId] })
      queryClient.invalidateQueries({ queryKey: ['requirements', projectId] }) // Update main list too
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to restore requirement')
    },
  })

  // Permanent Delete mutation
  const permanentDeleteMutation = useMutation({
    mutationFn: (requirementId: string) => {
      if (!projectId) throw new Error('Project ID required')
      return requirementService.permanentDeleteRequirement(projectId, requirementId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-requirements', projectId] })
    },
    onError: (error: any) => {
      alert(error?.error || 'Failed to permanently delete requirement')
    },
  })

  // Filter logic
  const filteredItems = deletedRequirements.filter(item => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      item.title.toLowerCase().includes(searchLower) ||
      (item.requirementId && item.requirementId.toLowerCase().includes(searchLower)) ||
      item.description.toLowerCase().includes(searchLower) ||
      (item.deletedById && item.deletedById.toLowerCase().includes(searchLower))
    )
  })

  const getDaysLeft = (deletedAt: string) => {
    const deletedDate = new Date(deletedAt)
    const expiresAt = new Date(deletedDate.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 days
    const now = new Date()
    const msLeft = expiresAt.getTime() - now.getTime()
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    return Math.max(0, daysLeft)
  }

  const handleRestore = (req: Requirement) => {
    setConfirmRestore(req)
  }

  const handlePermanentDelete = (req: Requirement) => {
    setConfirmDelete(req)
  }

  const confirmRestoreAction = () => {
    if (confirmRestore) {
      restoreMutation.mutate(confirmRestore.id)
    }
  }

  const confirmDeleteAction = () => {
    if (confirmDelete) {
      permanentDeleteMutation.mutate(confirmDelete.id)
    }
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex-shrink-0 pr-6">

      </div>

      <div className="flex-1 overflow-y-auto pr-6 pb-6">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden min-h-[600px] flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <Archive size={24} className="text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Trash</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Items are permanently deleted after 7 days
                  </p>
                </div>
              </div>
              {projectId && <SafetyLinkPanel variant="archived" ctaOnly />}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 mb-4">
              <button
                onClick={() => setActiveTab('requirements')}
                className={clsx(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'requirements'
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Requirements
              </button>
              <button
                onClick={() => setActiveTab('issues')}
                className={clsx(
                  "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                  activeTab === 'issues'
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                )}
              >
                Issues (Coming Soon)
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search deleted ${activeTab}...`}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-x-auto">
            {activeTab === 'requirements' ? (
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Requirement
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Deleted By
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Deleted Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Reason
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Expires In
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Archive size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">No recently deleted items found</p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          Items in trash older than 7 days are automatically removed.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((req) => (
                      <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-mono text-sm text-gray-500 dark:text-gray-400 mr-2">
                              {req.requirementId || req.id.substring(0, 8)}
                            </span>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {req.title}
                            </span>
                          </div>
                          {req.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-md mt-1">
                              {req.description.replace(/<[^>]*>/g, '')}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {req.deletedByUser ? (
                            <span className="font-medium">{req.deletedByUser.name}</span>
                          ) : req.deletedById ? (
                            <span className="font-mono text-xs">{req.deletedById.substring(0, 8)}...</span>
                          ) : (
                            <span className="text-gray-400 italic">Unknown</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300">
                          {req.deletedAt && (
                            <div className="flex flex-col">
                              <span>{format(new Date(req.deletedAt), 'MMM d, yyyy')}</span>
                              <span className="text-xs text-gray-400">{format(new Date(req.deletedAt), 'h:mm a')}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 max-w-xs truncate">
                          {req.deleteReason || <span className="text-gray-400 italic">No reason provided</span>}
                        </td>
                        <td className="px-6 py-4">
                          {req.deletedAt && (
                            <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 font-medium text-sm">
                              <Clock size={14} />
                              {getDaysLeft(req.deletedAt as unknown as string)} days
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleRestore(req)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Restore Requirement"
                            >
                              <RotateCcw size={18} />
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(req)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Permanently Delete"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-20">
                <p className="text-gray-500">Issues trash is coming soon.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restore Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmRestore}
        onClose={() => setConfirmRestore(null)}
        onConfirm={confirmRestoreAction}
        title="Restore Requirement"
        message={`Are you sure you want to restore "${confirmRestore?.requirementId || confirmRestore?.title}"? It will be moved back to the active requirements list.`}
        confirmText="Restore"
        cancelText="Cancel"
        variant="info"
      />

      {/* Permanent Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmDeleteAction}
        title="Permanently Delete"
        message={`Are you sure you want to permanently delete "${confirmDelete?.requirementId || confirmDelete?.title}"? This action cannot be undone and all data will be lost forever.`}
        confirmText="Delete Forever"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  )
}
