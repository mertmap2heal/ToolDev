import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import type { Parameter, UpdateParameterDto } from '../../../shared/types/engineering.types'

interface EditParameterModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  parameter: Parameter | null
}

export default function EditParameterModal({
  isOpen,
  onClose,
  projectId,
  parameter,
}: EditParameterModalProps) {
  const [formData, setFormData] = useState<UpdateParameterDto>({
    description: '',
    dataType: '',
    defaultValue: '',
    unit: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()

  useEffect(() => {
    if (parameter) {
      setFormData({
        description: parameter.description || '',
        dataType: parameter.dataType || '',
        defaultValue: parameter.defaultValue || '',
        unit: parameter.unit || '',
      })
      setErrors({})
    }
  }, [parameter])

  const updateParameterMutation = useMutation({
    mutationFn: (data: UpdateParameterDto) => {
      if (!parameter) throw new Error('Parameter not found')
      return parameterService.updateParameter(projectId, parameter.id, data)
    },
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
        onClose()
        setErrors({})
      } else {
        setErrors({ submit: response.error || 'Failed to update parameter' })
      }
    },
    onError: (error: any) => {
      console.error('Update parameter error:', error)
      let errorMessage = 'Failed to update parameter.'

      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }

      setErrors({ submit: errorMessage })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const submitData: UpdateParameterDto = {
      description: formData.description?.trim() || '',
      dataType: formData.dataType?.trim() || '',
      defaultValue: formData.defaultValue?.trim() || '',
      unit: formData.unit?.trim() || '',
    }

    updateParameterMutation.mutate(submitData)
  }

  const handleChange = (field: keyof UpdateParameterDto, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  if (!isOpen || !parameter) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Edit Parameter: @{parameter.name}@
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
          {/* Parameter Name (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Parameter Name
            </label>
            <input
              type="text"
              value={`@${parameter.name}@`}
              disabled
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              Parameter name cannot be changed (extracted from function description)
            </p>
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
              placeholder="Enter parameter description"
            />
          </div>

          {/* Data Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Data Type
            </label>
            <input
              type="text"
              value={formData.dataType || ''}
              onChange={(e) => handleChange('dataType', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., float, int, string, boolean"
            />
          </div>

          {/* Value */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Value
            </label>
            <input
              type="text"
              value={formData.defaultValue || ''}
              onChange={(e) => handleChange('defaultValue', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter value"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Unit
            </label>
            <input
              type="text"
              value={formData.unit || ''}
              onChange={(e) => handleChange('unit', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., °C, Pa, m/s, kg"
            />
          </div>

          {/* Source Function (read-only info) */}
          {parameter.sourceFunction && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
                Source Function
              </label>
              <input
                type="text"
                value={`${parameter.sourceFunction.functionId || 'N/A'}: ${parameter.sourceFunction.name}`}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
                This parameter was extracted from the function description
              </p>
            </div>
          )}

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
              disabled={updateParameterMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateParameterMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateParameterMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
