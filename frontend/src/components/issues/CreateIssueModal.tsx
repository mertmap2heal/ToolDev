import { useState, useEffect, useRef } from 'react'
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges'
import { X, Search, Check, Upload, File, Trash2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { issueService } from '../../services/issue.service'
import { functionService } from '../../services/function.service'
import { parameterService } from '../../services/parameter.service'
import { requirementService } from '../../services/requirement.service'
import { authService } from '../../services/auth.service'
import { useAuthStore } from '../../store/authStore'
import { invalidateLinkCaches } from '../../utils/invalidateLinkCaches'
import type { CreateIssueDto, IssueType, SystemFunction, Parameter } from 'shared/types/engineering.types'

interface CreateIssueModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  initialSourceType?: 'function' | 'parameter' | 'requirement'
  initialSourceId?: string
  initialSourceName?: string
  initialSourceTitle?: string
  initialSourceDescription?: string
}

type SourceItem = {
  id: string
  type: 'function' | 'parameter' | 'requirement'
  name: string
  description?: string
  functionId?: string
  requirementId?: string
  index?: number
}

export default function CreateIssueModal({
  isOpen,
  onClose,
  projectId,
  initialSourceType,
  initialSourceId,
  initialSourceName,
  initialSourceTitle,
  initialSourceDescription,
}: CreateIssueModalProps) {
  const onDiscardRef = useRef<() => void>()
  const { markDirty, resetDirty, guardClose, warningDialog, draftBanner } = useUnsavedChanges(onClose, isOpen, () => onDiscardRef.current?.())
  const [formDataBase, setFormDataBase] = useState<CreateIssueDto>({
    title: initialSourceTitle || '',
    description: initialSourceDescription || '',
    priority: 'medium',
    owner: '',
    assigneeId: undefined,
    relatedFunctionIds: initialSourceType === 'function' && initialSourceId ? [initialSourceId] : [],
    relatedParameterIds: initialSourceType === 'parameter' && initialSourceId ? [initialSourceId] : [],
  })
  const setFormData = (v: CreateIssueDto | ((prev: CreateIssueDto) => CreateIssueDto)) => { setFormDataBase(v as any); markDirty() }
  const formData = formDataBase
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [sourceSearchQuery, setSourceSearchQuery] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showSourceDropdown, setShowSourceDropdown] = useState(false)

  onDiscardRef.current = () => {
    setFormDataBase({
      title: initialSourceTitle || '',
      description: initialSourceDescription || '',
      priority: 'medium',
      owner: '',
      assigneeId: undefined,
      relatedFunctionIds: initialSourceType === 'function' && initialSourceId ? [initialSourceId] : [],
      relatedParameterIds: initialSourceType === 'parameter' && initialSourceId ? [initialSourceId] : [],
    })
    setErrors({})
    setSelectedFiles([])
    setSourceSearchQuery('')
  }

  const queryClient = useQueryClient()
  const { user } = useAuthStore()

  // Fetch functions
  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  // Fetch parameters
  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters', projectId],
    queryFn: async () => {
      const response = await parameterService.getParameters(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  // Fetch requirements
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  // Fetch users for assignee picker
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await authService.getUsers()
      return response.success && Array.isArray(response.data) ? response.data : []
    },
    enabled: isOpen,
  })

  // Combine functions and parameters into a unified source list
  const allSources: SourceItem[] = [
    ...functions.map((func, index) => ({
      id: func.id,
      type: 'function' as const,
      name: func.name,
      description: func.description,
      functionId: func.functionId,
      index,
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

  // Get selected source items
  const selectedSources: SourceItem[] = allSources.filter((source) => {
    if (source.type === 'function') {
      return formData.relatedFunctionIds?.includes(source.id)
    } else {
      return formData.relatedParameterIds?.includes(source.id)
    }
  })

  const createIssueMutation = useMutation({
    mutationFn: ({ data, files }: { data: CreateIssueDto; files: File[] }) =>
      issueService.createIssue(projectId, data).then((res) => ({ ...res, _files: files })),
    onSuccess: async (response) => {
      const filesToUpload = (response as { success: boolean; data?: { id: string }; _files?: File[] })._files ?? []
      if (response.success && response.data && filesToUpload.length > 0) {
        setUploadingFiles(true)
        try {
          await Promise.all(
            filesToUpload.map((file) =>
              issueService.uploadAttachment(projectId, response.data!.id, file)
            )
          )
        } catch (error) {
          console.error('Error uploading files:', error)
        } finally {
          setUploadingFiles(false)
        }
      }
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['issues', projectId] })
        queryClient.invalidateQueries({ queryKey: ['requirements', projectId] })
        invalidateLinkCaches(queryClient, projectId)

        if (initialSourceType === 'requirement' && initialSourceId) {
          queryClient.invalidateQueries({ queryKey: ['requirement', projectId, initialSourceId] })
        }

        resetDirty()
        onClose()
        setFormDataBase({
          title: '',
          description: '',
          priority: 'medium',
          owner: '',
          assigneeId: undefined,
          relatedFunctionIds: [],
          relatedParameterIds: [],
        })
        setSelectedFiles([])
        setErrors({})
        setSourceSearchQuery('')
      } else {
        setErrors({ submit: response.error || 'Failed to create issue' })
      }
    },
    onError: (error: any) => {
      console.error('Create issue error:', error)
      let errorMessage = 'Failed to create issue.'

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
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData: CreateIssueDto = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      owner: formData.owner?.trim() || '',
      assigneeId: formData.assigneeId || undefined,
      relatedFunctionIds: formData.relatedFunctionIds || [],
      relatedParameterIds: formData.relatedParameterIds || [],
      sourceRequirementId: initialSourceType === 'requirement' && initialSourceId ? initialSourceId : undefined,
      issueType: formData.issueType,
    }

    createIssueMutation.mutate({ data: submitData, files: selectedFiles })
  }

  const handleChange = (field: keyof CreateIssueDto, value: string | string[] | undefined) => {
    setFormData((prev) => ({ ...prev, [field]: value as any }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const toggleSource = (source: SourceItem) => {
    if (source.type === 'function') {
      const currentIds = formData.relatedFunctionIds || []
      const newIds = currentIds.includes(source.id)
        ? currentIds.filter((id) => id !== source.id)
        : [...currentIds, source.id]
      handleChange('relatedFunctionIds', newIds)
    } else if (source.type === 'parameter') {
      const currentIds = formData.relatedParameterIds || []
      const newIds = currentIds.includes(source.id)
        ? currentIds.filter((id) => id !== source.id)
        : [...currentIds, source.id]
      handleChange('relatedParameterIds', newIds)
    } else if (source.type === 'requirement') {
      // Requirements are currently linked via description or tags until a specialized field is added
      // For now, we can just pre-fill the description if it's the initial source
    }
  }

  const formatFunctionId = (source: SourceItem) => {
    if (source.functionId) {
      return source.functionId
    }
    if (source.index !== undefined) {
      return `FUNC-${String(source.index + 1).padStart(2, '0')}`
    }
    return ''
  }

  const removeSource = (source: SourceItem) => {
    if (source.type === 'function') {
      const newIds = (formData.relatedFunctionIds || []).filter((id) => id !== source.id)
      handleChange('relatedFunctionIds', newIds)
    } else {
      const newIds = (formData.relatedParameterIds || []).filter((id) => id !== source.id)
      handleChange('relatedParameterIds', newIds)
    }
  }

  const isSourceSelected = (source: SourceItem) => {
    if (source.type === 'function') {
      return formData.relatedFunctionIds?.includes(source.id) || false
    } else {
      return formData.relatedParameterIds?.includes(source.id) || false
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setSelectedFiles((prev) => [...prev, ...files])
    if (fileInputRef.current) fileInputRef.current.value = ''
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

  const ISSUE_TYPE_OPTIONS: { value: IssueType; label: string }[] = [
    { value: 'specification_error', label: 'Specification Error' },
    { value: 'design_error', label: 'Design Error' },
    { value: 'coding_error', label: 'Coding Error' },
    { value: 'documentation_error', label: 'Documentation Error' },
    { value: 'interface_error', label: 'Interface Error' },
    { value: 'other', label: 'Other' },
  ]

  // Reset form when modal closes or initial source changes
  useEffect(() => {
    if (isOpen) {
      setFormDataBase({
        title: initialSourceTitle || '',
        description: initialSourceDescription || '',
        priority: 'medium',
        owner: user?.name || '',
        assigneeId: undefined,
        relatedFunctionIds: initialSourceType === 'function' && initialSourceId ? [initialSourceId] : [],
        relatedParameterIds: initialSourceType === 'parameter' && initialSourceId ? [initialSourceId] : [],
      })
      setSelectedFiles([])
      setErrors({})
      setSourceSearchQuery('')
      setShowSourceDropdown(false)
    }
  }, [isOpen, initialSourceId, initialSourceType, initialSourceTitle, initialSourceDescription, user?.name])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.source-dropdown-container')) {
        setShowSourceDropdown(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={(e) => { if (e.target === e.currentTarget) guardClose() }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Issue
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
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="Enter issue title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${errors.description
                ? 'border-red-500'
                : 'border-gray-300 dark:border-gray-600'
                } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="Enter issue description"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          {/* Problem Report Classification */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Classification
            </label>
            <select
              value={formData.issueType || ''}
              onChange={(e) => handleChange('issueType', e.target.value ? (e.target.value as IssueType) : undefined)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select type (optional)</option>
              {ISSUE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Problem report classification (DO-178C style)
            </p>
          </div>

          {/* Link Source - hidden when source is pre-selected (e.g. from requirements actions) */}
          {initialSourceType && initialSourceId ? (
            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Source
              </label>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium capitalize">{initialSourceType.replace(/-/g, ' ')}:</span>{' '}
                {initialSourceName || initialSourceId}
              </div>
            </div>
          ) : (
          <div className="source-dropdown-container">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Link Source
            </label>
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  value={sourceSearchQuery}
                  onChange={(e) => {
                    setSourceSearchQuery(e.target.value)
                    setShowSourceDropdown(true)
                  }}
                  onFocus={() => setShowSourceDropdown(true)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Search functions, parameters, or other sources..."
                />
              </div>
              {showSourceDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredSources.length > 0 ? (
                    filteredSources.map((source) => {
                      const isSelected = isSourceSelected(source)
                      const displayName = source.type === 'function'
                        ? `${formatFunctionId(source)}: ${source.name}`
                        : source.type === 'requirement'
                          ? `${source.requirementId || source.id.slice(0, 8)}: ${source.name}`
                          : source.name

                      return (
                        <button
                          key={`${source.type}-${source.id}`}
                          type="button"
                          onClick={() => toggleSource(source)}
                          className="w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center gap-3"
                        >
                          <div className={`w-5 h-5 border-2 rounded flex items-center justify-center ${isSelected
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-gray-300 dark:border-gray-600'
                            }`}>
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900 dark:text-white">
                                {displayName}
                              </span>
                              <span className={`text-xs px-2 py-0.5 rounded ${source.type === 'function'
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                }`}>
                                {source.type === 'function' ? 'Function' : source.type === 'requirement' ? 'Requirement' : 'Parameter'}
                              </span>
                            </div>
                            {source.description && (
                              <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
                                {source.description}
                              </div>
                            )}
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No sources found
                    </div>
                  )}
                </div>
              )}
            </div>
            {selectedSources.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedSources.map((source) => {
                  const displayName = source.type === 'function'
                    ? `${formatFunctionId(source)}: ${source.name}`
                    : source.type === 'requirement'
                      ? `${source.requirementId || source.id.slice(0, 8)}: ${source.name}`
                      : source.name

                  return (
                    <span
                      key={`${source.type}-${source.id}`}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm ${source.type === 'function'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                        : source.type === 'requirement'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                          : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        }`}
                    >
                      <span className="text-xs font-medium">
                        {source.type === 'function' ? 'F' : source.type === 'requirement' ? 'R' : 'P'}:
                      </span>
                      {displayName}
                      <button
                        type="button"
                        onClick={() => removeSource(source)}
                        className="hover:opacity-70"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  )
                })}
              </div>
            )}
          </div>
          )}

          {/* Attachments */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Attachments
            </label>
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                id="issue-file-upload"
                accept=".pdf,.doc,.docx,.txt,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
              />
              <label
                htmlFor="issue-file-upload"
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors"
              >
                <Upload size={16} />
                <span className="text-sm">Select Files</span>
              </label>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                PDF, DOC, XLS, Images (max 10MB per file)
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
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{file.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
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
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Attach evidence or supporting materials for this issue
            </p>
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Priority
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value as CreateIssueDto['priority'])}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          {/* Owner - auto-assigned to current user */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Owner
            </label>
            <input
              type="text"
              value={formData.owner || ''}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-gray-900 dark:text-white"
              placeholder="Automatically assigned"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Automatically pre-filled with your account name
            </p>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Assignee
            </label>
            <select
              value={formData.assigneeId || ''}
              onChange={(e) => handleChange('assigneeId', e.target.value || undefined)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Unassigned</option>
              {users.map((u: { id: string; name: string; email?: string }) => (
                <option key={u.id} value={u.id}>
                  {u.name || u.email || u.id}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Optional: assign to a team member
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
              disabled={createIssueMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createIssueMutation.isPending || uploadingFiles}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploadingFiles ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Uploading files...</span>
                </>
              ) : createIssueMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                'Create Issue'
              )}
            </button>
          </div>
        </form>
      </div>
      {warningDialog}
    </div>
  )
}
