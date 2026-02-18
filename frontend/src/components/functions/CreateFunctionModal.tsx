import { useState } from 'react'
import { X, ChevronRight } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { functionService } from '../../services/function.service'
import type { CreateSystemFunctionDto, SystemFunction, FunctionCriticality } from 'shared/types/engineering.types'

interface CreateFunctionModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  parentId?: string | null
  parentFunction?: SystemFunction | null
  allFunctions?: SystemFunction[]
}

export default function CreateFunctionModal({ isOpen, onClose, projectId, parentId, parentFunction, allFunctions = [] }: CreateFunctionModalProps) {
  const [formData, setFormData] = useState<CreateSystemFunctionDto>({
    functionId: '',
    name: '',
    description: '',
    status: 'draft',
    owner: '',
    verificationMethod: '',
    parentId: parentId || null,
    criticality: 'medium',
    pbsComponentId: null,
    allocatedTo: null,
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
          parentId: null,
          criticality: 'medium',
          pbsComponentId: null,
          allocatedTo: null,
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

      if (errorMessage.includes('Unknown arg') || errorMessage.includes('status') || errorMessage.includes('owner') || errorMessage.includes('verificationMethod')) {
        errorMessage = 'Database schema needs to be updated. Please run: npx prisma db push in the backend directory.'
      }

      setErrors({ submit: errorMessage })
    },
  })

  // When parentId prop changes, update formData
  useState(() => {
    if (parentId !== undefined) {
      setFormData(prev => ({ ...prev, parentId: parentId || null }))
    }
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
      parentId: parentId || formData.parentId || null,
      criticality: formData.criticality || 'medium',
      pbsComponentId: formData.pbsComponentId || null,
      allocatedTo: formData.allocatedTo || null,
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

  // Build parent breadcrumb
  const getParentBreadcrumb = (): SystemFunction[] => {
    if (!parentFunction) return []
    const path: SystemFunction[] = []
    let current: SystemFunction | undefined = parentFunction
    while (current) {
      path.unshift(current)
      current = current.parentId ? allFunctions.find(f => f.id === current!.parentId) : undefined
    }
    return path
  }
  const parentBreadcrumb = getParentBreadcrumb()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {parentId ? 'Create Sub-Function' : 'Create New Function'}
            </h2>
            {parentBreadcrumb.length > 0 && (
              <div className="flex items-center gap-1 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                <span>Under:</span>
                {parentBreadcrumb.map((item, idx) => (
                  <span key={item.id} className="flex items-center gap-1">
                    {idx > 0 && <ChevronRight size={10} className="text-gray-300 dark:text-gray-600" />}
                    <span className="font-medium">{item.functionId || item.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1: Function ID + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">
                Function ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.functionId || ''}
                onChange={(e) => handleChange('functionId', e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.functionId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm`}
                placeholder="e.g., FUNC-01"
              />
              {errors.functionId && <p className="mt-1 text-xs text-red-500">{errors.functionId}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">Status</label>
              <select
                value={formData.status || 'draft'}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="draft">Draft</option>
                <option value="work-in-progress">Work in Progress</option>
                <option value="in-review">In Review</option>
                <option value="done">Done</option>
              </select>
            </div>
          </div>

          {/* Function Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">
              Function Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm`}
              placeholder="Enter function name"
            />
            {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">Description</label>
            <textarea
              value={formData.description || ''}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-sm"
              placeholder="Describe the function's purpose. Use @parameterName@ to reference parameters."
            />
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 text-left">
              Tip: Use @parameterName@ to reference parameters. They will appear as bold, clickable text after creation.
            </p>
          </div>

          {/* Row 2: Criticality + Verification Method */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">Criticality</label>
              <select
                value={(formData.criticality as string) || 'medium'}
                onChange={(e) => handleChange('criticality', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">Verification Method</label>
              <select
                value={formData.verificationMethod || ''}
                onChange={(e) => handleChange('verificationMethod', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">Select method</option>
                <option value="Test">Test</option>
                <option value="Analysis">Analysis</option>
                <option value="Inspection">Inspection</option>
                <option value="Demonstration">Demonstration</option>
                <option value="Review">Review</option>
                <option value="Simulation">Simulation</option>
              </select>
            </div>
          </div>

          {/* Row 3: Owner + Allocated To */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">Owner</label>
              <input
                type="text"
                value={formData.owner || ''}
                onChange={(e) => handleChange('owner', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="Enter owner name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">Allocated To</label>
              <input
                type="text"
                value={(formData.allocatedTo as string) || ''}
                onChange={(e) => handleChange('allocatedTo', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                placeholder="e.g., Subsystem, Team"
              />
            </div>
          </div>

          {/* PBS Component */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">PBS Component</label>
            <input
              type="text"
              value={(formData.pbsComponentId as string) || ''}
              onChange={(e) => handleChange('pbsComponentId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="Link to PBS component ID"
            />
          </div>

          {/* Parent (read-only if predefined) */}
          {!parentId && allFunctions.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 text-left">
                Parent Function <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>
              <select
                value={(formData.parentId as string) || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, parentId: e.target.value || null }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="">No parent (root function)</option>
                {allFunctions.map(f => (
                  <option key={f.id} value={f.id}>
                    {'  '.repeat(f.level ?? 0)}{f.functionId || f.name} — {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Error Message */}
          {errors.submit && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors text-sm"
              disabled={createFunctionMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createFunctionMutation.isPending}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {createFunctionMutation.isPending ? 'Creating...' : parentId ? 'Create Sub-Function' : 'Create Function'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
