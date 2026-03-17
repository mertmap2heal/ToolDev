import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Bookmark, Plus, X, Edit2, Trash2 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskService } from '../../services/task.service'
import type { SavedView, ListTasksFilters } from 'shared/types/task.types'

interface SavedViewsPanelProps {
  currentFilters: ListTasksFilters
  currentViewType: 'list' | 'board' | 'calendar' | 'timeline'
  onApplyView: (view: SavedView) => void
}

export default function SavedViewsPanel({
  currentFilters,
  currentViewType,
  onApplyView,
}: SavedViewsPanelProps) {
  const { projectId } = useParams<{ projectId?: string }>()
  const [isCreating, setIsCreating] = useState(false)
  const [viewName, setViewName] = useState('')
  const queryClient = useQueryClient()

  const { data: viewsData } = useQuery({
    queryKey: ['saved-views', projectId],
    queryFn: async () => {
      const response = await taskService.getSavedViews(projectId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
  })

  const createViewMutation = useMutation({
    mutationFn: (data: {
      projectId?: string
      name: string
      viewType: string
      queryJson?: string
      columnsJson?: string
      sortJson?: string
      groupJson?: string
    }) => taskService.createSavedView(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views'] })
      setIsCreating(false)
      setViewName('')
    },
  })

  const deleteViewMutation = useMutation({
    mutationFn: (viewId: string) => taskService.deleteSavedView(viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views'] })
    },
  })

  const views = viewsData || []

  const handleSaveCurrentView = () => {
    if (!viewName.trim()) return

    createViewMutation.mutate({
      projectId: projectId || undefined,
      name: viewName.trim(),
      viewType: currentViewType.toUpperCase(),
      queryJson: JSON.stringify(currentFilters),
    })
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Bookmark size={16} />
          Saved Views
        </h3>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            title="Save current view"
          >
            <Plus size={16} />
          </button>
        )}
      </div>

      {isCreating && (
        <div className="mb-3 space-y-2">
          <input
            type="text"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder="View name"
            className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSaveCurrentView()
              } else if (e.key === 'Escape') {
                setIsCreating(false)
                setViewName('')
              }
            }}
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveCurrentView}
              disabled={!viewName.trim() || createViewMutation.isPending}
              className="flex-1 px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
            <button
              onClick={() => {
                setIsCreating(false)
                setViewName('')
              }}
              className="px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-1">
        {views.length === 0 ? (
          <div className="text-xs text-gray-500 dark:text-gray-400 py-2">
            No saved views. Save your current filters as a view.
          </div>
        ) : (
          views.map((view: SavedView) => (
            <div
              key={view.id}
              className="flex items-center justify-between p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded group"
            >
              <button
                onClick={() => onApplyView(view)}
                className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                {view.name}
              </button>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm('Are you sure you want to delete this view?')) {
                      deleteViewMutation.mutate(view.id)
                    }
                  }}
                  className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
