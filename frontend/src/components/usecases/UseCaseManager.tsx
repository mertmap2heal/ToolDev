import { useState } from 'react'
import { X, Plus, Edit2, Trash2, FileText } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useCaseService } from '../../services/usecase.service'
import type { UseCase, Actor } from '../../../../shared/types/usecase.types'

interface UseCaseManagerProps {
  projectId: string
  onClose: () => void
}

export default function UseCaseManager({ projectId, onClose }: UseCaseManagerProps) {
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const queryClient = useQueryClient()

  const { data: useCases = [], isLoading } = useQuery({
    queryKey: ['usecases', projectId],
    queryFn: async () => {
      const response = await useCaseService.getUseCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: actors = [] } = useQuery({
    queryKey: ['actors', projectId],
    queryFn: async () => {
      const response = await useCaseService.getActors(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const deleteMutation = useMutation({
    mutationFn: (useCaseId: string) => useCaseService.deleteUseCase(projectId, useCaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usecases', projectId] })
    },
  })

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90vw] h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Use Case Management</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">UML Use Case Modeling</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
            >
              <Plus size={16} />
              Create Use Case
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="text-center py-8">Loading use cases...</div>
          ) : useCases.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No use cases found. Create your first use case to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {useCases.map((useCase) => (
                <div
                  key={useCase.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-mono text-sm text-gray-500 dark:text-gray-400">
                        {useCase.useCaseId || useCase.id.substring(0, 8)}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{useCase.name}</h3>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedUseCase(useCase)}
                        className="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"
                      >
                        <FileText size={16} />
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(useCase.id)}
                        className="p-1 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                  {useCase.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {useCase.description}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    {useCase.priority && <span>Priority: {useCase.priority}</span>}
                    {useCase.status && <span>Status: {useCase.status}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
