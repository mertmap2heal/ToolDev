import { useState, useEffect, useRef } from 'react'
import { X, Search, Check, Upload, File, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { changeRequestService } from '../../services/changeRequest.service'
import { functionService } from '../../services/function.service'
import { issueService } from '../../services/issue.service'
import { parameterService } from '../../services/parameter.service'
import { requirementService } from '../../services/requirement.service'
import { authService } from '../../services/auth.service'
import { invalidateLinkCaches } from '../../utils/invalidateLinkCaches'
import type { CreateChangeRequestDto, SystemFunction, Issue, Parameter, Requirement } from 'shared/types/engineering.types'

interface CreateChangeRequestModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  sourceType?: 'function' | 'issue' | 'parameter' | 'requirement' | 'test-plan' | 'test-case' | 'test-setup' | 'test-result'
  sourceId?: string
  sourceName?: string
  sourceTitle?: string
  sourceDescription?: string
}

type SourceItem = {
  id: string
  type: 'function' | 'issue' | 'parameter' | 'requirement' | 'test-plan' | 'test-case' | 'test-setup' | 'test-result'
  name: string
  description?: string
  functionId?: string
  requirementId?: string
}

export default function CreateChangeRequestModal({
  isOpen,
  onClose,
  projectId,
  sourceType: initialSourceType,
  sourceId: initialSourceId,
  sourceName: initialSourceName,
  sourceTitle: initialSourceTitle,
  sourceDescription: initialSourceDescription,
}: CreateChangeRequestModalProps) {
  const [formData, setFormData] = useState<CreateChangeRequestDto>({
    title: initialSourceTitle || '',
    description: initialSourceDescription || '',
    sourceType: initialSourceType || 'function',
    sourceId: initialSourceId || '',
    priority: 'medium',
    requestedBy: '',
    risk: undefined,
    effort: undefined,
    justification: '',
    impactedRequirementIds: [],
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [impactedSearchQuery, setImpactedSearchQuery] = useState('')
  const [showImpactedDropdown, setShowImpactedDropdown] = useState(false)
  const sourceDropdownRef = useRef<HTMLDivElement>(null)
  const impactedDropdownRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  // Fetch functions, issues, parameters, and requirements for source selection
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !initialSourceType,
  })

  const { data: issues = [] } = useQuery({
    queryKey: ['issues', projectId],
    queryFn: async () => {
      const response = await issueService.getIssues(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !initialSourceType,
  })

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const response = await parameterService.getParameters(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !initialSourceType,
  })

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  // Fetch current user for Requested By
  const { data: userData } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => authService.getCurrentUser(),
    enabled: isOpen,
  })

  useEffect(() => {
    if (userData?.success && userData?.data && !formData.requestedBy) {
      setFormData(prev => ({ ...prev, requestedBy: userData.data!.name }))
    }
  }, [userData, isOpen])

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
    ...requirements.map((req) => ({
      id: req.id,
      type: 'requirement' as const,
      name: req.title,
      description: req.description,
      requirementId: req.requirementId,
    })),
  ]

  // Filter sources based on search
  const filteredSources = allSources.filter((source) => {
    const searchLower = sourceSearchQuery.toLowerCase()
    const name = source.name || ''
    const description = source.description || ''
    const functionId = source.functionId || ''
    const requirementId = source.requirementId || ''
    const typeLabel = source.type

    return (
      name.toLowerCase().includes(searchLower) ||
      description?.toLowerCase().includes(searchLower) ||
      functionId.toLowerCase().includes(searchLower) ||
      requirementId.toLowerCase().includes(searchLower) ||
      typeLabel.includes(searchLower)
    )
  })

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (sourceDropdownRef.current && !sourceDropdownRef.current.contains(target)) {
        setShowSourceDropdown(false)
      }
      if (impactedDropdownRef.current && !impactedDropdownRef.current.contains(target)) {
        setShowImpactedDropdown(false)
      }
    }

    if (showSourceDropdown || showImpactedDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSourceDropdown, showImpactedDropdown])

  useEffect(() => {
    if (isOpen) {
      if (initialSourceType && initialSourceId && (initialSourceName || initialSourceTitle)) {
        setSelectedSource({
          id: initialSourceId,
          type: initialSourceType,
          name: initialSourceName || initialSourceTitle || '',
          requirementId: initialSourceType === 'requirement' ? initialSourceId : undefined,
        })
        setFormData(prev => ({
          ...prev,
          title: initialSourceTitle || '',
          description: initialSourceDescription || '',
          sourceType: initialSourceType,
          sourceId: initialSourceId,
          priority: 'medium',
          risk: undefined,
          effort: undefined,
          justification: '',
        }))
      } else {
        setSelectedSource(null)
        setFormData(prev => ({
          ...prev,
          title: '',
          description: '',
          sourceType: 'function',
          sourceId: '',
          priority: 'medium',
          risk: undefined,
          effort: undefined,
          justification: '',
        }))
      }
      setErrors({})
      setSourceSearchQuery('')
      setShowSourceDropdown(false)
      setSelectedFiles([])
      setUploadingFiles(false)
      setImpactedSearchQuery('')
      setShowImpactedDropdown(false)
      setFormData((prev) => ({ ...prev, impactedRequirementIds: [] }))
    }
  }, [isOpen, initialSourceType, initialSourceId, initialSourceName, initialSourceTitle, initialSourceDescription])

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
    onSuccess: async (response) => {
      if (response.success && response.data && selectedFiles.length > 0) {
        // Upload files after change request is created
        setUploadingFiles(true)
        try {
          await Promise.all(
            selectedFiles.map((file) =>
              changeRequestService.uploadAttachment(projectId, response.data!.id, file)
            )
          )
        } catch (error) {
          console.error('Error uploading files:', error)
          // Don't fail the whole operation if file upload fails
        } finally {
          setUploadingFiles(false)
        }
      }
      queryClient.invalidateQueries({ queryKey: ['change-requests', projectId] })
      invalidateLinkCaches(queryClient, projectId)

      const sourceType = response.data?.sourceType ?? initialSourceType
      const sourceId = response.data?.sourceId ?? initialSourceId
      if (sourceType === 'requirement' && sourceId) {
        queryClient.invalidateQueries({ queryKey: ['requirement', projectId, sourceId] })
      }

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

    // Clean up optional fields - convert empty strings to undefined
    const submitData: CreateChangeRequestDto = {
      ...formData,
      requestedBy: formData.requestedBy?.trim() || undefined,
      risk: formData.risk || undefined,
      effort: formData.effort || undefined,
      justification: formData.justification?.trim() || undefined,
      impactedRequirementIds:
        (formData.impactedRequirementIds?.length ?? 0) > 0 ? formData.impactedRequirementIds : undefined,
    }

    createChangeRequestMutation.mutate(submitData)
  }

  const handleImpactedToggle = (req: Requirement) => {
    const ids = formData.impactedRequirementIds ?? []
    const next = ids.includes(req.id) ? ids.filter((id) => id !== req.id) : [...ids, req.id]
    setFormData((prev) => ({ ...prev, impactedRequirementIds: next }))
  }

  const handleChange = (field: keyof CreateChangeRequestDto, value: string | string[] | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles((prev) => [...prev, ...files])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
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

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Change Request Details Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
              Change Request Details
            </h3>

            {/* Change Request ID (Auto-assigned) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Change Request ID
              </label>
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-500 dark:text-gray-400 font-mono italic">
                (Auto-assigned on save)
              </div>
            </div>

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
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${selectedSource.type === 'function'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          : selectedSource.type === 'issue'
                            ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                            : selectedSource.type === 'requirement'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
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
                      placeholder="Search functions, issues, parameters, or requirements..."
                      value={sourceSearchQuery}
                      onChange={(e) => {
                        setSourceSearchQuery(e.target.value)
                        setShowSourceDropdown(true)
                      }}
                      onFocus={() => setShowSourceDropdown(true)}
                      className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.sourceId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
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
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${source.type === 'function'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                                : source.type === 'issue'
                                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                                  : source.type === 'requirement'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                                    : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                                }`}
                            >
                              {source.type.charAt(0).toUpperCase() + source.type.slice(1)}
                            </span>
                            <span className="flex-1">
                              <span className="font-medium">{source.name}</span>
                              {(source.requirementId || source.functionId) && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 font-mono">
                                  {source.requirementId || source.functionId}
                                </span>
                              )}
                              {source.description && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 truncate block">
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

            {/* Impacted Requirements (impact analysis) */}
            <div ref={impactedDropdownRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Impacted Requirements
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Select additional requirements that will be impacted by this change (optional)
              </p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search requirements..."
                  value={impactedSearchQuery}
                  onChange={(e) => {
                    setImpactedSearchQuery(e.target.value)
                    setShowImpactedDropdown(true)
                  }}
                  onFocus={() => setShowImpactedDropdown(true)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              {showImpactedDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {requirements
                    .filter((r) => {
                      const q = impactedSearchQuery.toLowerCase()
                      return (
                        !q ||
                        r.title?.toLowerCase().includes(q) ||
                        r.requirementId?.toLowerCase().includes(q) ||
                        r.description?.toLowerCase().includes(q)
                      )
                    })
                    .filter((r) => r.id !== formData.sourceId)
                    .map((req) => {
                      const isSelected = formData.impactedRequirementIds?.includes(req.id) ?? false
                      return (
                        <button
                          key={req.id}
                          type="button"
                          onClick={() => handleImpactedToggle(req)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <div
                            className={`w-5 h-5 border-2 rounded flex items-center justify-center flex-shrink-0 ${
                              isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-600'
                            }`}
                          >
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-900 dark:text-white truncate block">
                              {req.requirementId || req.id.slice(0, 8)}: {req.title}
                            </span>
                            {req.description && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                                {req.description}
                              </span>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  {requirements.filter((r) => r.id !== formData.sourceId).length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No other requirements available
                    </div>
                  )}
                </div>
              )}
              {((formData.impactedRequirementIds?.length ?? 0) > 0) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {requirements
                    .filter((r) => formData.impactedRequirementIds?.includes(r.id))
                    .map((req) => (
                      <span
                        key={req.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                      >
                        {req.requirementId || req.id.slice(0, 8)}: {req.title}
                        <button
                          type="button"
                          onClick={() => handleImpactedToggle(req)}
                          className="hover:opacity-70"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${errors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                placeholder="Brief summary of the change request"
              />
              {errors.title && <p className="mt-1 text-sm text-red-500">{errors.title}</p>}
            </div>
          </div>

          {/* Change Description Section */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Change Description
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                What Change is Requested <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={5}
                className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none ${errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                placeholder="Describe in detail what change is being requested and why it is needed. Include current state, proposed change, reason for change, and relevant context."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Clearly explain what needs to change and the reason for this change request. Describe both the current state and the proposed change.
              </p>
              {errors.description && <p className="mt-1 text-sm text-red-500">{errors.description}</p>}
            </div>
          </div>

          {/* Business Justification Section */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Business Justification
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Business Justification / Rationale
              </label>
              <textarea
                value={formData.justification || ''}
                onChange={(e) => handleChange('justification', e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                placeholder="Provide additional business justification, impact analysis, and rationale. Include business value, benefits, stakeholder impact, cost-benefit considerations, and supporting information."
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Explain the business value, benefits, and any additional context for why this change is necessary. This supplements the change description above.
              </p>
            </div>
          </div>

          {/* Assessment & Priority Section */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Assessment & Priority
            </h3>

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

            {/* Risk Assessment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Risk Assessment
              </label>
              <select
                value={formData.risk || ''}
                onChange={(e) => handleChange('risk', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select risk level (optional)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Assess the risk level associated with implementing this change
              </p>
            </div>

            {/* Effort Estimation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Effort Estimation
              </label>
              <select
                value={formData.effort || ''}
                onChange={(e) => handleChange('effort', e.target.value || undefined)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Select effort level (optional)</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Estimate the effort required to implement this change
              </p>
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
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white"
                placeholder="Name of requester"
                readOnly
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Automatically pre-filled with your account name
              </p>
            </div>
          </div>

          {/* Document Attachments Section */}
          <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              Document Attachments
            </h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Attach Documents
              </label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                  accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif"
                />
                <label
                  htmlFor="file-upload"
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  <Upload size={16} />
                  <span className="text-sm">Select Files</span>
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  PDF, DOC, XLS, PPT, Images (max 10MB per file)
                </span>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <File size={16} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {file.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 flex-shrink-0"
                        title="Remove file"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Attach supporting documents, specifications, diagrams, or other relevant files to this change request.
              </p>
            </div>
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
              disabled={createChangeRequestMutation.isPending || uploadingFiles}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploadingFiles ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Uploading files...</span>
                </>
              ) : createChangeRequestMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                'Create Change Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
