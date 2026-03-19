import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parameterService } from '../../services/parameter.service'
import { ParameterFormFields, runValueValidation } from './ParameterFormFields'
import { ParameterTypesPanel } from './ParameterTypesPanel'
import { ProjectUnitsPanel } from './ProjectUnitsPanel'
import { parameterTypeService } from '../../services/parameterType.service'
import type { Parameter, UpdateParameterDto } from 'shared/types/engineering.types'

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
  const [showTypesPanel, setShowTypesPanel] = useState(false)
  const [showUnitsPanel, setShowUnitsPanel] = useState(false)
  const [valueError, setValueError] = useState<string | null>(null)

  const { data: types } = useQuery({
    queryKey: ['parameter-types', projectId],
    queryFn: () => parameterTypeService.getTypes(projectId).then(r => r.data ?? []),
    staleTime: 30_000,
    enabled: isOpen,
  })
  const [formData, setFormData] = useState<UpdateParameterDto & { name?: string }>({
    description: '',
    dataType: '',
    defaultValue: '',
    unit: '',
    tolerance: '',
    minValue: '',
    maxValue: '',
    enumValues: '',
    dimensions: '',
    status: 'draft',
    ownerType: undefined,
    tags: undefined,
    formula: '',
    sourceParameterId: null,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const queryClient = useQueryClient()

  const { data: allParameters = [] } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const res = await parameterService.getParameters(projectId)
      return res.success && res.data ? res.data : []
    },
    enabled: isOpen && !!projectId,
  })
  const otherParameters = allParameters.filter((p) => p.id !== parameter?.id)

  useEffect(() => {
    if (parameter) {
      setFormData({
        name: parameter.name,
        description: parameter.description || '',
        dataType: parameter.dataType || '',
        defaultValue: parameter.defaultValue || '',
        unit: parameter.unit || '',
        tolerance: parameter.tolerance || '',
        minValue: parameter.minValue || '',
        maxValue: parameter.maxValue || '',
        enumValues: parameter.enumValues || '',
        dimensions: parameter.dimensions || '',
        status: (parameter.status as UpdateParameterDto['status']) || 'draft',
        ownerType: parameter.ownerType ?? undefined,
        tags: parameter.tags,
        formula: parameter.formula || '',
        sourceParameterId: parameter.sourceParameterId ?? null,
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

    const matchedType = types?.find(t => t.name === formData.dataType)
    const valErr = runValueValidation(
      { defaultValue: formData.defaultValue || '', dataType: formData.dataType || '', enumValues: formData.enumValues || '', dimensions: formData.dimensions || '' },
      matchedType?.valueFormat
    )
    if (valErr) {
      setValueError(valErr)
      setErrors(prev => ({ ...prev, defaultValue: valErr }))
      return
    }
    setValueError(null)

    const submitData: UpdateParameterDto = {
      description: formData.description?.trim() || '',
      dataType: formData.dataType?.trim() || '',
      defaultValue: formData.defaultValue?.trim() || '',
      unit: formData.unit?.trim() || '',
      tolerance: formData.tolerance?.trim() || undefined,
      minValue: formData.minValue?.trim() || undefined,
      maxValue: formData.maxValue?.trim() || undefined,
      enumValues: formData.enumValues?.trim() || undefined,
      dimensions: formData.dimensions?.trim() || undefined,
      status: formData.status,
      ownerType: formData.ownerType,
      tags: formData.tags,
      formula: formData.formula?.trim() || undefined,
      sourceParameterId: formData.sourceParameterId === '' ? undefined : formData.sourceParameterId ?? undefined,
    }
    if (formData.name !== undefined) submitData.name = formData.name.trim()

    updateParameterMutation.mutate(submitData)
  }

  const handleChange = (field: keyof UpdateParameterDto | 'name', value: string | string[] | undefined | null) => {
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
          {/* Parameter Name (editable for centralized library) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Parameter Name
            </label>
            <input
              type="text"
              value={formData.name ?? parameter.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., MAX_CRUISE_SPEED"
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
              placeholder="Enter parameter description"
            />
          </div>

          {/* Type-aware fields */}
          <ParameterFormFields
            projectId={projectId}
            values={{
              dataType: formData.dataType || '',
              defaultValue: formData.defaultValue || '',
              unit: formData.unit || '',
              tolerance: formData.tolerance || '',
              minValue: formData.minValue || '',
              maxValue: formData.maxValue || '',
              enumValues: formData.enumValues || '',
              dimensions: formData.dimensions || '',
            }}
            onChange={(field, value) => handleChange(field as keyof UpdateParameterDto, value)}
            onManageTypes={() => setShowTypesPanel(true)}
            onManageUnits={() => setShowUnitsPanel(true)}
            valueError={valueError}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Status</label>
              <select
                value={formData.status || 'draft'}
                onChange={(e) => handleChange('status', e.target.value as UpdateParameterDto['status'])}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="obsolete">Obsolete</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Owner type</label>
              <select
                value={formData.ownerType || ''}
                onChange={(e) => handleChange('ownerType', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">—</option>
                <option value="component">Component</option>
                <option value="function">Function</option>
                <option value="system">System</option>
                <option value="team">Team</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Tags (comma-separated)</label>
            <input
              type="text"
              value={Array.isArray(formData.tags) ? formData.tags.join(', ') : ''}
              onChange={(e) => handleChange('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., performance, safety"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Derived from (parameter)</label>
            <select
              value={formData.sourceParameterId ?? ''}
              onChange={(e) => handleChange('sourceParameterId', e.target.value || null)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">— None</option>
              {otherParameters.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">Formula (optional)</label>
            <input
              type="text"
              value={formData.formula || ''}
              onChange={(e) => handleChange('formula', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., PARAM_A + PARAM_B"
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

      {/* Type Management slide-in panel */}
      {showTypesPanel && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-60 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Manage Types</h3>
            <button type="button" onClick={() => setShowTypesPanel(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
              <X size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ParameterTypesPanel projectId={projectId} />
          </div>
        </div>
      )}

      {/* Unit Management slide-in panel */}
      {showUnitsPanel && (
        <div className="fixed inset-y-0 right-0 w-80 bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 z-60 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-semibold text-gray-900 dark:text-white">Manage Units</h3>
            <button type="button" onClick={() => setShowUnitsPanel(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors">
              <X size={16} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <ProjectUnitsPanel projectId={projectId} />
          </div>
        </div>
      )}
    </div>
  )
}
