import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FolderTree, Loader2, Box, Save } from 'lucide-react'
import { useComponentContext } from '../../components/layout/projectComponentContext'
import { componentService } from '../../services/component.service'
import type { Component } from 'shared/types/project.types'

/**
 * Main content for Product Breakdown Structure.
 * Shows empty state when no component selected, or detail panel with edit when selected.
 */
export default function PBSMainPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const { componentId } = useComponentContext()
  const queryClient = useQueryClient()
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const { data: componentRes, isLoading, error } = useQuery({
    queryKey: ['component', projectId, componentId],
    queryFn: () => componentService.getComponent(projectId!, componentId!),
    enabled: !!projectId && !!componentId,
  })

  const component: Component | undefined = componentRes?.data

  const updateMutation = useMutation({
    mutationFn: (payload: { name?: string; description?: string | null }) =>
      componentService.updateComponent(projectId!, componentId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['component', projectId, componentId] })
      queryClient.invalidateQueries({ queryKey: ['component-tree', projectId] })
      setIsEditing(false)
    },
  })

  const handleStartEdit = () => {
    if (component) {
      setEditName(component.name)
      setEditDescription(component.description ?? '')
      setIsEditing(true)
    }
  }

  const handleSave = () => {
    updateMutation.mutate({
      name: editName.trim() || undefined,
      description: editDescription.trim() || undefined,
    })
  }

  if (!componentId) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[300px] text-center">
        <FolderTree size={48} className="text-gray-400 dark:text-gray-500 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Product Breakdown Structure
        </h3>
        <p className="text-gray-600 dark:text-gray-400 max-w-md">
          Select a component in the tree to view or edit its details, or use the sidebar to add new
          components and build your product structure.
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[200px]">
        <Loader2 size={32} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !component) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">
          Failed to load component. It may have been deleted.
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <Box size={20} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Component details
          </h2>
        </div>
        <div className="p-4 space-y-4">
          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  <Save size={14} />
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Name
                </span>
                <p className="mt-0.5 text-gray-900 dark:text-white font-medium">{component.name}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Description
                </span>
                <p className="mt-0.5 text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {component.description || '—'}
                </p>
              </div>
              <button
                onClick={handleStartEdit}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Edit
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
