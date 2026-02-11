import { useState } from 'react'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import { FileText, Plus } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'

export default function TaskTemplatesPage() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const queryClient = useQueryClient()

  interface TaskTemplate {
    id: string
    name?: string
    description?: string
  }
  const { data: templates, isLoading } = useQuery<TaskTemplate[]>({
    queryKey: ['task-templates'],
    queryFn: async () => {
      const response = await apiClient.get<TaskTemplate[] | unknown>('/task-templates')
      const data = response.data
      return Array.isArray(data) ? data : []
    },
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/task-templates/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-templates'] })
    },
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <FileText size={24} className="text-gray-900 dark:text-white" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Task Templates</h1>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Create reusable task templates
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <Plus size={20} />
            Create Template
          </button>
        </div>

        {isLoading ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
              <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(templates ?? []).map((template) => (
              <div
                key={template.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">{template.description}</p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={() => {
                      // TODO: Implement create task from template
                    }}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Use Template
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(template.id)}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
