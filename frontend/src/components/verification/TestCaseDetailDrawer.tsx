import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Link2, Download, Search, Check, Plus, FileCode, Play, FileText } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import ReportExporter from './ReportExporter'
import ExportWithTemplateModal from './ExportWithTemplateModal'
import FullReportModal from './FullReportModal'
import CustomSectionEditor from './CustomSectionEditor'
import VerificationLifecycle from './VerificationLifecycle'
import StructuredStepEditor, { parseStepsToPairs, pairsToStepsAndExpected, type StepPair } from './StructuredStepEditor'
import { useVerificationDrawer } from '../../contexts/VerificationDrawerContext'
import clsx from 'clsx'

interface TestCaseDetailDrawerProps {
  testCase: any
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function TestCaseDetailDrawer({ testCase, isOpen, onClose, projectId }: TestCaseDetailDrawerProps) {
  const drawer = useVerificationDrawer()
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
  const [stepPairs, setStepPairs] = useState<StepPair[]>([])
  const [selectedSetups, setSelectedSetups] = useState<string[]>([])
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showExportTemplateModal, setShowExportTemplateModal] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)
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

  // Fetch run results (execution history) for this test case
  const { data: runResultsForCase = [] } = useQuery({
    queryKey: ['run-results-for-case', projectId, testCase?.id],
    queryFn: async () => {
      if (!testCase?.id || !projectId) return []
      const response = await verificationService.getRunResultsForTestCase(projectId, testCase.id)
      return (response.success && response.data ? response.data : []) as Array<{
        id: string
        resultStatus?: string
        testRun?: { id: string; runName?: string; status?: string; createdAt?: string; testPlan?: { id: string; key?: string; name?: string } }
      }>
    },
    enabled: isOpen && !!testCase?.id && !!projectId,
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

  const duplicateMutation = useMutation({
    mutationFn: async () => {
      const res = await verificationService.createTestCase(projectId, {
        title: `Copy of ${currentCase?.title || 'Test Case'}`,
        objective: currentCase?.objective,
        preconditions: currentCase?.preconditions,
        steps: currentCase?.steps,
        expectedResults: currentCase?.expectedResults,
        passFailCriteria: currentCase?.passFailCriteria,
        linkedMocCode: currentCase?.linkedMocCode,
        linkedMethodId: currentCase?.linkedMethodId,
        ownerUserId: currentCase?.ownerUserId,
      })
      if (!res.success || !res.data) throw new Error((res as any).error || 'Duplicate failed')
      const newCase = res.data
      const setupIds = currentCase?.testCaseSetups?.map((l: any) => l.setupId) ?? []
      for (const setupId of setupIds) {
        try {
          await verificationService.linkSetup(projectId, (newCase as { id: string }).id, setupId)
        } catch (e) {
          console.error('Failed to link setup:', e)
        }
      }
      return newCase
    },
    onSuccess: (newCase) => {
      queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      drawer.openCase(newCase)
    },
    onError: (err: any) => alert(err?.message || 'Failed to duplicate'),
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

  const stepDesignNotesSection = (Array.isArray(customSections) ? customSections : []).find((s: any) => s.title === '_StepDesignNotes')

  useEffect(() => {
    if (currentCase) {
      setEditData({
        title: currentCase.title || '',
        objective: currentCase.objective || '',
        preconditions: currentCase.preconditions || '',
        steps: '',
        expectedResults: '',
        passFailCriteria: currentCase.passFailCriteria || '',
        linkedMocCode: currentCase.linkedMocCode?.toString() || '',
        linkedMethodId: currentCase.linkedMethodId || '',
        ownerUserId: currentCase.ownerUserId || '',
      })
      let designNotes: string[] = []
      if (stepDesignNotesSection?.content) {
        try {
          const parsed = JSON.parse(stepDesignNotesSection.content)
          designNotes = Array.isArray(parsed) ? parsed : []
        } catch {
          designNotes = []
        }
      }
      setStepPairs(parseStepsToPairs(currentCase.steps, currentCase.expectedResults, designNotes))

      const currentSetupIds = currentCase.testCaseSetups?.map((link: any) => link.setupId) || []
      setSelectedSetups(currentSetupIds)
    }
  }, [currentCase, stepDesignNotesSection?.content])

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

    // Steps and expected results from structured editor
    const { steps, expectedResults } = pairsToStepsAndExpected(stepPairs)
    if (steps.some((s) => s) || expectedResults.some((e) => e)) {
      submitData.steps = steps.length > 0 ? steps : undefined
      submitData.expectedResults = expectedResults.length > 0 ? expectedResults : undefined
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

      // Create or update Step Design Notes custom section
      const designNotes = stepPairs.map((p) => p.designNote ?? '')
      const notesContent = JSON.stringify(designNotes)
      const stepNotesSection = (Array.isArray(customSections) ? customSections : []).find((s: any) => s.title === '_StepDesignNotes')
      if (stepNotesSection) {
        await updateCustomSectionMutation.mutateAsync({
          sectionId: stepNotesSection.id,
          data: { content: notesContent },
        })
      } else if (designNotes.some((n) => n.trim())) {
        await createCustomSectionMutation.mutateAsync({
          title: '_StepDesignNotes',
          content: notesContent,
          orderIndex: -1,
        })
      }

      // Invalidate queries to refresh data (updateCaseMutation already invalidates, but we do it again after setup changes)
      queryClient.invalidateQueries({ queryKey: ['test-case', projectId, testCase.id] })
      queryClient.invalidateQueries({ queryKey: ['custom-sections', projectId, testCase.id] })
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
                  onClick={() => duplicateMutation.mutate()}
                  disabled={duplicateMutation.isPending}
                  className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                >
                  {duplicateMutation.isPending ? 'Duplicating…' : 'Duplicate'}
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="View full report"
                >
                  <FileText size={18} className="text-gray-600 dark:text-gray-400" />
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
                    setEditData({
                      title: currentCase?.title || '',
                      objective: currentCase?.objective || '',
                      preconditions: currentCase?.preconditions || '',
                      steps: '',
                      expectedResults: '',
                      passFailCriteria: currentCase?.passFailCriteria || '',
                      linkedMocCode: currentCase?.linkedMocCode?.toString() || '',
                      linkedMethodId: currentCase?.linkedMethodId || '',
                      ownerUserId: currentCase?.ownerUserId || '',
                    })
                    let cancelNotes: string[] = []
                    if (stepDesignNotesSection?.content) {
                      try {
                        const p = JSON.parse(stepDesignNotesSection.content)
                        cancelNotes = Array.isArray(p) ? p : []
                      } catch { /* ignore */ }
                    }
                    setStepPairs(parseStepsToPairs(currentCase?.steps, currentCase?.expectedResults, cancelNotes))
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

          {/* Test runs / Execution history */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Test runs (execution history)
            </label>
            {runResultsForCase.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No test runs have included this case yet.</p>
            ) : (
              <div className="space-y-2">
                {runResultsForCase.map((result: any) => {
                  const run = result.testRun
                  const planLabel = run?.testPlan ? `${run.testPlan.key || ''} - ${run.testPlan.name || ''}`.trim() || '—' : '—'
                  const executedAt = run?.createdAt ? new Date(run.createdAt).toLocaleString() : '—'
                  const statusColor =
                    result.resultStatus === 'PASS' || result.resultStatus === 'PASSED_WITH_ERRORS'
                      ? 'text-green-600 dark:text-green-400'
                      : result.resultStatus === 'FAIL'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-gray-600 dark:text-gray-400'
                  return (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => run && drawer.openRun?.(run)}
                      className="flex items-center justify-between w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700/50 text-left transition-colors"
                    >
                      <span className="font-medium text-gray-900 dark:text-white">{run?.runName || 'Run'}</span>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 dark:text-gray-400">{planLabel}</span>
                        <span className={statusColor}>{result.resultStatus || 'NOT_RUN'}</span>
                        <span className="text-gray-500 dark:text-gray-400">{executedAt}</span>
                        <Play size={14} className="text-gray-400" />
                      </div>
                    </button>
                  )
                })}
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

          {/* Steps & Expected Results */}
          <StructuredStepEditor
            pairs={stepPairs}
            onChange={setStepPairs}
            readOnly={!isEditing}
          />

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
                {(Array.isArray(methods) ? methods : []).map((method: any) => (
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
                {(Array.isArray(setups) ? setups : []).length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">No test setups available</p>
                ) : (
                  (Array.isArray(setups) ? setups : []).map((setup: any) => (
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

          {/* Execution history (runs that executed this test case) */}
          {!isEditing && currentCase?.id && (
            <ExecutionHistorySection testCaseId={currentCase.id} projectId={projectId} />
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
                        orderIndex: (Array.isArray(customSections) ? customSections : []).length,
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

            {(Array.isArray(customSections) ? customSections : []).filter((s: any) => s.title !== '_StepDesignNotes').length > 0 ? (
              <div className="space-y-4">
                {(Array.isArray(customSections) ? customSections : []).filter((s: any) => s.title !== '_StepDesignNotes').map((section: any) => (
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

      {/* Full report modal */}
      {showReportModal && projectId && testCase?.id && (
        <FullReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          projectId={projectId}
          reportType="test-case"
          entityId={testCase.id}
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
  const linkedElementIds = new Set((Array.isArray(verificationLinks) ? verificationLinks : []).map((link: any) => link.targetId))

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
  const linkedElements = (Array.isArray(verificationLinks) ? verificationLinks : []).map((link: any) => {
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

function ExecutionHistorySection({ testCaseId, projectId }: { testCaseId: string; projectId: string }) {
  const drawer = useVerificationDrawer()
  const { data: runResults = [] } = useQuery({
    queryKey: ['run-results', projectId, testCaseId],
    queryFn: async () => {
      const res = (await verificationService.getRunResultsForTestCase(projectId, testCaseId)) as { success?: boolean; data?: any[] }
      return res.success && res.data ? res.data : []
    },
    enabled: !!testCaseId && !!projectId,
  })
  const getStatusColor = (s: string) => {
    if (s === 'PASS' || s === 'PASSED_WITH_ERRORS') return 'text-green-600 dark:text-green-400'
    if (s === 'FAIL') return 'text-red-600 dark:text-red-400'
    if (s === 'BLOCKED') return 'text-yellow-600 dark:text-yellow-400'
    return 'text-gray-500 dark:text-gray-400'
  }
  if (runResults.length === 0) return null
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Execution history</label>
      <div className="space-y-2">
        {runResults.map((rr: any) => (
          <button
            key={rr.id}
            onClick={() => rr.testRun && drawer.openRun?.(rr.testRun)}
            className="flex items-center justify-between w-full p-3 bg-gray-50 dark:bg-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 text-left"
          >
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{rr.testRun?.runName || 'Run'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {rr.testRun?.testPlan?.key || 'N/A'} — {rr.testRun?.testPlan?.name || ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${getStatusColor(rr.resultStatus || 'NOT_RUN')}`}>
                {rr.resultStatus || 'NOT_RUN'}
              </span>
              {rr.testRun?.createdAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(rr.testRun.createdAt).toLocaleDateString()}
                </span>
              )}
              <Play size={14} className="text-gray-500" />
            </div>
          </button>
        ))}
      </div>
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

  const linkedResults = (Array.isArray(allTestResults) ? allTestResults : []).filter((result: any) =>
    result.links?.some((link: any) => link.linkedEntityType === 'TEST_CASE' && link.linkedEntityId === testCaseId)
  )

  const linkMutation = useMutation({
    mutationFn: (data: any) => {
      const result = (Array.isArray(allTestResults) ? allTestResults : []).find((r: any) => r.id === data.testResultId)
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

  const availableResults = (Array.isArray(allTestResults) ? allTestResults : []).filter(
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
