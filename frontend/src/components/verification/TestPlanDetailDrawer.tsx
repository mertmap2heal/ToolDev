import { useState, useRef, useEffect } from 'react'
import { X, ChevronDown, Plus, Trash2, GripVertical } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import CustomDropdown from './CustomDropdown'

interface TestPlanDetailDrawerProps {
  plan: any
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function TestPlanDetailDrawer({ plan, isOpen, onClose, projectId }: TestPlanDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'cases' | 'activity'>('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    scope: plan?.scope || '',
    entryCriteria: plan?.entryCriteria || '',
    exitCriteria: plan?.exitCriteria || '',
    phase: plan?.phase || '',
  })
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const statusDropdownRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  // Fetch full plan details
  const { data: planDetails } = useQuery({
    queryKey: ['test-plan', projectId, plan?.id],
    queryFn: async () => {
      if (!plan?.id) return null
      const response = await verificationService.getTestPlan(projectId, plan.id)
      return response.success ? response.data : null
    },
    enabled: isOpen && !!plan?.id,
  })

  // Fetch all test cases for adding to plan
  const { data: allTestCases = [] } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      const response = await verificationService.getTestCases(projectId)
      return response.success && response.data ? response.data : []
    },
    enabled: isOpen && activeTab === 'cases',
  })

  const updatePlanMutation = useMutation({
    mutationFn: (data: any) => verificationService.updateTestPlan(projectId, plan.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, plan.id] })
      queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      setIsEditing(false)
    },
  })

  const approvePlanMutation = useMutation({
    mutationFn: () => verificationService.approveTestPlan(projectId, plan.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, plan.id] })
      queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
    },
  })

  const closePlanMutation = useMutation({
    mutationFn: () => verificationService.closeTestPlan(projectId, plan.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, plan.id] })
      queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
    },
  })

  const addCaseMutation = useMutation({
    mutationFn: (testCaseId: string) => verificationService.addCaseToPlan(projectId, plan.id, testCaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, plan.id] })
    },
  })

  const removeCaseMutation = useMutation({
    mutationFn: (testCaseId: string) => verificationService.removeCaseFromPlan(projectId, plan.id, testCaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plan', projectId, plan.id] })
    },
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'ACTIVE':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
      case 'REVIEWED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      case 'CLOSED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const statusOptions = [
    { value: 'DRAFT', label: 'Draft' },
    { value: 'REVIEWED', label: 'Reviewed' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'CLOSED', label: 'Closed' },
  ]

  const currentPlan = planDetails || plan
  const planCases = currentPlan?.planCases || []

  // Get test cases not in plan
  const availableCases = allTestCases.filter(
    (tc: any) => !planCases.some((pc: any) => pc.testCaseId === tc.id)
  )

  useEffect(() => {
    if (currentPlan) {
      setEditData({
        name: currentPlan.name || '',
        description: currentPlan.description || '',
        scope: currentPlan.scope || '',
        entryCriteria: currentPlan.entryCriteria || '',
        exitCriteria: currentPlan.exitCriteria || '',
        phase: currentPlan.phase || '',
      })
    }
  }, [currentPlan])

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
    updatePlanMutation.mutate(editData)
  }

  if (!isOpen || !plan) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-800 w-full max-w-2xl h-full overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-gray-500">{currentPlan?.key}</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(currentPlan?.status || 'DRAFT')}`}>
                {currentPlan?.status || 'DRAFT'}
              </span>
            </div>
            {isEditing ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-500 focus:outline-none w-full"
              />
            ) : (
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{currentPlan?.name}</h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                {currentPlan?.status === 'APPROVED' && (
                  <button
                    onClick={() => closePlanMutation.mutate()}
                    disabled={closePlanMutation.isPending}
                    className="px-3 py-1.5 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
                  >
                    Close Plan
                  </button>
                )}
                {currentPlan?.status === 'REVIEWED' && (
                  <button
                    onClick={() => approvePlanMutation.mutate()}
                    disabled={approvePlanMutation.isPending}
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
                    setEditData({
                      name: currentPlan?.name || '',
                      description: currentPlan?.description || '',
                      scope: currentPlan?.scope || '',
                      entryCriteria: currentPlan?.entryCriteria || '',
                      exitCriteria: currentPlan?.exitCriteria || '',
                      phase: currentPlan?.phase || '',
                    })
                  }}
                  className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={updatePlanMutation.isPending}
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

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 px-6">
          <div className="flex gap-4">
            {(['overview', 'cases', 'activity'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Status */}
              <div className="relative" ref={statusDropdownRef}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  className={`w-full px-4 py-2 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between ${getStatusColor(currentPlan?.status || 'DRAFT')}`}
                >
                  <span>{statusOptions.find((opt) => opt.value === currentPlan?.status)?.label || currentPlan?.status}</span>
                  <ChevronDown size={16} className="ml-2" />
                </button>
                {statusDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
                    {statusOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          updatePlanMutation.mutate({ status: option.value })
                          setStatusDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 ${
                          currentPlan?.status === option.value ? 'font-semibold bg-blue-50 dark:bg-blue-900/20' : ''
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                {isEditing ? (
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentPlan?.description || 'No description'}</p>
                )}
              </div>

              {/* Scope */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Scope
                </label>
                {isEditing ? (
                  <textarea
                    value={editData.scope}
                    onChange={(e) => setEditData({ ...editData, scope: e.target.value })}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentPlan?.scope || 'No scope defined'}</p>
                )}
              </div>

              {/* Entry Criteria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Entry Criteria
                </label>
                {isEditing ? (
                  <textarea
                    value={editData.entryCriteria}
                    onChange={(e) => setEditData({ ...editData, entryCriteria: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentPlan?.entryCriteria || 'No entry criteria'}</p>
                )}
              </div>

              {/* Exit Criteria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exit Criteria
                </label>
                {isEditing ? (
                  <textarea
                    value={editData.exitCriteria}
                    onChange={(e) => setEditData({ ...editData, exitCriteria: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentPlan?.exitCriteria || 'No exit criteria'}</p>
                )}
              </div>

              {/* Phase */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phase
                </label>
                {isEditing ? (
                  <CustomDropdown
                    value={editData.phase}
                    onChange={(value) => setEditData({ ...editData, phase: value })}
                    optionType="PHASE"
                    projectId={projectId}
                    placeholder="Select phase"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">{currentPlan?.phase || 'No phase specified'}</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'cases' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Test Cases ({planCases.length})
                </h3>
                {availableCases.length > 0 && (
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addCaseMutation.mutate(e.target.value)
                        e.target.value = ''
                      }
                    }}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Add test case...</option>
                    {availableCases.map((tc: any) => (
                      <option key={tc.id} value={tc.id}>
                        {tc.key}: {tc.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {planCases.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">No test cases in this plan</p>
              ) : (
                <div className="space-y-2">
                  {planCases.map((planCase: any, index: number) => (
                    <div
                      key={planCase.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                    >
                      <GripVertical className="text-gray-400" size={16} />
                      <span className="text-sm text-gray-500 dark:text-gray-400">{index + 1}.</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {planCase.testCase?.key || 'Unknown'}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          {planCase.testCase?.title || 'Unknown test case'}
                        </div>
                      </div>
                      <button
                        onClick={() => removeCaseMutation.mutate(planCase.testCaseId)}
                        disabled={removeCaseMutation.isPending}
                        className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <p className="text-gray-500 dark:text-gray-400 text-center py-8">Activity log coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
