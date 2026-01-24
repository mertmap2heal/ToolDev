import { useState } from 'react'
import { X, Download, Trash2, Edit2, Link2, Unlink } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import clsx from 'clsx'

interface TestResultDetailDrawerProps {
  testResult: any
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

const getStatusLabel = (status: string) => {
  const statusObj = RESULT_STATUSES.find((s) => s.value === status)
  return statusObj ? statusObj.label : status
}

export default function TestResultDetailDrawer({
  testResult,
  isOpen,
  onClose,
  projectId,
}: TestResultDetailDrawerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    title: '',
    description: '',
    resultStatus: 'NOT_RUN' as typeof RESULT_STATUSES[number]['value'],
    executedAt: '',
    executedByName: '',
    testEnvironment: '',
    linkedSetupId: '',
    notes: '',
  })
  const queryClient = useQueryClient()

  // Fetch full test result details
  const { data: resultDetails } = useQuery({
    queryKey: ['test-result', projectId, testResult?.id],
    queryFn: async () => {
      if (!testResult?.id) return null
      const response = await verificationService.getTestResult(projectId, testResult.id)
      return response.success ? response.data : null
    },
    enabled: isOpen && !!testResult?.id,
  })

  // Fetch test cases and test plans for linking
  const { data: testCases = [] } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      const response = await verificationService.getTestCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen,
  })

  const { data: testPlans = [] } = useQuery({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      const response = await verificationService.getTestPlans(projectId)
      return response.success && response.data ? response.data : []
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

  const currentResult = resultDetails || testResult

  // Extract linked entities
  const linkedTestCases = currentResult?.links
    ?.filter((link: any) => link.linkedEntityType === 'TEST_CASE')
    .map((link: any) => {
      const testCase = testCases.find((tc: any) => tc.id === link.linkedEntityId)
      return testCase ? { ...testCase, linkId: link.id } : null
    })
    .filter(Boolean) || []

  const linkedTestPlan = currentResult?.links
    ?.find((link: any) => link.linkedEntityType === 'TEST_PLAN')
    ? (() => {
        const link = currentResult.links.find((l: any) => l.linkedEntityType === 'TEST_PLAN')
        const plan = testPlans.find((tp: any) => tp.id === link.linkedEntityId)
        return plan ? { ...plan, linkId: link.id } : null
      })()
    : null

  const updateMutation = useMutation({
    mutationFn: (data: any) => verificationService.updateTestResult(projectId, testResult.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-result', projectId, testResult.id] })
      queryClient.invalidateQueries({ queryKey: ['test-results', projectId] })
      setIsEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => verificationService.deleteTestResult(projectId, testResult.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-results', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      onClose()
    },
  })

  const linkMutation = useMutation({
    mutationFn: (data: any) => verificationService.linkTestResult(projectId, testResult.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-result', projectId, testResult.id] })
    },
  })

  const unlinkMutation = useMutation({
    mutationFn: (data: any) => verificationService.unlinkTestResult(projectId, testResult.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-result', projectId, testResult.id] })
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
      case 'SKIPPED':
      case 'NOT_RUN':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const handleDownload = async () => {
    try {
      const blob = await verificationService.downloadTestResult(projectId, testResult.id)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = currentResult?.fileName || 'test-result'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download error:', error)
      alert('Failed to download file')
    }
  }

  const handleSave = () => {
    const submitData: any = {
      title: editData.title.trim(),
      description: editData.description?.trim() || undefined,
      resultStatus: editData.resultStatus,
      executedAt: editData.executedAt || undefined,
      executedByName: editData.executedByName?.trim() || undefined,
      testEnvironment: editData.testEnvironment?.trim() || undefined,
      linkedSetupId: editData.linkedSetupId || undefined,
      notes: editData.notes?.trim() || undefined,
    }
    updateMutation.mutate(submitData)
  }

  const handleLink = (entityType: 'TEST_CASE' | 'TEST_PLAN', entityId: string) => {
    linkMutation.mutate({
      linkedEntityType: entityType,
      linkedEntityId: entityId,
      relation: 'PRIMARY',
    })
  }

  const handleUnlink = (entityType: 'TEST_CASE' | 'TEST_PLAN', entityId: string) => {
    unlinkMutation.mutate({
      linkedEntityType: entityType,
      linkedEntityId: entityId,
    })
  }

  if (!currentResult) return null

  // Initialize edit data when result changes
  if (isEditing && !editData.title && currentResult) {
    setEditData({
      title: currentResult.title || '',
      description: currentResult.description || '',
      resultStatus: (currentResult.resultStatus || 'NOT_RUN') as typeof RESULT_STATUSES[number]['value'],
      executedAt: currentResult.executedAt
        ? new Date(currentResult.executedAt).toISOString().slice(0, 16)
        : '',
      executedByName: currentResult.executedByName || '',
      testEnvironment: currentResult.testEnvironment || '',
      linkedSetupId: currentResult.linkedSetupId || '',
      notes: currentResult.notes || '',
    })
  }

  return (
    <div
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden',
        isOpen && currentResult ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Test Result Details</h2>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={handleDownload}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Download file"
                >
                  <Download size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Edit"
                >
                  <Edit2 size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this test result?')) {
                      deleteMutation.mutate()
                    }
                  }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Delete"
                >
                  <Trash2 size={20} className="text-red-600 dark:text-red-400" />
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isEditing ? (
            <>
              {/* Edit Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editData.title}
                    onChange={(e) => setEditData({ ...editData, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Result Status
                  </label>
                  <select
                    value={editData.resultStatus}
                    onChange={(e) => setEditData({ ...editData, resultStatus: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {RESULT_STATUSES.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Execution Date
                  </label>
                  <input
                    type="datetime-local"
                    value={editData.executedAt}
                    onChange={(e) => setEditData({ ...editData, executedAt: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Executed By
                  </label>
                  <input
                    type="text"
                    value={editData.executedByName}
                    onChange={(e) => setEditData({ ...editData, executedByName: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Test Environment
                  </label>
                  <input
                    type="text"
                    value={editData.testEnvironment}
                    onChange={(e) => setEditData({ ...editData, testEnvironment: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Test Setup
                  </label>
                  <select
                    value={editData.linkedSetupId}
                    onChange={(e) => setEditData({ ...editData, linkedSetupId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">None</option>
                    {setups.map((setup: any) => (
                      <option key={setup.id} value={setup.id}>
                        {setup.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Notes
                  </label>
                  <textarea
                    value={editData.notes}
                    onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false)
                      setEditData({
                        title: '',
                        description: '',
                        resultStatus: 'NOT_RUN',
                        executedAt: '',
                        executedByName: '',
                        testEnvironment: '',
                        linkedSetupId: '',
                        notes: '',
                      })
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* View Mode */}
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{currentResult.title}</h3>
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium mt-2 ${getStatusColor(
                      currentResult.resultStatus
                    )}`}
                  >
                    {getStatusLabel(currentResult.resultStatus || 'NOT_RUN')}
                  </span>
                </div>

                {currentResult.description && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{currentResult.description}</p>
                  </div>
                )}

                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">File</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{currentResult.fileName}</p>
                  {currentResult.fileSize && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {(currentResult.fileSize / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>

                {currentResult.executedAt && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Execution Date</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(currentResult.executedAt).toLocaleString()}
                    </p>
                  </div>
                )}

                {currentResult.executedByName && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Executed By</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{currentResult.executedByName}</p>
                  </div>
                )}

                {currentResult.testEnvironment && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Environment</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{currentResult.testEnvironment}</p>
                  </div>
                )}

                {currentResult.setup && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Test Setup</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{currentResult.setup.name}</p>
                  </div>
                )}

                {currentResult.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {currentResult.notes}
                    </p>
                  </div>
                )}

                {/* Linked Test Cases */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Linked Test Cases</h4>
                    <button
                      onClick={() => {
                        const unlinkedCases = testCases.filter(
                          (tc: any) => !linkedTestCases.find((ltc: any) => ltc.id === tc.id)
                        )
                        if (unlinkedCases.length > 0) {
                          const selected = prompt(
                            `Enter test case ID to link:\nAvailable: ${unlinkedCases.map((tc: any) => `${tc.key} (${tc.id})`).join(', ')}`
                          )
                          if (selected) {
                            const testCase = testCases.find((tc: any) => tc.id === selected || tc.key === selected)
                            if (testCase) {
                              handleLink('TEST_CASE', testCase.id)
                            }
                          }
                        }
                      }}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                    >
                      <Link2 size={12} />
                      Link Test Case
                    </button>
                  </div>
                  {linkedTestCases.length > 0 ? (
                    <div className="space-y-2">
                      {linkedTestCases.map((testCase: any) => (
                        <div
                          key={testCase.id}
                          className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                        >
                          <span className="text-sm text-gray-900 dark:text-white">
                            {testCase.key} - {testCase.title}
                          </span>
                          <button
                            onClick={() => handleUnlink('TEST_CASE', testCase.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800"
                            title="Unlink"
                          >
                            <Unlink size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No test cases linked</p>
                  )}
                </div>

                {/* Linked Test Plan */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Linked Test Plan</h4>
                    {!linkedTestPlan && (
                      <button
                        onClick={() => {
                          const unlinkedPlans = testPlans.filter((tp: any) => tp.id !== linkedTestPlan?.id)
                          if (unlinkedPlans.length > 0) {
                            const selected = prompt(
                              `Enter test plan ID to link:\nAvailable: ${unlinkedPlans.map((tp: any) => `${tp.key} (${tp.id})`).join(', ')}`
                            )
                            if (selected) {
                              const plan = testPlans.find((tp: any) => tp.id === selected || tp.key === selected)
                              if (plan) {
                                handleLink('TEST_PLAN', plan.id)
                              }
                            }
                          }
                        }}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        <Link2 size={12} />
                        Link Test Plan
                      </button>
                    )}
                  </div>
                  {linkedTestPlan ? (
                    <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded">
                      <span className="text-sm text-gray-900 dark:text-white">
                        {linkedTestPlan.key} - {linkedTestPlan.name}
                      </span>
                      <button
                        onClick={() => handleUnlink('TEST_PLAN', linkedTestPlan.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800"
                        title="Unlink"
                      >
                        <Unlink size={16} />
                      </button>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No test plan linked</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
