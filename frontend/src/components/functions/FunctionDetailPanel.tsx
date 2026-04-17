import { useState } from 'react'
import FunctionTraceabilityTab from './FunctionTraceabilityTab'
import {
  Edit2,
  Trash2,
  Save,
  X,
  AlertCircle,
  FileText,
  Link2,
  ChevronRight,
  GitBranch,
  Shield,
  Layers,
  Plus,
  ClipboardList,
  TestTube2,
} from 'lucide-react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { functionService } from '../../services/function.service'
import { verificationService } from '../../services/verification.service'
import ParameterTextRenderer from './ParameterTextRenderer'
import type { SystemFunction, FunctionCriticality } from 'shared/types/engineering.types'
import type { Issue } from 'shared/types/engineering.types'
import type { ChangeRequest } from 'shared/types/engineering.types'
import {
  FUNCTION_LEVEL_STYLES,
  FUNCTION_STATUS_OPTIONS,
  FUNCTION_CRITICALITY_OPTIONS,
} from '../../config/functionsTabs'

interface FunctionDetailPanelProps {
  func: SystemFunction
  allFunctions: SystemFunction[]
  projectId: string
  issues: Issue[]
  changeRequests: ChangeRequest[]
  onRaiseIssue: (funcId: string) => void
  onCreateChangeRequest: (funcId: string, funcName: string) => void
  onDelete: (func: SystemFunction) => void
  onAddChild: (parentId: string) => void
  onSelectFunction: (id: string) => void
}

const LEVEL_STYLES = FUNCTION_LEVEL_STYLES
const STATUS_OPTIONS = FUNCTION_STATUS_OPTIONS
const CRITICALITY_OPTIONS = FUNCTION_CRITICALITY_OPTIONS

export default function FunctionDetailPanel({
  func,
  allFunctions,
  projectId,
  issues,
  changeRequests,
  onRaiseIssue,
  onCreateChangeRequest,
  onDelete,
  onAddChild,
  onSelectFunction,
}: FunctionDetailPanelProps) {
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState<Partial<SystemFunction>>({})
  const [activeTab, setActiveTab] = useState<'details' | 'links' | 'hierarchy'>('details')

  type TestPlanRow = { id: string; key: string; name: string; status: string }
  type TestCaseRow = { id: string; key: string; title: string; status: string }

  // Fetch test plans and test cases for verification method
  const { data: testPlans = [] } = useQuery<TestPlanRow[]>({
    queryKey: ['test-plans', projectId],
    queryFn: async () => {
      const res = await verificationService.getTestPlans(projectId)
      return (res.success && res.data ? res.data : []) as TestPlanRow[]
    },
    enabled: !!projectId,
  })

  const { data: testCases = [] } = useQuery<TestCaseRow[]>({
    queryKey: ['test-cases', projectId],
    queryFn: async () => {
      const res = await verificationService.getTestCases(projectId)
      return (res.success && res.data ? res.data : []) as TestCaseRow[]
    },
    enabled: !!projectId,
  })

  // Parse verification method to detect linked test plans/cases
  const parseVerificationMethod = (method?: string) => {
    if (!method) return { type: 'none' as const, label: '—' }
    if (method.startsWith('TP::')) {
      const parts = method.split('::')
      const plan = testPlans.find((p) => p.id === parts[1])
      return { type: 'test-plan' as const, id: parts[1], key: parts[2], label: plan ? `${plan.key} — ${plan.name}` : parts[2] }
    }
    if (method.startsWith('TC::')) {
      const parts = method.split('::')
      const tc = testCases.find((c) => c.id === parts[1])
      return { type: 'test-case' as const, id: parts[1], key: parts[2], label: tc ? `${tc.key} — ${tc.title}` : parts[2] }
    }
    return { type: 'standard' as const, label: method }
  }

  const level = func.level ?? 0
  const levelStyle = LEVEL_STYLES[Math.min(level, LEVEL_STYLES.length - 1)]
  const LevelIcon = levelStyle.icon

  // Linked elements
  const linkedIssues = issues.filter(i => i.relatedFunctionIds?.includes(func.id))
  const linkedCRs = changeRequests.filter(cr => cr.sourceType === 'function' && cr.sourceId === func.id)
  const childFunctions = allFunctions.filter(f => f.parentId === func.id)
  const parentFunction = func.parentId ? allFunctions.find(f => f.id === func.parentId) : null
  const siblingFunctions = allFunctions.filter(f => f.parentId === func.parentId && f.id !== func.id)

  // Breadcrumb path
  const getBreadcrumbPath = () => {
    const path: SystemFunction[] = []
    let current: SystemFunction | undefined = func
    while (current) {
      path.unshift(current)
      current = current.parentId ? allFunctions.find(f => f.id === current!.parentId) : undefined
    }
    return path
  }
  const breadcrumb = getBreadcrumbPath()

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SystemFunction>) => functionService.updateFunction(projectId, func.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['functions', projectId] })
      setIsEditing(false)
      setEditData({})
    },
  })

  const startEdit = () => {
    setEditData({
      name: func.name,
      description: func.description,
      status: func.status,
      owner: func.owner,
      verificationMethod: func.verificationMethod,
      criticality: func.criticality,
      pbsComponentId: func.pbsComponentId,
      allocatedTo: func.allocatedTo,
    })
    setIsEditing(true)
  }

  const handleSave = () => {
    updateMutation.mutate(editData)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditData({})
  }

  const getStatusInfo = (status?: string) => STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0]
  const getCriticalityInfo = (crit?: string) => CRITICALITY_OPTIONS.find(c => c.value === crit) || CRITICALITY_OPTIONS[1]

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 overflow-hidden">
      {/* Header with breadcrumb */}
      <div className="flex-shrink-0 border-b border-gray-200 dark:border-gray-700">
        {/* Breadcrumb */}
        {breadcrumb.length > 1 && (
          <div className="px-6 pt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 overflow-x-auto">
            {breadcrumb.map((item, idx) => (
              <span key={item.id} className="flex items-center gap-1 whitespace-nowrap">
                {idx > 0 && <ChevronRight size={10} className="text-gray-300 dark:text-gray-600" />}
                <button
                  onClick={() => onSelectFunction(item.id)}
                  className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${
                    item.id === func.id ? 'text-gray-800 dark:text-gray-200 font-medium' : ''
                  }`}
                >
                  {item.functionId || item.name}
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Title row */}
        <div className="px-6 py-4 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${levelStyle.bg} flex items-center justify-center`}>
                <LevelIcon size={16} className={levelStyle.color} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-gray-500 dark:text-gray-400">
                    {func.functionId || 'FUNC'}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${levelStyle.bg} ${levelStyle.color}`}>
                    {levelStyle.label}
                  </span>
                </div>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={e => setEditData(d => ({ ...d, name: e.target.value }))}
                    className="mt-1 text-lg font-bold text-gray-900 dark:text-white bg-transparent border-b-2 border-blue-400 focus:outline-none w-full"
                  />
                ) : (
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">{func.name}</h2>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancel}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50"
                  title="Save"
                >
                  <Save size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => onAddChild(func.id)}
                  className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                  title="Add sub-function"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => onRaiseIssue(func.id)}
                  className="p-2 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 text-orange-600 dark:text-orange-400 transition-colors"
                  title="Raise issue"
                >
                  <AlertCircle size={16} />
                </button>
                <button
                  onClick={() => onCreateChangeRequest(func.id, `${func.functionId}: ${func.name}`)}
                  className="p-2 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors"
                  title="Create change request"
                >
                  <GitBranch size={16} />
                </button>
                <button
                  onClick={startEdit}
                  className="p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 transition-colors"
                  title="Edit function"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => onDelete(func)}
                  className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
                  title="Delete function"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="px-6 pb-3 flex items-center gap-2 flex-wrap">
          {isEditing ? (
            <>
              <select
                value={editData.status || 'draft'}
                onChange={e =>
                  setEditData(d => ({
                    ...d,
                    status: e.target.value as NonNullable<SystemFunction['status']>,
                  }))
                }
                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <select
                value={editData.criticality || 'medium'}
                onChange={e => setEditData(d => ({ ...d, criticality: e.target.value as FunctionCriticality }))}
                className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {CRITICALITY_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusInfo(func.status).color}`}>
                {getStatusInfo(func.status).label}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${getCriticalityInfo(func.criticality).color}`}>
                <Shield size={10} className="inline mr-1" />
                {getCriticalityInfo(func.criticality).label} Criticality
              </span>
              {func.owner && (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                  Owner: {func.owner}
                </span>
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        <div className="px-6 flex gap-0 border-t border-gray-100 dark:border-gray-700/50">
          {([
            { id: 'details' as const, label: 'Details', icon: FileText },
            { id: 'links' as const, label: `Links (${linkedIssues.length + linkedCRs.length})`, icon: Link2 },
            { id: 'hierarchy' as const, label: `Hierarchy (${childFunctions.length})`, icon: Layers },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'details' && (
          <div className="space-y-6">
            {/* Description */}
            <section>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Description</h4>
              {isEditing ? (
                <textarea
                  value={editData.description || ''}
                  onChange={e => setEditData(d => ({ ...d, description: e.target.value }))}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="Describe the function's purpose, behavior, inputs, and outputs..."
                />
              ) : (
                <div className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 whitespace-pre-wrap border border-gray-100 dark:border-gray-700/50">
                  {func.description ? (
                    <ParameterTextRenderer text={func.description} projectId={projectId} />
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500 italic">No description provided.</span>
                  )}
                </div>
              )}
            </section>

            {/* Properties grid */}
            <section>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Properties</h4>
              <div className="grid grid-cols-2 gap-4">
                {/* Owner */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Owner</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.owner || ''}
                      onChange={e => setEditData(d => ({ ...d, owner: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Assign owner"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{func.owner || '—'}</p>
                  )}
                </div>

                {/* Verification Method */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Verification Method</label>
                  {isEditing ? (
                    <select
                      value={editData.verificationMethod || ''}
                      onChange={e => setEditData(d => ({ ...d, verificationMethod: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    >
                      <option value="">Select method</option>
                      <optgroup label="Standard Methods">
                        <option value="Analysis">Analysis</option>
                        <option value="Inspection">Inspection</option>
                        <option value="Demonstration">Demonstration</option>
                        <option value="Review">Review</option>
                        <option value="Simulation">Simulation</option>
                      </optgroup>
                      {testPlans.length > 0 && (
                        <optgroup label="Test Plans">
                          {testPlans.map((tp) => (
                            <option key={tp.id} value={`TP::${tp.id}::${tp.key}`}>
                              {tp.key} — {tp.name}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {testCases.length > 0 && (
                        <optgroup label="Test Cases">
                          {testCases.map((tc) => (
                            <option key={tc.id} value={`TC::${tc.id}::${tc.key}`}>
                              {tc.key} — {tc.title}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  ) : (
                    (() => {
                      const vm = parseVerificationMethod(func.verificationMethod)
                      if (vm.type === 'none') return <p className="text-sm font-medium text-gray-900 dark:text-white">—</p>
                      if (vm.type === 'test-plan') return (
                        <div className="flex items-center gap-1.5">
                          <ClipboardList size={14} className="text-blue-500 flex-shrink-0" />
                          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 cursor-pointer hover:underline" title={`Test Plan: ${vm.label}`}>
                            {vm.label}
                          </p>
                        </div>
                      )
                      if (vm.type === 'test-case') return (
                        <div className="flex items-center gap-1.5">
                          <TestTube2 size={14} className="text-purple-500 flex-shrink-0" />
                          <p className="text-sm font-medium text-purple-600 dark:text-purple-400 cursor-pointer hover:underline" title={`Test Case: ${vm.label}`}>
                            {vm.label}
                          </p>
                        </div>
                      )
                      return <p className="text-sm font-medium text-gray-900 dark:text-white">{vm.label}</p>
                    })()
                  )}
                </div>

                {/* PBS Component */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">PBS Component</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.pbsComponentId || ''}
                      onChange={e => setEditData(d => ({ ...d, pbsComponentId: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Link to PBS component"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {func.pbsComponentId ? (
                        <span className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                          {func.pbsComponentId}
                        </span>
                      ) : '—'}
                    </p>
                  )}
                </div>

                {/* Allocated To */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Allocated To</label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editData.allocatedTo || ''}
                      onChange={e => setEditData(d => ({ ...d, allocatedTo: e.target.value }))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="e.g., Subsystem, Team"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{func.allocatedTo || '—'}</p>
                  )}
                </div>

                {/* Source Requirement */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Source Requirement</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{func.sourceReqId || '—'}</p>
                </div>

                {/* Level */}
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 border border-gray-100 dark:border-gray-700/50">
                  <label className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Hierarchy Level</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">Level {level}</p>
                </div>
              </div>
            </section>

            {/* Timestamps */}
            <section>
              <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Audit Information</h4>
              <div className="flex gap-6 text-xs text-gray-500 dark:text-gray-400">
                <span>Created: {new Date(func.createdAt).toLocaleDateString()}</span>
                <span>Updated: {new Date(func.updatedAt).toLocaleDateString()}</span>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'links' && (
          <FunctionTraceabilityTab funcId={func.id} projectId={projectId} />
        )}

        {activeTab === 'hierarchy' && (
          <div className="space-y-6">
            {/* Parent */}
            {parentFunction && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ChevronRight size={13} className="rotate-[-90deg]" />
                  Parent Function
                </h4>
                <button
                  onClick={() => onSelectFunction(parentFunction.id)}
                  className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-colors text-left"
                >
                  <div className={`w-8 h-8 rounded-lg ${LEVEL_STYLES[Math.min(parentFunction.level ?? 0, LEVEL_STYLES.length - 1)].bg} flex items-center justify-center`}>
                    {(() => {
                      const ParentIcon = LEVEL_STYLES[Math.min(parentFunction.level ?? 0, LEVEL_STYLES.length - 1)].icon
                      return <ParentIcon size={14} className={LEVEL_STYLES[Math.min(parentFunction.level ?? 0, LEVEL_STYLES.length - 1)].color} />
                    })()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-500 dark:text-gray-400">{parentFunction.functionId}</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{parentFunction.name}</p>
                  </div>
                </button>
              </section>
            )}

            {/* Children */}
            <section>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ChevronRight size={13} className="rotate-90" />
                  Sub-Functions ({childFunctions.length})
                </h4>
                <button
                  onClick={() => onAddChild(func.id)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Add Sub-Function
                </button>
              </div>
              {childFunctions.length === 0 ? (
                <div className="text-center py-8">
                  <Layers size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
                  <p className="text-sm text-gray-400 dark:text-gray-500">No sub-functions defined.</p>
                  <button
                    onClick={() => onAddChild(func.id)}
                    className="mt-2 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Add the first sub-function
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {childFunctions.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(child => {
                    const childLevel = child.level ?? 0
                    const childStyle = LEVEL_STYLES[Math.min(childLevel, LEVEL_STYLES.length - 1)]
                    const ChildIcon = childStyle.icon
                    const childStatusInfo = getStatusInfo(child.status)
                    return (
                      <button
                        key={child.id}
                        onClick={() => onSelectFunction(child.id)}
                        className="w-full flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700/50 hover:border-blue-300 dark:hover:border-blue-600 transition-colors text-left group"
                      >
                        <div className={`w-8 h-8 rounded-lg ${childStyle.bg} flex items-center justify-center flex-shrink-0`}>
                          <ChildIcon size={14} className={childStyle.color} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">{child.functionId}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${childStatusInfo.color}`}>
                              {childStatusInfo.label}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{child.name}</p>
                        </div>
                        <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                      </button>
                    )
                  })}
                </div>
              )}
            </section>

            {/* Siblings */}
            {siblingFunctions.length > 0 && (
              <section>
                <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  Sibling Functions ({siblingFunctions.length})
                </h4>
                <div className="space-y-1.5">
                  {siblingFunctions.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)).map(sibling => (
                    <button
                      key={sibling.id}
                      onClick={() => onSelectFunction(sibling.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left transition-colors"
                    >
                      <span className="text-xs font-mono text-gray-400 dark:text-gray-500">{sibling.functionId}</span>
                      <span className="text-gray-700 dark:text-gray-300 truncate">{sibling.name}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
