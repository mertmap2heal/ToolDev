import { useState } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import CustomDropdown from './CustomDropdown'

interface CreateTestPlanModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function CreateTestPlanModal({ isOpen, onClose, projectId }: CreateTestPlanModalProps) {
  const [formData, setFormData] = useState({
    key: '',
    name: '',
    description: '',
    scope: '',
    entryCriteria: '',
    exitCriteria: '',
    phase: '',
    ownerUserId: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const queryClient = useQueryClient()

  const createTestPlanMutation = useMutation({
    mutationFn: (data: any) => verificationService.createTestPlan(projectId, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
        queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
        onClose()
        setFormData({
          key: '',
          name: '',
          description: '',
          scope: '',
          entryCriteria: '',
          exitCriteria: '',
          phase: '',
          ownerUserId: '',
        })
        setErrors({})
      } else {
        setErrors({ submit: response.error || 'Failed to create test plan' })
      }
    },
    onError: (error: any) => {
      console.error('Create test plan error:', error)
      let errorMessage = 'Failed to create test plan.'
      
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

    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData: any = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      scope: formData.scope?.trim() || undefined,
      entryCriteria: formData.entryCriteria?.trim() || undefined,
      exitCriteria: formData.exitCriteria?.trim() || undefined,
      phase: formData.phase || undefined,
      ownerUserId: formData.ownerUserId?.trim() || undefined,
    }

    if (formData.key.trim()) {
      submitData.key = formData.key.trim()
    }

    createTestPlanMutation.mutate(submitData)
  }

  const handleChange = (field: string, value: string) => {
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
            Create New Test Plan
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
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Name <span className="text-red-500">*</span>
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
              placeholder="Enter test plan name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Key
            </label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => handleChange('key', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Auto-generated if left empty"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              Leave empty to auto-generate a unique key
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter test plan description"
            />
          </div>

          {/* Scope */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Scope
            </label>
            <textarea
              value={formData.scope}
              onChange={(e) => handleChange('scope', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter test plan scope"
            />
          </div>

          {/* Entry Criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Entry Criteria
            </label>
            <textarea
              value={formData.entryCriteria}
              onChange={(e) => handleChange('entryCriteria', e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter entry criteria"
            />
          </div>

          {/* Exit Criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Exit Criteria
            </label>
            <textarea
              value={formData.exitCriteria}
              onChange={(e) => handleChange('exitCriteria', e.target.value)}
              rows={2}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter exit criteria"
            />
          </div>

          {/* Phase */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Phase
            </label>
            <CustomDropdown
              value={formData.phase}
              onChange={(value) => handleChange('phase', value)}
              optionType="PHASE"
              projectId={projectId}
              placeholder="Select phase (optional)"
            />
          </div>

          {/* Owner User ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Owner User ID
            </label>
            <input
              type="text"
              value={formData.ownerUserId}
              onChange={(e) => handleChange('ownerUserId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter owner user ID (optional)"
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
              disabled={createTestPlanMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTestPlanMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createTestPlanMutation.isPending ? 'Creating...' : 'Create Test Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
