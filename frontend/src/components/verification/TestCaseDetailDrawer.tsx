import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Link2, Download, Search, Check, Plus, FileCode } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import ReportExporter from './ReportExporter'
import ExportWithTemplateModal from './ExportWithTemplateModal'
import CustomSectionEditor from './CustomSectionEditor'
import VerificationLifecycle from './VerificationLifecycle'
import clsx from 'clsx'

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
    ownerUserId: '',
  })
  const [selectedSetups, setSelectedSetups] = useState<string[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showExportTemplateModal, setShowExportTemplateModal] = useState(false)
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

  // Fetch all available setups
  const { data: setups = [] } = useQuery({
    queryKey: ['setups', projectId],
    queryFn: async () => {
      const response = await verificationService.getSetups(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!projectId,
  })

  // Fetch report data when export modal opens
  const { data: reportData } = useQuery({
    queryKey: ['test-case-report', projectId, testCase?.id],
    queryFn: async () => {
      const response = await verificationService.getTestCaseReport(projectId, testCase.id)
      return response.success ? response.data : null
    },
    enabled: showExportModal && !!testCase?.id,
  })

  // Fetch custom sections
  const { data: customSections = [], refetch: refetchCustomSections } = useQuery({
    queryKey: ['custom-sections', projectId, testCase?.id],
    queryFn: async () => {
      if (!testCase?.id) return []
      const response = await verificationService.getCustomSections(projectId, testCase.id)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && !!testCase?.id,
  })

  const updateCaseMutation = useMutation({
    mutationFn: (data: any) => verificationService.updateTestCase(projectId, testCase.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-case', projectId, testCase.id] })
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
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

  const createCustomSectionMutation = useMutation({
    mutationFn: (data: any) => verificationService.createCustomSection(projectId, testCase.id, data),
    onSuccess: () => {
      refetchCustomSections()
    },
  })

  const updateCustomSectionMutation = useMutation({
    mutationFn: ({ sectionId, data }: { sectionId: string; data: any }) =>
      verificationService.updateCustomSection(projectId, sectionId, data),
    onSuccess: () => {
      refetchCustomSections()
    },
  })

  const deleteCustomSectionMutation = useMutation({
    mutationFn: (sectionId: string) => verificationService.deleteCustomSection(projectId, sectionId),
    onSuccess: () => {
      refetchCustomSections()
    },
  })

  const linkSetupMutation = useMutation({
    mutationFn: (setupId: string) => verificationService.linkSetup(projectId, testCase.id, setupId),
  })

  const unlinkSetupMutation = useMutation({
    mutationFn: (setupId: string) => verificationService.unlinkSetup(projectId, testCase.id, setupId),
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
        ownerUserId: currentCase.ownerUserId || '',
      })

      // Initialize selectedSetups from currentCase.testCaseSetups
      const currentSetupIds = currentCase.testCaseSetups?.map((link: any) => link.setupId) || []
      setSelectedSetups(currentSetupIds)
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

  const handleSave = async () => {
    const submitData: any = {
      title: editData.title.trim(),
      objective: editData.objective?.trim() || undefined,
      preconditions: editData.preconditions?.trim() || undefined,
      passFailCriteria: editData.passFailCriteria?.trim() || undefined,
      ownerUserId: editData.ownerUserId?.trim() || undefined,
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

    try {
      // Update test case
      await updateCaseMutation.mutateAsync(submitData)

      // Get currently linked setup IDs
      const currentSetupIds = currentCase?.testCaseSetups?.map((link: any) => link.setupId) || []

      // Link new setups
      const setupsToLink = selectedSetups.filter(id => !currentSetupIds.includes(id))
      for (const setupId of setupsToLink) {
        try {
          await linkSetupMutation.mutateAsync(setupId)
        } catch (error) {
          console.error('Failed to link setup:', error)
        }
      }

      // Unlink removed setups
      const setupsToUnlink = currentSetupIds.filter((id: string) => !selectedSetups.includes(id))
      for (const setupId of setupsToUnlink) {
        try {
          await unlinkSetupMutation.mutateAsync(setupId)
        } catch (error) {
          console.error('Failed to unlink setup:', error)
        }
      }

      // Invalidate queries to refresh data (updateCaseMutation already invalidates, but we do it again after setup changes)
      queryClient.invalidateQueries({ queryKey: ['test-case', projectId, testCase.id] })
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to save test case:', error)
    }
  }

  if (!testCase) return null

  return (
    <div
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
        isOpen && testCase ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
    >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{currentCase?.key}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(currentCase?.status || 'DRAFT')}`}>
                {currentCase?.status || 'DRAFT'}
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">v{currentCase?.version || '1.0'}</span>
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
                <button
                  onClick={() => setShowExportModal(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Export Report"
                >
                  <Download size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setShowExportTemplateModal(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Export using template…"
                >
                  <FileCode size={18} className="text-gray-600 dark:text-gray-400" />
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
                      ownerUserId: currentCase?.ownerUserId || '',
                    })
                    // Reset selectedSetups from currentCase.testCaseSetups
                    const currentSetupIds = currentCase?.testCaseSetups?.map((link: any) => link.setupId) || []
                    setSelectedSetups(currentSetupIds)
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
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          <div className="space-y-6">
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

          {/* Lifecycle */}
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <VerificationLifecycle
              entityType="TEST_CASE"
              currentStatus={currentCase?.status || 'DRAFT'}
              onTransition={(newStatus) => {
                if (newStatus === 'REVIEWED') reviewCaseMutation.mutate()
                else if (newStatus === 'APPROVED') approveCaseMutation.mutate()
                else updateCaseMutation.mutate({ status: newStatus })
              }}
              isTransitioning={
                reviewCaseMutation.isPending || approveCaseMutation.isPending || updateCaseMutation.isPending
              }
            />
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

          {/* Owner User ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Owner User ID
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editData.ownerUserId}
                onChange={(e) => setEditData({ ...editData, ownerUserId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Enter owner user ID (optional)"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">{currentCase?.ownerUserId || '—'}</p>
            )}
          </div>

          {/* Test Setups */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Test Setups
            </label>
            {isEditing ? (
              <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-lg p-3">
                {setups.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No test setups available</p>
                ) : (
                  setups.map((setup: any) => (
                    <div key={setup.id} className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <input
                        type="checkbox"
                        checked={selectedSetups.includes(setup.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSetups([...selectedSetups, setup.id])
                          } else {
                            setSelectedSetups(selectedSetups.filter((id) => id !== setup.id))
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{setup.name}</div>
                        {setup.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">{setup.description}</div>
                        )}
                        {setup.environmentType && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Type: {setup.environmentType}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {currentCase?.testCaseSetups && currentCase.testCaseSetups.length > 0 ? (
                  currentCase.testCaseSetups.map((link: any) => (
                    <div key={link.id} className="p-2 border border-gray-200 dark:border-gray-600 rounded-lg">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">{link.setup?.name}</div>
                      {link.setup?.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">{link.setup.description}</div>
                      )}
                      {link.setup?.environmentType && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Type: {link.setup.environmentType}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No test setups linked</p>
                )}
              </div>
            )}
          </div>

          {/* Verifies Elements */}
          {!isEditing && (
            <VerifiesElementsSection testCaseId={currentCase?.id} projectId={projectId} />
          )}

          {/* Linked Test Results */}
          {!isEditing && (
            <LinkedTestResultsSection testCaseId={currentCase?.id} projectId={projectId} />
          )}

          {/* Custom Sections */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Custom Sections
              </label>
              {!isEditing && (
                <button
                  onClick={() => {
                    if (testCase?.id) {
                      createCustomSectionMutation.mutate({
                        title: 'New Section',
                        content: '',
                        orderIndex: customSections.length,
                      })
                    }
                  }}
                  disabled={createCustomSectionMutation.isPending || !testCase?.id}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus size={16} />
                  Add Section
                </button>
              )}
            </div>

            {customSections.length > 0 ? (
              <div className="space-y-4">
                {customSections.map((section: any) => (
                  <CustomSectionEditor
                    key={section.id}
                    section={section}
                    projectId={projectId}
                    testCaseId={testCase?.id}
                    sectionId={section.id}
                    isReadOnly={false}
                    onUpdate={(updated) => {
                      if (section.id && !section.id.startsWith('temp-')) {
                        updateCustomSectionMutation.mutate({
                          sectionId: section.id,
                          data: updated,
                        })
                      }
                    }}
                    onDelete={
                      section.id && !section.id.startsWith('temp-')
                        ? () => {
                            deleteCustomSectionMutation.mutate(section.id)
                          }
                        : undefined
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No custom sections. Click "Add Section" to create one.
              </p>
            )}
          </div>
        </div>
        </div>

      {/* Export Modal */}
      {showExportModal && reportData && (
        <ReportExporter
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          reportType="test-case"
          reportData={reportData}
          entityName={`${currentCase?.key || ''} - ${currentCase?.title || ''}`}
        />
      )}

      {/* Export using template modal */}
      {showExportTemplateModal && projectId && testCase?.id && (
        <ExportWithTemplateModal
          isOpen={true}
          onClose={() => setShowExportTemplateModal(false)}
          projectId={projectId}
          entityType="TEST_CASE"
          entityId={testCase.id}
          entityName={`${currentCase?.key || ''} - ${currentCase?.title || ''}`}
        />
      )}
    </div>
  )
}

function VerifiesElementsSection({ testCaseId, projectId }: { testCaseId?: string; projectId: string }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch verification links
  const { data: verificationLinks = [] } = useQuery({
    queryKey: ['test-case-verification-links', projectId, testCaseId],
    queryFn: async () => {
      if (!testCaseId) return []
      const response = await verificationService.getTestCaseVerificationLinks(projectId, testCaseId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!testCaseId,
  })

  // Fetch requirements and functions
  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const response = await requirementService.getAllRequirements(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const response = await functionService.getFunctions(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: !!projectId,
  })

  // Combine and filter elements
  const allElements = [
    ...requirements.map((req: any) => ({
      id: req.id,
      type: 'requirement' as const,
      identifier: req.requirementId || '',
      name: req.title,
      description: req.description,
    })),
    ...functions.map((func: any) => ({
      id: func.id,
      type: 'function' as const,
      identifier: func.functionId || '',
      name: func.name,
      description: func.description,
    })),
  ]

  // Get already linked element IDs
  const linkedElementIds = new Set(verificationLinks.map((link: any) => link.targetId))

  // Filter elements based on search and exclude already linked
  const filteredElements = allElements.filter((element) => {
    if (linkedElementIds.has(element.id)) return false
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      element.identifier?.toLowerCase().includes(query) ||
      element.name?.toLowerCase().includes(query) ||
      element.description?.toLowerCase().includes(query)
    )
  })

  const linkMutation = useMutation({
    mutationFn: ({ targetType, targetId }: { targetType: 'requirement' | 'function'; targetId: string }) =>
      verificationService.linkTestCaseVerificationElement(projectId, testCaseId!, targetType, targetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-case-verification-links', projectId, testCaseId] })
      setSearchQuery('')
      setShowDropdown(false)
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      verificationService.unlinkTestCaseVerificationElement(projectId, testCaseId!, linkId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-case-verification-links', projectId, testCaseId] })
    },
  })

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // Get linked elements with their details
  const linkedElements = verificationLinks.map((link: any) => {
    const element = link.targetElement
    if (!element) return null
    return {
      linkId: link.id,
      type: link.targetType,
      identifier: element.requirementId || element.functionId || '',
      name: element.title || element.name,
    }
  }).filter(Boolean)

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Verifies Elements
      </label>

      {/* Searchable Dropdown */}
      <div className="relative mb-3" ref={dropdownRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Search requirements or functions..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowDropdown(true)
            }}
            onFocus={() => setShowDropdown(true)}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('')
                setShowDropdown(false)
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {filteredElements.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                No elements found
              </div>
            ) : (
              filteredElements.map((element) => (
                <button
                  key={element.id}
                  type="button"
                  onClick={() => {
                    linkMutation.mutate({
                      targetType: element.type,
                      targetId: element.id,
                    })
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                  disabled={linkMutation.isPending}
                >
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      element.type === 'requirement'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                    }`}
                  >
                    {element.type === 'requirement' ? 'Requirement' : 'Function'}
                  </span>
                  <span className="flex-1 text-sm text-gray-900 dark:text-white">
                    {element.identifier && (
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">
                        {element.identifier}
                      </span>
                    )}
                    {element.name}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Linked Elements */}
      {linkedElements.length > 0 ? (
        <div className="space-y-2">
          {linkedElements.map((element: any) => (
            <div
              key={element.linkId}
              className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    element.type === 'requirement'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                      : 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  }`}
                >
                  {element.type === 'requirement' ? 'Requirement' : 'Function'}
                </span>
                <span className="text-sm text-gray-900 dark:text-white">
                  {element.identifier && (
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400 mr-2">
                      {element.identifier}
                    </span>
                  )}
                  {element.name}
                </span>
              </div>
              <button
                onClick={() => unlinkMutation.mutate(element.linkId)}
                className="text-red-600 dark:text-red-400 hover:text-red-800"
                title="Unlink"
                disabled={unlinkMutation.isPending}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No elements linked</p>
      )}

      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        Link this test case to requirements or functions it verifies
      </p>
    </div>
  )
}

function LinkedTestResultsSection({ testCaseId, projectId }: { testCaseId?: string; projectId: string }) {
  const queryClient = useQueryClient()

  // Fetch test results linked to this test case
  const { data: allTestResults = [] } = useQuery({
    queryKey: ['test-results', projectId],
    queryFn: async () => {
      const response = await verificationService.getTestResults(projectId)
      return response.success && response.data ? response.data : []
    },
  })

  const linkedResults = allTestResults.filter((result: any) =>
    result.links?.some((link: any) => link.linkedEntityType === 'TEST_CASE' && link.linkedEntityId === testCaseId)
  )

  const linkMutation = useMutation({
    mutationFn: (data: any) => {
      const result = allTestResults.find((r: any) => r.id === data.testResultId)
      if (!result) throw new Error('Test result not found')
      return verificationService.linkTestResult(projectId, data.testResultId, {
        linkedEntityType: 'TEST_CASE',
        linkedEntityId: testCaseId!,
        relation: 'PRIMARY',
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-results', projectId] })
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (testResultId: string) =>
      verificationService.unlinkTestResult(projectId, testResultId, {
        linkedEntityType: 'TEST_CASE',
        linkedEntityId: testCaseId!,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-results', projectId] })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PASS':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'FAIL':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
      case 'BLOCKED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const availableResults = allTestResults.filter(
    (result: any) =>
      !result.links?.some((link: any) => link.linkedEntityType === 'TEST_CASE' && link.linkedEntityId === testCaseId)
  )

  if (!testCaseId) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          Linked Test Results
        </label>
        {availableResults.length > 0 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                linkMutation.mutate({ testResultId: e.target.value })
                e.target.value = ''
              }
            }}
            className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            defaultValue=""
          >
            <option value="">Link Test Result...</option>
            {availableResults.map((result: any) => (
              <option key={result.id} value={result.id}>
                {result.title}
              </option>
            ))}
          </select>
        )}
      </div>
      {linkedResults.length > 0 ? (
        <div className="space-y-2">
          {linkedResults.map((result: any) => (
            <div
              key={result.id}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3 flex-1">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(result.resultStatus || 'NOT_RUN')}`}>
                  {result.resultStatus === 'NOT_RUN' ? 'Not Run' :
                   result.resultStatus === 'PASS' ? 'Pass' :
                   result.resultStatus === 'FAIL' ? 'Fail' :
                   result.resultStatus === 'BLOCKED' ? 'Blocked' :
                   result.resultStatus === 'SKIPPED' ? 'Skipped' :
                   result.resultStatus || 'Not Run'}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{result.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{result.fileName}</p>
                </div>
              </div>
              <button
                onClick={() => unlinkMutation.mutate(result.id)}
                className="text-red-600 dark:text-red-400 hover:text-red-800 text-sm"
                title="Unlink"
              >
                Unlink
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">No test results linked</p>
      )}
    </div>
  )
}
