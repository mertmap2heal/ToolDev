import { useState, useRef, useEffect } from 'react'
import { X, Upload, File, Search, Check } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'

interface CreateTestResultModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

const RESULT_STATUSES = [
  { value: 'NOT_RUN', label: 'Not Run' },
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'SKIPPED', label: 'Skipped' },
] as const

export default function CreateTestResultModal({ isOpen, onClose, projectId }: CreateTestResultModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    fileName: '',
    fileData: '',
    mimeType: '',
    resultStatus: 'NOT_RUN' as typeof RESULT_STATUSES[number]['value'],
    executedAt: '',
    executedByName: '',
    testEnvironment: '',
    linkedSetupId: '',
    notes: '',
    linkedTestCaseIds: [] as string[],
    linkedTestPlanId: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  // Search and dropdown state
  const [testCaseSearchQuery, setTestCaseSearchQuery] = useState('')
  const [testPlanSearchQuery, setTestPlanSearchQuery] = useState('')
  const [showTestCaseDropdown, setShowTestCaseDropdown] = useState(false)
  const [showTestPlanDropdown, setShowTestPlanDropdown] = useState(false)
  const testCaseDropdownRef = useRef<HTMLDivElement>(null)
  const testPlanDropdownRef = useRef<HTMLDivElement>(null)

  const queryClient = useQueryClient()

  // Fetch test cases and test plans for linking
  const { data: testCases = [] } = useQuery<Array<{ id: string; key?: string; title?: string }>>({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      const response = await verificationService.getTestCases(projectId)
      return (response.success && response.data ? response.data : []) as Array<{ id: string; key?: string; title?: string }>
    },
    enabled: isOpen,
  })

  const { data: testPlans = [] } = useQuery<Array<{ id: string; key?: string; name?: string }>>({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      const response = await verificationService.getTestPlans(projectId)
      return (response.success && response.data ? response.data : []) as Array<{ id: string; key?: string; name?: string }>
    },
    enabled: isOpen,
  })

  const { data: setups = [] } = useQuery({
    queryKey: ['setups', projectId],
    queryFn: async () => {
      const response = await verificationService.getSetups(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  const createTestResultMutation = useMutation({
    mutationFn: (data: any) => verificationService.createTestResult(projectId, data),
    onSuccess: (response) => {
      if (response.success) {
        queryClient.invalidateQueries({ queryKey: ['test-results', projectId] })
        queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
        onClose()
        resetForm()
      } else {
        setErrors({ submit: response.error || 'Failed to create test result' })
      }
    },
    onError: (error: any) => {
      console.error('Create test result error:', error)
      let errorMessage = 'Failed to create test result.'
      
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

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      fileName: '',
      fileData: '',
      mimeType: '',
      resultStatus: 'NOT_RUN' as typeof RESULT_STATUSES[number]['value'],
      executedAt: '',
      executedByName: '',
      testEnvironment: '',
      linkedSetupId: '',
      notes: '',
      linkedTestCaseIds: [],
      linkedTestPlanId: '',
    })
    setSelectedFile(null)
    setErrors({})
    setTestCaseSearchQuery('')
    setTestPlanSearchQuery('')
    setShowTestCaseDropdown(false)
    setShowTestPlanDropdown(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setSelectedFile(file)
    setFormData((prev) => ({
      ...prev,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
    }))

    // Read file as base64
    const reader = new FileReader()
    reader.onload = (event) => {
      const base64Data = event.target?.result as string
      setFormData((prev) => ({
        ...prev,
        fileData: base64Data,
      }))
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }
    if (!formData.fileName || !formData.fileData) {
      newErrors.file = 'File is required'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    const submitData: any = {
      title: formData.title.trim(),
      description: formData.description?.trim() || undefined,
      fileName: formData.fileName,
      fileData: formData.fileData,
      mimeType: formData.mimeType || undefined,
      resultStatus: formData.resultStatus,
      executedAt: formData.executedAt || undefined,
      executedByName: formData.executedByName?.trim() || undefined,
      testEnvironment: formData.testEnvironment?.trim() || undefined,
      linkedSetupId: formData.linkedSetupId || undefined,
      notes: formData.notes?.trim() || undefined,
      // Only include linking if user selected something
      ...(formData.linkedTestCaseIds.length > 0 && { linkedTestCaseIds: formData.linkedTestCaseIds }),
      ...(formData.linkedTestPlanId && { linkedTestPlanId: formData.linkedTestPlanId }),
    }

    createTestResultMutation.mutate(submitData)
  }

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const toggleTestCase = (testCaseId: string) => {
    setFormData((prev) => {
      const isSelected = prev.linkedTestCaseIds.includes(testCaseId)
      return {
        ...prev,
        linkedTestCaseIds: isSelected
          ? prev.linkedTestCaseIds.filter((id) => id !== testCaseId)
          : [...prev.linkedTestCaseIds, testCaseId],
      }
    })
  }

  // Filter test cases based on search
  const filteredTestCases = testCases.filter((testCase: any) => {
    if (!testCaseSearchQuery.trim()) return true
    const query = testCaseSearchQuery.toLowerCase()
    return (
      testCase.key?.toLowerCase().includes(query) ||
      testCase.title?.toLowerCase().includes(query)
    )
  })

  // Filter test plans based on search
  const filteredTestPlans = testPlans.filter((plan: any) => {
    if (!testPlanSearchQuery.trim()) return true
    const query = testPlanSearchQuery.toLowerCase()
    return (
      plan.key?.toLowerCase().includes(query) ||
      plan.name?.toLowerCase().includes(query)
    )
  })

  // Get selected test cases for display
  const selectedTestCases = testCases.filter((tc) =>
    formData.linkedTestCaseIds.includes(tc.id)
  )

  // Get selected test plan for display
  const selectedTestPlan = testPlans.find((plan) => plan.id === formData.linkedTestPlanId)

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        testCaseDropdownRef.current &&
        !testCaseDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTestCaseDropdown(false)
      }
      if (
        testPlanDropdownRef.current &&
        !testPlanDropdownRef.current.contains(event.target as Node)
      ) {
        setShowTestPlanDropdown(false)
      }
    }

    if (showTestCaseDropdown || showTestPlanDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showTestCaseDropdown, showTestPlanDropdown])

  // Reset search queries when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTestCaseSearchQuery('')
      setTestPlanSearchQuery('')
      setShowTestCaseDropdown(false)
      setShowTestPlanDropdown(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create New Test Result
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
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.title
                  ? 'border-red-500'
                  : 'border-gray-300 dark:border-gray-600'
              } bg-white dark:bg-gray-700 text-gray-900 dark:text-white`}
              placeholder="Enter test result title"
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-500">{errors.title}</p>
            )}
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
              placeholder="Enter test result description"
            />
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              File <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
              {selectedFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <File className="text-gray-400" size={24} />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null)
                      handleChange('fileName', '')
                      handleChange('fileData', '')
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <Upload className="text-gray-400 mb-2" size={32} />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Click to upload or drag and drop
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    PDF, images, text files, logs, etc.
                  </span>
                  <input
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                    accept="*/*"
                  />
                </label>
              )}
            </div>
            {errors.file && (
              <p className="mt-1 text-sm text-red-500">{errors.file}</p>
            )}
          </div>

          {/* Result Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Result Status
            </label>
            <select
              value={formData.resultStatus}
              onChange={(e) => handleChange('resultStatus', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {RESULT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Execution Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Execution Date
            </label>
            <input
              type="datetime-local"
              value={formData.executedAt}
              onChange={(e) => handleChange('executedAt', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          {/* Executed By */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Executed By
            </label>
            <input
              type="text"
              value={formData.executedByName}
              onChange={(e) => handleChange('executedByName', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter executor name"
            />
          </div>

          {/* Test Environment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Test Environment
            </label>
            <input
              type="text"
              value={formData.testEnvironment}
              onChange={(e) => handleChange('testEnvironment', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter test environment description"
            />
          </div>

          {/* Test Setup */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Test Setup
            </label>
            <select
              value={formData.linkedSetupId}
              onChange={(e) => handleChange('linkedSetupId', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">None (optional)</option>
              {setups.map((setup: any) => (
                <option key={setup.id} value={setup.id}>
                  {setup.name}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              placeholder="Enter additional notes"
            />
          </div>

          {/* Link to Test Cases (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Link to Test Cases <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <div className="relative" ref={testCaseDropdownRef}>
              {/* Selected Test Cases */}
              {selectedTestCases.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedTestCases.map((testCase) => (
                    <span
                      key={testCase.id}
                      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                    >
                      {testCase.key} - {testCase.title}
                      <button
                        type="button"
                        onClick={() => toggleTestCase(testCase.id)}
                        className="ml-1 hover:opacity-70"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Search test cases by key or title..."
                  value={testCaseSearchQuery}
                  onChange={(e) => {
                    setTestCaseSearchQuery(e.target.value)
                    setShowTestCaseDropdown(true)
                  }}
                  onFocus={() => setShowTestCaseDropdown(true)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {testCaseSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setTestCaseSearchQuery('')
                      setShowTestCaseDropdown(false)
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showTestCaseDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTestCases.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No test cases found
                    </div>
                  ) : (
                    filteredTestCases.map((testCase: any) => {
                      const isSelected = formData.linkedTestCaseIds.includes(testCase.id)
                      return (
                        <button
                          key={testCase.id}
                          type="button"
                          onClick={() => {
                            toggleTestCase(testCase.id)
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded border-gray-300 dark:border-gray-600"
                            readOnly
                          />
                          <span className="flex-1 text-sm text-gray-900 dark:text-white">
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                              {testCase.key}
                            </span>
                            <span className="ml-2">{testCase.title}</span>
                          </span>
                          {isSelected && (
                            <Check size={16} className="text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              You can link test cases later from the test result details
            </p>
          </div>

          {/* Link to Test Plan (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 text-left">
              Link to Test Plan <span className="text-gray-500 text-xs">(Optional)</span>
            </label>
            <div className="relative" ref={testPlanDropdownRef}>
              {/* Selected Test Plan */}
              {selectedTestPlan && (
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                    {selectedTestPlan.key} - {selectedTestPlan.name}
                    <button
                      type="button"
                      onClick={() => {
                        handleChange('linkedTestPlanId', '')
                        setTestPlanSearchQuery('')
                      }}
                      className="ml-1 hover:opacity-70"
                    >
                      <X size={12} />
                    </button>
                  </span>
                </div>
              )}

              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder={selectedTestPlan ? selectedTestPlan.key + ' - ' + selectedTestPlan.name : 'Search test plans by key or name...'}
                  value={testPlanSearchQuery}
                  onChange={(e) => {
                    setTestPlanSearchQuery(e.target.value)
                    setShowTestPlanDropdown(true)
                  }}
                  onFocus={() => setShowTestPlanDropdown(true)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {testPlanSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setTestPlanSearchQuery('')
                      setShowTestPlanDropdown(false)
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showTestPlanDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredTestPlans.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                      No test plans found
                    </div>
                  ) : (
                    filteredTestPlans.map((plan: any) => {
                      const isSelected = formData.linkedTestPlanId === plan.id
                      return (
                        <button
                          key={plan.id}
                          type="button"
                          onClick={() => {
                            handleChange('linkedTestPlanId', isSelected ? '' : plan.id)
                            setTestPlanSearchQuery('')
                            setShowTestPlanDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span className="flex-1 text-sm text-gray-900 dark:text-white">
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                              {plan.key}
                            </span>
                            <span className="ml-2">{plan.name}</span>
                          </span>
                          {isSelected && (
                            <Check size={16} className="text-blue-600 dark:text-blue-400" />
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 text-left">
              You can link a test plan later from the test result details
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
              onClick={onClose}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              disabled={createTestResultMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createTestResultMutation.isPending}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createTestResultMutation.isPending ? 'Creating...' : 'Create Test Result'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
