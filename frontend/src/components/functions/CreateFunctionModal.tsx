import { useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { functionService } from '../../services/function.service'
import type { CreateSystemFunctionDto } from 'shared/types/engineering.types'

interface CreateFunctionModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function CreateFunctionModal({ isOpen, onClose, projectId }: CreateFunctionModalProps) {
  const [formData, setFormData] = useState<CreateSystemFunctionDto>({
    functionId: '',
    name: '',
    description: '',
    status: 'draft',
    owner: '',
    verificationMethod: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const queryClient = useQueryClient()

  const createFunctionMutation = useMutation({
    mutationFn: (data: CreateSystemFunctionDto) => functionService.createFunction(projectId, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
        onClose()
        setFormData({
          functionId: '',
          name: '',
          description: '',
          status: 'draft',
          owner: '',
          verificationMethod: '',
        })
        setErrors({})
      } else {
        setErrors({ submit: response.error || 'Failed to create function' })
      }
    },
    onError: (error: any) => {
      console.error('Create function error:', error)
      let errorMessage = 'Failed to create function.'
      
      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }
      
      // Check if it's a database schema error
      if (errorMessage.includes('Unknown arg') || errorMessage.includes('status') || errorMessage.includes('owner') || errorMessage.includes('verificationMethod')) {
        errorMessage = 'Database schema needs to be updated. Please run: npx prisma db push in the backend directory.'
      }
      
      setErrors({ submit: errorMessage })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!formData.functionId?.trim()) {
      newErrors.functionId = 'Function ID is required'
    }
    if (!formData.name.trim()) {
      newErrors.name = 'Function name is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData: CreateSystemFunctionDto = {
      functionId: formData.functionId?.trim().toUpperCase() || '',
      name: formData.name.trim(),
      description: formData.description?.trim() || '',
      status: formData.status || 'draft',
      owner: formData.owner?.trim() || '',
      verificationMethod: formData.verificationMethod?.trim() || '',
    }

    createFunctionMutation.mutate(submitData)
  }

  const handleChange = (field: keyof CreateSystemFunctionDto, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Function
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Function ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Function ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.functionId || ''}
              onChange={(e) => handleChange('functionId', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.functionId
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="e.g., FUNC-01"
            />
            {errors.functionId && (
              <p className="mt-1 text-sm text-red-500">{errors.functionId}</p>
            )}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              Enter a unique Function ID (e.g., FUNC-01, FUNC-02)
            </p>
          </div>

          {/* Function Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Function Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="Enter function name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Description
            </label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter function description. Use @parameterName@ to reference parameters."
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              Tip: Use @parameterName@ to reference parameters. They will appear as bold, clickable text after creation.
            </p>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Status
            </label>
            <select
              value={formData.status || 'draft'}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="draft">Draft</option>
              <option value="work-in-progress">Work in Progress</option>
              <option value="in-review">In Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          {/* Owner */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Owner
            </label>
            <input
              type="text"
              value={formData.owner || ''}
              onChange={(e) => handleChange('owner', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter owner name"
            />
          </div>

          {/* Verification Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Verification Method
            </label>
            <input
              type="text"
              value={formData.verificationMethod || ''}
              onChange={(e) => handleChange('verificationMethod', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter verification method"
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={createFunctionMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createFunctionMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createFunctionMutation.isPending ? 'Creating...' : 'Create Function'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
