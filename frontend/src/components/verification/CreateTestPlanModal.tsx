import React, { useState } from 'react'
import { X, Search, CheckSquare, Square } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { verificationService } from '../../services/verification.service'
import { requirementService } from '../../services/requirement.service'
import { functionService } from '../../services/function.service'
import CustomDropdown from './CustomDropdown'
import clsx from 'clsx'

interface CreateTestPlanModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
}

export default function CreateTestPlanModal({ isOpen, onClose, projectId }: CreateTestPlanModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'cases' | 'verifies'>('general')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scope: '',
    entryCriteria: '',
    exitCriteria: '',
    phase: '',
    ownerUserId: '',
  })

  // Selection State
  const [selectedTestCaseIds, setSelectedTestCaseIds] = useState<Set<string>>(new Set())
  const [selectedLinks, setSelectedLinks] = useState<{ type: 'requirement' | 'function'; id: string }[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  const queryClient = useQueryClient()

  // Queries
  const { data: testCases = [] } = useQuery({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      const res = await verificationService.getTestCases(projectId)
      return res.success ? res.data : []
    },
    enabled: isOpen,
  })

  const { data: requirements = [] } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const res = await requirementService.getRequirements(projectId)
      return res.success ? res.data : []
    },
    enabled: isOpen,
  })

  const { data: functions = [] } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const res = await functionService.getFunctions(projectId)
      return res.success ? res.data : []
    },
    enabled: isOpen,
  })

  // Combine requirements and functions for "Verifies" tab
  const verifyTargets = [
    ...requirements.map((r: any) => ({ ...r, type: 'requirement', label: r.title, identifier: r.requirementId })),
    ...functions.map((f: any) => ({ ...f, type: 'function', label: f.name, identifier: f.functionId })),
  ].filter(target => {
    if (!searchTerm) return true
    const term = searchTerm.toLowerCase()
    return (
      (target.label?.toLowerCase() || '').includes(term) ||
      (target.identifier?.toLowerCase() || '').includes(term)
    )
  })

  const createPlanMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // 1. Create Plan
      const res = await verificationService.createTestPlan(projectId, data)
      if (!res.success) throw new Error(res.error)
      const planId = res.data.id

      // 2. Add Test Cases
      for (const tcId of selectedTestCaseIds) {
        await verificationService.addCaseToPlan(projectId, planId, tcId)
      }

      // 3. Link Verification Elements
      for (const link of selectedLinks) {
        await verificationService.linkTestPlanVerificationElement(projectId, planId, link.type, link.id)
      }

      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['test-plans', projectId] })
      queryClient.invalidateQueries({ queryKey: ['verification-overview', projectId] })
      onClose()
      // Reset form
      setFormData({
        name: '',
        description: '',
        scope: '',
        entryCriteria: '',
        exitCriteria: '',
        phase: '',
        ownerUserId: '',
      })
      setSelectedTestCaseIds(new Set())
      setSelectedLinks([])
      setActiveTab('general')
      setSearchTerm('')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    createPlanMutation.mutate(formData)
  }

  const toggleTestCase = (id: string) => {
    const next = new Set(selectedTestCaseIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedTestCaseIds(next)
  }

  const toggleLink = (type: 'requirement' | 'function', id: string) => {
    const exists = selectedLinks.some(l => l.type === type && l.id === id)
    if (exists) {
      setSelectedLinks(selectedLinks.filter(l => !(l.type === type && l.id === id)))
    } else {
      setSelectedLinks([...selectedLinks, { type, id }])
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Create Test Plan</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6">
          {(['general', 'cases', 'verifies'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx(
                'px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2',
                activeTab === tab
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
              )}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'cases' && selectedTestCaseIds.size > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">{selectedTestCaseIds.size}</span>
              )}
              {tab === 'verifies' && selectedLinks.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs">{selectedLinks.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <form id="create-plan-form" onSubmit={handleSubmit} className="space-y-6">

            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., Master Verification Plan"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phase
                    </label>
                    <CustomDropdown
                      value={formData.phase}
                      onChange={(value) => setFormData({ ...formData, phase: value })}
                      optionType="PHASE"
                      projectId={projectId}
                      placeholder="Select phase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Owner User ID
                    </label>
                    <input
                      type="text"
                      value={formData.ownerUserId}
                      onChange={(e) => setFormData({ ...formData, ownerUserId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="Describe the purpose of this test plan..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Scope
                  </label>
                  <textarea
                    rows={2}
                    value={formData.scope}
                    onChange={(e) => setFormData({ ...formData, scope: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                    placeholder="What is in and out of scope?"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Entry Criteria
                    </label>
                    <textarea
                      rows={2}
                      value={formData.entryCriteria}
                      onChange={(e) => setFormData({ ...formData, entryCriteria: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      placeholder="Conditions to start testing..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Exit Criteria
                    </label>
                    <textarea
                      rows={2}
                      value={formData.exitCriteria}
                      onChange={(e) => setFormData({ ...formData, exitCriteria: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      placeholder="Conditions to complete testing..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Test Cases Tab */}
            {activeTab === 'cases' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select test cases to include in this plan.
                  </p>
                </div>

                {testCases.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    No test cases found in this project.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {testCases.map((tc: any) => (
                      <div
                        key={tc.id}
                        onClick={() => toggleTestCase(tc.id)}
                        className={clsx(
                          "cursor-pointer flex items-center p-3 rounded-lg border transition-colors",
                          selectedTestCaseIds.has(tc.id)
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                        )}
                      >
                        <div className={clsx("mr-3", selectedTestCaseIds.has(tc.id) ? "text-blue-600 dark:text-blue-400" : "text-gray-400")}>
                          {selectedTestCaseIds.has(tc.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{tc.key}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{tc.title}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Verifies Tab */}
            {activeTab === 'verifies' && (
              <div className="space-y-4">
                <div className="flex flex-col gap-4 mb-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select requirements or functions this plan verifies.
                  </p>

                  {/* Search input for verifies tab */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="text"
                      placeholder="Search requirements or functions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>

                {verifyTargets.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-700">
                    No matching requirements or functions found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2 max-h-[400px] overflow-y-auto pr-2">
                    {verifyTargets.map((target: any) => {
                      const isSelected = selectedLinks.some(l => l.type === target.type && l.id === target.id)
                      return (
                        <div
                          key={`${target.type}-${target.id}`}
                          onClick={() => toggleLink(target.type, target.id)}
                          className={clsx(
                            "cursor-pointer flex items-center p-3 rounded-lg border transition-colors",
                            isSelected
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          )}
                        >
                          <div className={clsx("mr-3", isSelected ? "text-blue-600 dark:text-blue-400" : "text-gray-400")}>
                            {isSelected ? <CheckSquare size={20} /> : <Square size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={clsx(
                                "text-xs px-2 py-0.5 rounded font-medium flex-shrink-0",
                                target.type === 'requirement'
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              )}>
                                {target.type === 'requirement' ? 'REQ' : 'FUNC'}
                              </span>
                              <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{target.identifier}</span>
                            </div>
                            <div className="text-sm text-gray-900 dark:text-white truncate" title={target.label}>{target.label}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

          </form>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3 bg-gray-50 dark:bg-gray-800/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="create-plan-form"
            disabled={createPlanMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createPlanMutation.isPending ? 'Creating...' : 'Create Test Plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
