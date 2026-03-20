import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectService } from '../../services/project.service'
import type { CreateProjectDto } from 'shared/types/project.types'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formData, setFormDataBase] = useState<CreateProjectDto>({
    name: '',
    description: '',
    domain: '',
    companyName: '',
    deadline: '',
  })
  const setFormData = (v: CreateProjectDto | ((prev: CreateProjectDto) => CreateProjectDto)) => { setFormDataBase(v as any); markDirty() }
  const [errors, setErrors] = useState<Record<string, string>>({})

  onDiscardRef.current = () => {
    setFormDataBase({
      name: '',
      description: '',
      domain: '',
      companyName: '',
      deadline: '',
    })
    setErrors({})
  }

  const queryClient = useQueryClient()

  const createProjectMutation = useMutation({
    mutationFn: (data: CreateProjectDto) => projectService.createProject(data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['projects'] })
        resetDirty()
        onClose()
        setFormData({
          name: '',
          description: '',
          domain: '',
          companyName: '',
          deadline: '',
        })
        setErrors({})
      } else {
        setErrors({ submit: response.error || 'Failed to create project' })
      }
    },
    onError: (error: any) => {
      console.error('Create project error:', error)
      let errorMessage = 'Failed to create project.'
      
      if (error?.error) {
        errorMessage = error.error
      } else if (error?.message) {
        errorMessage = error.message
      } else if (error?.response?.data?.error) {
        errorMessage = error.response.data.error
      }
      
      // Check if it's an authentication error
      if (errorMessage.includes('token') || errorMessage.includes('Unauthorized') || errorMessage.includes('401')) {
        errorMessage = 'Authentication required. Please log in first.'
      }
      
      setErrors({ submit: errorMessage })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    const newErrors: Record<string, string> = {}
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required'
    }
    if (!formData.domain.trim()) {
      newErrors.domain = 'Domain is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Prepare data
    const submitData: CreateProjectDto = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      domain: formData.domain.trim(),
      companyName: formData.companyName?.trim() || undefined,
      deadline: formData.deadline || undefined,
    }

    createProjectMutation.mutate(submitData)
  }

  const handleChange = (field: keyof CreateProjectDto, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error for this field when user starts typing
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Project
          </h2>
          <div className="flex items-center gap-2">
            {draftBanner}
            <button
              onClick={guardClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Project Name <span className="text-red-500">*</span>
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
              placeholder="Enter project name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* Domain */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Domain <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.domain}
              onChange={(e) => handleChange('domain', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.domain
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
            >
              <option value="">Select domain</option>
              <option value="aerospace">Aerospace</option>
              <option value="automotive">Automotive</option>
              <option value="medical">Medical Devices</option>
              <option value="industrial">Industrial</option>
              <option value="defense">Defense</option>
              <option value="other">Other</option>
            </select>
            {errors.domain && (
              <p className="mt-1 text-sm text-red-500">{errors.domain}</p>
            )}
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Company Name
            </label>
            <input
              type="text"
              value={formData.companyName || ''}
              onChange={(e) => handleChange('companyName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter company name (optional)"
            />
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
              placeholder="Enter project description (optional)"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Deadline
            </label>
            <div className="relative">
              <input
                type="date"
                value={formData.deadline ? formData.deadline.split('T')[0] : ''}
                onChange={(e) => {
                  const dateValue = e.target.value
                  if (dateValue) {
                    // Convert date to datetime format for backend (set time to end of day)
                    const datetimeValue = `${dateValue}T23:59:59`
                    handleChange('deadline', datetimeValue)
                  } else {
                    handleChange('deadline', '')
                  }
                }}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white cursor-pointer"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              Select a date from the calendar
            </p>
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
              onClick={guardClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createProjectMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
