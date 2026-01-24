import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'

interface TestCaseDetailDrawerProps {
  testCase: any
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function TestCaseDetailDrawer({ testCase, isOpen, onClose, projectId }: TestCaseDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    title: '',
    objective: '',
    preconditions: '',
    steps: '',
    expectedResults: '',
    passFailCriteria: '',
    linkedMocCode: '',
    linkedMethodId: '',
  })
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch full test case details
  const { data: caseDetails } = useQuery({
    queryKey: ['test-case', projectId, testCase?.id],
    queryFn: async () => {
      if (!testCase?.id) return null
      const response = await verificationService.getTestCase(projectId, testCase.id)
      return response.success ? response.data : null
    },
    enabled: isOpen && !!testCase?.id,
  })

  // Fetch MoCs and Methods
  const { data: mocs = [] } = useQuery({
    queryKey: ['mocs'],
    queryFn: async () => {
      const response = await verificationService.getMocs()
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  const { data: methods = [] } = useQuery({
    queryKey: ['methods', projectId],
    queryFn: async () => {
      const response = await verificationService.getMethods(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  const updateCaseMutation = useMutation({
    mutationFn: (data: any) => verificationService.updateTestCase(projectId, testCase.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-case', projectId, testCase.id] })
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setIsEditing(false)
    },
  })

  const reviewCaseMutation = useMutation({
    mutationFn: () => verificationService.reviewTestCase(projectId, testCase.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-case', projectId, testCase.id] })
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
    },
  })

  const approveCaseMutation = useMutation({
    mutationFn: () => verificationService.approveTestCase(projectId, testCase.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-case', projectId, testCase.id] })
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'READY':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'REVIEWED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const statusOptions = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'REVIEWED', label: 'Reviewed' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'READY', label: 'Ready' },
  ]

  const currentCase = caseDetails || testCase

  useEffect(() => {
    if (currentCase) {
      const stepsText = Array.isArray(currentCase.steps)
        ? JSON.stringify(currentCase.steps, null, 2)
        : currentCase.steps || ''
      const expectedText = Array.isArray(currentCase.expectedResults)
        ? JSON.stringify(currentCase.expectedResults, null, 2)
        : currentCase.expectedResults || ''

      setEditData({
        title: currentCase.title || '',
        objective: currentCase.objective || '',
        preconditions: currentCase.preconditions || '',
        steps: stepsText,
        expectedResults: expectedText,
        passFailCriteria: currentCase.passFailCriteria || '',
        linkedMocCode: currentCase.linkedMocCode?.toString() || '',
        linkedMethodId: currentCase.linkedMethodId || '',
      })
    }
  }, [currentCase])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setStatusDropdownOpen(false)
      }
    }

    if (statusDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen])

  const handleSave = () => {
    const submitData: any = {
      title: editData.title.trim(),
      objective: editData.objective?.trim() || undefined,
      preconditions: editData.preconditions?.trim() || undefined,
      passFailCriteria: editData.passFailCriteria?.trim() || undefined,
    }

    // Parse steps and expectedResults
    if (editData.steps.trim()) {
      try {
        const parsed = JSON.parse(editData.steps)
        submitData.steps = Array.isArray(parsed) ? parsed : [editData.steps.trim()]
      } catch {
        submitData.steps = [editData.steps.trim()]
      }
    }

    if (editData.expectedResults.trim()) {
      try {
        const parsed = JSON.parse(editData.expectedResults)
        submitData.expectedResults = Array.isArray(parsed) ? parsed : [editData.expectedResults.trim()]
      } catch {
        submitData.expectedResults = [editData.expectedResults.trim()]
      }
    }

    if (editData.linkedMocCode) {
      submitData.linkedMocCode = parseInt(editData.linkedMocCode, 10)
    } else {
      submitData.linkedMocCode = null
    }

    if (editData.linkedMethodId) {
      submitData.linkedMethodId = editData.linkedMethodId
    } else {
      submitData.linkedMethodId = null
    }

    updateCaseMutation.mutate(submitData)
  }

  if (!isOpen || !testCase) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-2xl h-full overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-500">{currentCase?.key}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(currentCase?.status || 'DRAFT')}`}>
                {currentCase?.status || 'DRAFT'}
              </span>
              <span className="text-xs text-gray-500">v{currentCase?.version || '1.0'}</span>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editData.title}
                onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{currentCase?.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                {currentCase?.status === 'DRAFT' && (
                  <button
                    onClick={() => reviewCaseMutation.mutate()}
                    disabled={reviewCaseMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Submit for Review
                  </button>
                )}
                {currentCase?.status === 'REVIEWED' && (
                  <button
                    onClick={() => approveCaseMutation.mutate()}
                    disabled={approveCaseMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Approve
                  </button>
                )}
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Edit
                </button>
              </>
            )}
            {isEditing && (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false)
                    // Reset edit data
                    const stepsText = Array.isArray(currentCase?.steps)
                      ? JSON.stringify(currentCase.steps, null, 2)
                      : currentCase?.steps || ''
                    const expectedText = Array.isArray(currentCase?.expectedResults)
                      ? JSON.stringify(currentCase.expectedResults, null, 2)
                      : currentCase?.expectedResults || ''
                    setEditData({
                      title: currentCase?.title || '',
                      objective: currentCase?.objective || '',
                      preconditions: currentCase?.preconditions || '',
                      steps: stepsText,
                      expectedResults: expectedText,
                      passFailCriteria: currentCase?.passFailCriteria || '',
                      linkedMocCode: currentCase?.linkedMocCode?.toString() || '',
                      linkedMethodId: currentCase?.linkedMethodId || '',
                    })
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateCaseMutation.isPending}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div className="relative" ref={statusDropdownRef}>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <button
              type="button"
              onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
              className={`w-full px-4 py-2 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${getStatusColor(currentCase?.status || 'DRAFT')}`}
            >
              <span>{statusOptions.find((opt) => opt.value === currentCase?.status)?.label || currentCase?.status}</span>
              <ChevronDown size={16} className="ml-2" />
            </button>
            {statusDropdownOpen && (
              <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      updateCaseMutation.mutate({ status: option.value })
                      setStatusDropdownOpen(false)
                    }}
                    className={`w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                      currentCase?.status === option.value ? 'font-semibold bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Objective */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Objective
            </label>
            {isEditing ? (
              <textarea
                value={editData.objective}
                onChange={(e) => setEditData({ ...editData, objective: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{currentCase?.objective || 'No objective'}</p>
            )}
          </div>

          {/* Preconditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preconditions
            </label>
            {isEditing ? (
              <textarea
                value={editData.preconditions}
                onChange={(e) => setEditData({ ...editData, preconditions: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{currentCase?.preconditions || 'No preconditions'}</p>
            )}
          </div>

          {/* Steps */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Steps
            </label>
            {isEditing ? (
              <textarea
                value={editData.steps}
                onChange={(e) => setEditData({ ...editData, steps: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none font-mono text-sm"
                placeholder="Enter steps as JSON array or one per line"
              />
            ) : (
              <div className="text-gray-900 dark:text-white">
                {Array.isArray(currentCase?.steps) ? (
                  <ol className="list-decimal list-inside space-y-1">
                    {currentCase.steps.map((step: any, idx: number) => (
                      <li key={idx}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p>{currentCase?.steps || 'No steps defined'}</p>
                )}
              </div>
            )}
          </div>

          {/* Expected Results */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expected Results
            </label>
            {isEditing ? (
              <textarea
                value={editData.expectedResults}
                onChange={(e) => setEditData({ ...editData, expectedResults: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none font-mono text-sm"
                placeholder="Enter expected results as JSON array or one per line"
              />
            ) : (
              <div className="text-gray-900 dark:text-white">
                {Array.isArray(currentCase?.expectedResults) ? (
                  <ol className="list-decimal list-inside space-y-1">
                    {currentCase.expectedResults.map((result: any, idx: number) => (
                      <li key={idx}>{result}</li>
                    ))}
                  </ol>
                ) : (
                  <p>{currentCase?.expectedResults || 'No expected results'}</p>
                )}
              </div>
            )}
          </div>

          {/* Pass/Fail Criteria */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Pass/Fail Criteria
            </label>
            {isEditing ? (
              <textarea
                value={editData.passFailCriteria}
                onChange={(e) => setEditData({ ...editData, passFailCriteria: e.target.value })}
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{currentCase?.passFailCriteria || 'No criteria defined'}</p>
            )}
          </div>

          {/* Linked MoC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Means of Compliance (MoC)
            </label>
            {isEditing ? (
              <select
                value={editData.linkedMocCode}
                onChange={(e) => setEditData({ ...editData, linkedMocCode: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No MoC</option>
                {mocs.map((moc: any) => (
                  <option key={moc.code} value={moc.code}>
                    {moc.code}: {moc.description}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-900 dark:text-white">
                {currentCase?.moc ? `${currentCase.moc.code}: ${currentCase.moc.description}` : 'No MoC linked'}
              </p>
            )}
          </div>

          {/* Linked Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Verification Method
            </label>
            {isEditing ? (
              <select
                value={editData.linkedMethodId}
                onChange={(e) => setEditData({ ...editData, linkedMethodId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">No Method</option>
                {methods.map((method: any) => (
                  <option key={method.id} value={method.id}>
                    {method.name} ({method.methodType})
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-gray-900 dark:text-white">
                {currentCase?.method ? `${currentCase.method.name} (${currentCase.method.methodType})` : 'No method linked'}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
