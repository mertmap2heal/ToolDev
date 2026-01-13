import { useState, useEffect, useRef } from 'react'
import { X, Search, Check } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changeRequestService } from '../../services/changeRequest.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { parameterService } from '../../services/parameter.service'
import type { CreateChangeRequestDto, SystemFunction, Issue, Parameter } from '../../../shared/types/engineering.types'

interface CreateChangeRequestModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  sourceType?: 'function' | 'issue' | 'parameter'
  sourceId?: string
  sourceName?: string
}

type SourceItem = {
  id: string
  type: 'function' | 'issue' | 'parameter'
  name: string
  description?: string
  functionId?: string
}

export default function CreateChangeRequestModal({
  isOpen,
  onClose,
  projectId,
  sourceType: initialSourceType,
  sourceId: initialSourceId,
  sourceName: initialSourceName,
}: CreateChangeRequestModalProps) {
  const [formData, setFormData] = useState<CreateChangeRequestDto>({
    title: '',
    description: '',
    sourceType: initialSourceType || 'function',
    sourceId: initialSourceId || '',
    priority: 'medium',
    requestedBy: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sourceSearchQuery, setSourceSearchQuery] = useState('')
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)
  const [selectedSource, setSelectedSource] = useState<SourceItem | null>(
    initialSourceType && initialSourceId && initialSourceName
      ? {
          id: initialSourceId,
          type: initialSourceType,
          name: initialSourceName,
        }
      : null
  )
  const sourceDropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch functions, issues, and parameters for source selection
  const { data: functionsData } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: () => functionService.getFunctions(projectId),
    enabled: isOpen && !initialSourceType,
  })

  const { data: issuesData } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: () => issueService.getIssues(projectId),
    enabled: isOpen && !initialSourceType,
  })

  const { data: parametersData } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: () => parameterService.getParameters(projectId),
    enabled: isOpen && !initialSourceType,
  })

  const functions = functionsData?.success ? functionsData.data || [] : []
  const issues = issuesData?.success ? issuesData.data || [] : []
  const parameters = parametersData?.success ? parametersData.data || [] : []

  // Combine all sources into a unified list
  const allSources: SourceItem[] = [
    ...functions.map((func) => ({
      id: func.id,
      type: 'function' as const,
      name: func.name,
      description: func.description,
      functionId: func.functionId,
    })),
    ...issues.map((issue) => ({
      id: issue.id,
      type: 'issue' as const,
      name: issue.title,
      description: issue.description,
    })),
    ...parameters.map((param) => ({
      id: param.id,
      type: 'parameter' as const,
      name: param.name,
      description: param.description,
    })),
  ]

  // Filter sources based on search
  const filteredSources = allSources.filter((source) => {
    const searchLower = sourceSearchQuery.toLowerCase()
    const name = source.name || ''
    const description = source.description || ''
    const functionId = source.functionId || ''
    const typeLabel = source.type

    return (
      name.toLowerCase().includes(searchLower) ||
      description?.toLowerCase().includes(searchLower) ||
      functionId.toLowerCase().includes(searchLower) ||
      typeLabel.includes(searchLower)
    )
  })

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(event.target as Node)) {
        setShowSourceDropdown(false)
      }
    }

    if (showSourceDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSourceDropdown])

  useEffect(() => {
    if (isOpen) {
      if (initialSourceType && initialSourceId && initialSourceName) {
        setSelectedSource({
          id: initialSourceId,
          type: initialSourceType,
          name: initialSourceName,
        })
        setFormData({
          title: '',
          description: '',
          sourceType: initialSourceType,
          sourceId: initialSourceId,
          priority: 'medium',
          requestedBy: '',
        })
      } else {
        setSelectedSource(null)
        setFormData({
          title: '',
          description: '',
          sourceType: 'function',
          sourceId: '',
          priority: 'medium',
          requestedBy: '',
        })
      }
      setErrors({})
      setSourceSearchQuery('')
      setShowSourceDropdown(false)
    }
  }, [isOpen, initialSourceType, initialSourceId, initialSourceName])

  const handleSourceSelect = (source: SourceItem) => {
    setSelectedSource(source)
    setFormData((prev) => ({
      ...prev,
      sourceType: source.type,
      sourceId: source.id,
    }))
    setShowSourceDropdown(false)
    setSourceSearchQuery('')
    if (errors.sourceId) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors.sourceId
        return newErrors
      })
    }
  }

  const createChangeRequestMutation = useMutation({
    mutationFn: (data: CreateChangeRequestDto) => changeRequestService.createChangeRequest(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests', projectId] })
      onClose()
    },
    onError: (error: any) => {
      console.error('Create change request error:', error)
      setErrors({ submit: error?.error || error?.message || 'Failed to create change request' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: Record<string, string> = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (!formData.sourceId || !selectedSource) {
      newErrors.sourceId = 'Please select a source item'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    createChangeRequestMutation.mutate(formData)
  }

  const handleChange = (field: keyof CreateChangeRequestDto, value: string) => {
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
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Create Change Request</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Source Selection */}
          {initialSourceType && initialSourceId ? (
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Source
              </label>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium capitalize">{initialSourceType}:</span> {initialSourceName || initialSourceId}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Link Source <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={sourceDropdownRef}>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedSource && (
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                        selectedSource.type === 'function'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          : selectedSource.type === 'issue'
                          ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                          : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                      }`}
                    >
                      {selectedSource.type.charAt(0).toUpperCase() + selectedSource.type.slice(1)}: {selectedSource.name}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSource(null)
                          setFormData((prev) => ({ ...prev, sourceId: '', sourceType: 'function' }))
                        }}
                        className="ml-1 hover:opacity-70"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search functions, issues, or parameters..."
                    value={sourceSearchQuery}
                    onChange={(e) => {
                      setSourceSearchQuery(e.target.value)
                      setShowSourceDropdown(true)
                    }}
                    onFocus={() => setShowSourceDropdown(true)}
                    className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.sourceId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {showSourceDropdown && filteredSources.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSources.map((source) => (
                        <button
                          key={`${source.type}-${source.id}`}
                          type="button"
                          onClick={() => handleSourceSelect(source)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              source.type === 'function'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                : source.type === 'issue'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                            }`}
                          >
                            {source.type.charAt(0).toUpperCase() + source.type.slice(1)}
                          </span>
                          <span className="flex-1">
                            <span className="font-medium">{source.name}</span>
                            {source.description && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 truncate">
                                {source.description}
                              </span>
                            )}
                          </span>
                          {selectedSource?.id === source.id && selectedSource?.type === source.type && (
                            <Check size={16} className="text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {errors.sourceId && <p className="mt-1 text-sm text-red-500">{errors.sourceId}</p>}
              </div>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Enter change request title"
            />
            {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none ${
                errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
              }`}
              placeholder="Describe the change request in detail..."
            />
            {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Requested By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Requested By
            </label>
            <input
              type="text"
              value={formData.requestedBy || ''}
              onChange={(e) => handleChange('requestedBy', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter requester name (optional)"
            />
          </div>

          {/* Error Message */}
          {errors.submit && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={createChangeRequestMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createChangeRequestMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createChangeRequestMutation.isPending ? 'Creating...' : 'Create Change Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
