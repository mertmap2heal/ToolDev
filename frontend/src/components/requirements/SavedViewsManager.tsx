import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save, FolderOpen, Trash2, Edit2, X, Check, Plus, Eye, Users, Building2 } from 'lucide-react'
import { viewService, CreateSavedViewDto } from '../../services/view.service'
import type { SavedView } from 'shared/types/engineering.types'
import clsx from 'clsx'

interface SavedViewsManagerProps {
  projectId: string
  currentFilters: {
    status: string
    priority: string
    category: string
    owner: string
    source: string
    searchQuery: string
  }
  onLoadView: (filters: {
    status: string
    priority: string
    category: string
    owner: string
    source: string
    searchQuery: string
  }) => void
}

/**
 * SavedViewsManager component provides functionality to save, load, and manage
 * custom filter configurations for the requirements table. Supports personal,
 * project-wide, and organization-wide view scopes.
 */
export default function SavedViewsManager({
  projectId,
  currentFilters,
  onLoadView,
}: SavedViewsManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [newViewType, setNewViewType] = useState<'personal' | 'project' | 'organization'>('personal')
  const [editingViewId, setEditingViewId] = useState<string | null>(null)
  const [editingViewName, setEditingViewName] = useState('')

  const queryClient = useQueryClient()

  // Fetch saved views for the project
  const { data: savedViews = [], isLoading } = useQuery({
    queryKey: ['saved-views', projectId],
    queryFn: async () => {
      const response = await viewService.getSavedViews(projectId)
      if (response.success && response.data) {
        return response.data
      }
      return []
    },
    enabled: !!projectId,
  })

  // Create new saved view mutation
  const createViewMutation = useMutation({
    mutationFn: (data: CreateSavedViewDto) => viewService.createSavedView(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views', projectId] })
      setIsSaveModalOpen(false)
      setNewViewName('')
      setNewViewType('personal')
    },
    onError: (error: any) => {
      console.error('Failed to create view:', error)
      alert('Failed to save view. Please try again.')
    },
  })

  // Update saved view mutation
  const updateViewMutation = useMutation({
    mutationFn: ({ viewId, data }: { viewId: string; data: { name?: string; filters?: any } }) =>
      viewService.updateSavedView(projectId, viewId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views', projectId] })
      setEditingViewId(null)
      setEditingViewName('')
    },
    onError: (error: any) => {
      console.error('Failed to update view:', error)
      alert('Failed to update view. Please try again.')
    },
  })

  // Delete saved view mutation
  const deleteViewMutation = useMutation({
    mutationFn: (viewId: string) => viewService.deleteSavedView(projectId, viewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-views', projectId] })
    },
    onError: (error: any) => {
      console.error('Failed to delete view:', error)
      alert('Failed to delete view. Please try again.')
    },
  })

  // Handle saving current filters as a new view
  const handleSaveView = () => {
    if (!newViewName.trim()) {
      alert('Please enter a view name.')
      return
    }

    createViewMutation.mutate({
      name: newViewName.trim(),
      type: newViewType,
      filters: currentFilters,
    })
  }

  // Handle loading a saved view's filters
  const handleLoadView = (view: SavedView) => {
    try {
      const filters = view.filters ? JSON.parse(view.filters) : {}
      onLoadView({
        status: filters.status || 'all',
        priority: filters.priority || 'all',
        category: filters.category || 'all',
        owner: filters.owner || 'all',
        source: filters.source || 'all',
        searchQuery: filters.searchQuery || '',
      })
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to parse view filters:', error)
      alert('Failed to load view. Invalid filter configuration.')
    }
  }

  // Handle updating a view with current filters
  const handleUpdateViewFilters = (viewId: string) => {
    updateViewMutation.mutate({
      viewId,
      data: { filters: currentFilters },
    })
  }

  // Handle renaming a view
  const handleRenameView = (viewId: string) => {
    if (!editingViewName.trim()) {
      setEditingViewId(null)
      return
    }

    updateViewMutation.mutate({
      viewId,
      data: { name: editingViewName.trim() },
    })
  }

  // Handle deleting a view
  const handleDeleteView = (viewId: string) => {
    if (window.confirm('Are you sure you want to delete this view?')) {
      deleteViewMutation.mutate(viewId)
    }
  }

  // Get icon for view type
  const getViewTypeIcon = (type: string) => {
    switch (type) {
      case 'personal':
        return <Eye size={14} className="text-blue-500" />
      case 'project':
        return <Users size={14} className="text-green-500" />
      case 'organization':
        return <Building2 size={14} className="text-purple-500" />
      default:
        return <Eye size={14} className="text-gray-500" />
    }
  }

  // Group views by type
  const personalViews = savedViews.filter((v) => v.type === 'personal')
  const projectViews = savedViews.filter((v) => v.type === 'project')
  const orgViews = savedViews.filter((v) => v.type === 'organization')

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 flex items-center gap-2 transition-colors"
        title="Saved Views"
      >
        <FolderOpen size={16} />
        <span className="text-sm">Views</span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Saved Views
                </h3>
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center gap-1 transition-colors"
                >
                  <Plus size={12} />
                  Save Current
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  Loading views...
                </div>
              ) : savedViews.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No saved views yet. Save your current filters to create one.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {/* Personal Views */}
                  {personalViews.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Personal Views
                      </p>
                      {personalViews.map((view) => (
                        <ViewItem
                          key={view.id}
                          view={view}
                          isEditing={editingViewId === view.id}
                          editingName={editingViewName}
                          onEditingNameChange={setEditingViewName}
                          onStartEdit={() => {
                            setEditingViewId(view.id)
                            setEditingViewName(view.name)
                          }}
                          onCancelEdit={() => {
                            setEditingViewId(null)
                            setEditingViewName('')
                          }}
                          onSaveEdit={() => handleRenameView(view.id)}
                          onLoad={() => handleLoadView(view)}
                          onUpdateFilters={() => handleUpdateViewFilters(view.id)}
                          onDelete={() => handleDeleteView(view.id)}
                          getViewTypeIcon={getViewTypeIcon}
                        />
                      ))}
                    </div>
                  )}

                  {/* Project Views */}
                  {projectViews.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Project Views
                      </p>
                      {projectViews.map((view) => (
                        <ViewItem
                          key={view.id}
                          view={view}
                          isEditing={editingViewId === view.id}
                          editingName={editingViewName}
                          onEditingNameChange={setEditingViewName}
                          onStartEdit={() => {
                            setEditingViewId(view.id)
                            setEditingViewName(view.name)
                          }}
                          onCancelEdit={() => {
                            setEditingViewId(null)
                            setEditingViewName('')
                          }}
                          onSaveEdit={() => handleRenameView(view.id)}
                          onLoad={() => handleLoadView(view)}
                          onUpdateFilters={() => handleUpdateViewFilters(view.id)}
                          onDelete={() => handleDeleteView(view.id)}
                          getViewTypeIcon={getViewTypeIcon}
                        />
                      ))}
                    </div>
                  )}

                  {/* Organization Views */}
                  {orgViews.length > 0 && (
                    <div className="p-2">
                      <p className="px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Organization Views
                      </p>
                      {orgViews.map((view) => (
                        <ViewItem
                          key={view.id}
                          view={view}
                          isEditing={editingViewId === view.id}
                          editingName={editingViewName}
                          onEditingNameChange={setEditingViewName}
                          onStartEdit={() => {
                            setEditingViewId(view.id)
                            setEditingViewName(view.name)
                          }}
                          onCancelEdit={() => {
                            setEditingViewId(null)
                            setEditingViewName('')
                          }}
                          onSaveEdit={() => handleRenameView(view.id)}
                          onLoad={() => handleLoadView(view)}
                          onUpdateFilters={() => handleUpdateViewFilters(view.id)}
                          onDelete={() => handleDeleteView(view.id)}
                          getViewTypeIcon={getViewTypeIcon}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Save View Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsSaveModalOpen(false)}
          />
          <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Save Current View
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  View Name
                </label>
                <input
                  type="text"
                  value={newViewName}
                  onChange={(e) => setNewViewName(e.target.value)}
                  placeholder="Enter view name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  View Scope
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="viewType"
                      value="personal"
                      checked={newViewType === 'personal'}
                      onChange={() => setNewViewType('personal')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Eye size={14} className="text-blue-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Personal (only visible to you)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="viewType"
                      value="project"
                      checked={newViewType === 'project'}
                      onChange={() => setNewViewType('project')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Users size={14} className="text-green-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Project (visible to project members)
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="viewType"
                      value="organization"
                      checked={newViewType === 'organization'}
                      onChange={() => setNewViewType('organization')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <Building2 size={14} className="text-purple-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Organization (visible to everyone)
                    </span>
                  </label>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                  Current Filters to Save:
                </p>
                <div className="flex flex-wrap gap-1">
                  {currentFilters.status !== 'all' && (
                    <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                      Status: {currentFilters.status}
                    </span>
                  )}
                  {currentFilters.priority !== 'all' && (
                    <span className="px-2 py-0.5 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded text-xs">
                      Priority: {currentFilters.priority}
                    </span>
                  )}
                  {currentFilters.category !== 'all' && (
                    <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                      Category: {currentFilters.category}
                    </span>
                  )}
                  {currentFilters.owner !== 'all' && (
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                      Owner: {currentFilters.owner}
                    </span>
                  )}
                  {currentFilters.source !== 'all' && (
                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded text-xs">
                      Source: {currentFilters.source}
                    </span>
                  )}
                  {currentFilters.searchQuery && (
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs">
                      Search: "{currentFilters.searchQuery}"
                    </span>
                  )}
                  {currentFilters.status === 'all' &&
                    currentFilters.priority === 'all' &&
                    currentFilters.category === 'all' &&
                    currentFilters.owner === 'all' &&
                    currentFilters.source === 'all' &&
                    !currentFilters.searchQuery && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        No filters applied (shows all requirements)
                      </span>
                    )}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveView}
                disabled={createViewMutation.isPending || !newViewName.trim()}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg flex items-center gap-2 transition-colors"
              >
                <Save size={14} />
                {createViewMutation.isPending ? 'Saving...' : 'Save View'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Individual view item component for displaying and managing a single saved view
 */
interface ViewItemProps {
  view: SavedView
  isEditing: boolean
  editingName: string
  onEditingNameChange: (name: string) => void
  onStartEdit: () => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onLoad: () => void
  onUpdateFilters: () => void
  onDelete: () => void
  getViewTypeIcon: (type: string) => JSX.Element
}

function ViewItem({
  view,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onLoad,
  onUpdateFilters,
  onDelete,
  getViewTypeIcon,
}: ViewItemProps) {
  return (
    <div className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/50">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {getViewTypeIcon(view.type)}
        {isEditing ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => onEditingNameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveEdit()
              if (e.key === 'Escape') onCancelEdit()
            }}
            className="flex-1 px-1 py-0.5 text-sm border border-blue-500 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none"
            autoFocus
          />
        ) : (
          <button
            onClick={onLoad}
            className="flex-1 text-left text-sm text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 truncate"
            title={`Load "${view.name}"`}
          >
            {view.name}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isEditing ? (
          <>
            <button
              onClick={onSaveEdit}
              className="p-1 text-green-600 hover:text-green-700 dark:text-green-400"
              title="Save"
            >
              <Check size={14} />
            </button>
            <button
              onClick={onCancelEdit}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Cancel"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onUpdateFilters}
              className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              title="Update with current filters"
            >
              <Save size={14} />
            </button>
            <button
              onClick={onStartEdit}
              className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              title="Rename"
            >
              <Edit2 size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-1 text-red-500 hover:text-red-700 dark:hover:text-red-300"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
