import { useState } from 'react'
import TaskNavigation from '../../../components/tasks/TaskNavigation'
import {
  Workflow,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  ChevronRight,
  Zap,
  GitBranch,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MoreVertical,
  X,
  ArrowRight,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../../../services/api'

interface AutomationRule {
  id: string
  name: string
  triggerType: string
  conditionsJson?: string
  actionsJson?: string
  enabled?: boolean
  createdAt?: string
}

interface AutomationRun {
  id: string
  ruleId: string
  taskId: string
  status: string
  executedAt: string
  rule?: { name?: string }
}

const STATUS_FLOW = [
  { id: 'BACKLOG', label: 'Backlog', color: 'bg-gray-400' },
  { id: 'TODO', label: 'To Do', color: 'bg-blue-500' },
  { id: 'IN_PROGRESS', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'IN_REVIEW', label: 'In Review', color: 'bg-purple-500' },
  { id: 'DONE', label: 'Done', color: 'bg-green-500' },
]

const TRIGGER_LABELS: Record<string, string> = {
  status_change: 'Status Change',
  assignment: 'Assignment',
  due_date: 'Due Date',
  priority_change: 'Priority Change',
  comment: 'New Comment',
  creation: 'Task Created',
}

type TabId = 'workflow' | 'automation' | 'runs'

export default function TaskWorkflowsPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<TabId>('workflow')
  const [showCreateRule, setShowCreateRule] = useState(false)
  const [ruleForm, setRuleForm] = useState({ name: '', triggerType: 'status_change', conditions: '', actions: '' })

  const { data: rules } = useQuery<AutomationRule[]>({
    queryKey: ['automation-rules'],
    queryFn: async () => {
      const res = await apiClient.get<AutomationRule[] | unknown>('/automation/rules')
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: activeTab === 'automation' || activeTab === 'runs',
  })

  const { data: runs } = useQuery<AutomationRun[]>({
    queryKey: ['automation-runs'],
    queryFn: async () => {
      const res = await apiClient.get<AutomationRun[] | unknown>('/automation/runs')
      return Array.isArray(res.data) ? res.data : []
    },
    enabled: activeTab === 'runs',
  })

  const createRuleMutation = useMutation({
    mutationFn: async (data: { name: string; trigger_type: string; conditions_json: string; actions_json: string }) => {
      return apiClient.post('/automation/rules', data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
      setShowCreateRule(false)
      setRuleForm({ name: '', triggerType: 'status_change', conditions: '', actions: '' })
    },
  })

  const rulesList = rules || []
  const runsList = runs || []

  const tabs: { id: TabId; label: string; icon: typeof Workflow }[] = [
    { id: 'workflow', label: 'Status Flow', icon: GitBranch },
    { id: 'automation', label: 'Automation Rules', icon: Zap },
    { id: 'runs', label: 'Run History', icon: Play },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <TaskNavigation />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
              <Workflow size={18} className="text-emerald-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Workflows & Automation</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Manage status flows and task automation rules</p>
            </div>
          </div>
          {activeTab === 'automation' && (
            <button
              onClick={() => setShowCreateRule(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-sm"
            >
              <Plus size={13} /> New Rule
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5 w-fit">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  activeTab === tab.id ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                <Icon size={12} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* WORKFLOW / Status Flow */}
        {activeTab === 'workflow' && (
          <div className="space-y-6">
            {/* Visual Flow */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-6">Default Task Status Flow</h3>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {STATUS_FLOW.map((status, i) => (
                  <div key={status.id} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-20 h-20 rounded-xl ${status.color} flex items-center justify-center shadow-sm`}>
                        {status.id === 'DONE' ? (
                          <CheckCircle2 size={24} className="text-white" />
                        ) : status.id === 'IN_PROGRESS' ? (
                          <Clock size={24} className="text-white" />
                        ) : (
                          <div className="w-3 h-3 bg-white rounded-full" />
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-gray-700 dark:text-gray-300">{status.label}</span>
                    </div>
                    {i < STATUS_FLOW.length - 1 && (
                      <ArrowRight size={16} className="text-gray-300 dark:text-gray-600 mx-1" />
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-gray-400 text-center mt-6">
                Tasks progress through these states. Transitions can be customized per project.
              </p>
            </div>

            {/* Transition Rules */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Transition Rules</h3>
              <div className="space-y-2">
                {[
                  { from: 'BACKLOG', to: 'TODO', rule: 'Any team member can move tasks from Backlog to To Do' },
                  { from: 'TODO', to: 'IN_PROGRESS', rule: 'Assign the task before moving to In Progress' },
                  { from: 'IN_PROGRESS', to: 'IN_REVIEW', rule: 'Requires completion of all subtasks' },
                  { from: 'IN_REVIEW', to: 'DONE', rule: 'Requires approval from reviewer' },
                  { from: 'Any', to: 'BACKLOG', rule: 'Tasks can be moved back to Backlog at any time' },
                ].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        t.from === 'Any' ? 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      }`}>{t.from}</span>
                      <ArrowRight size={10} className="text-gray-400" />
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">{t.to}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t.rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* AUTOMATION */}
        {activeTab === 'automation' && (
          <div className="space-y-4">
            {rulesList.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-10 text-center">
                <Zap size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No automation rules yet</p>
                <p className="text-xs text-gray-400 mt-1">Create rules to automate repetitive task actions</p>
                <button
                  onClick={() => setShowCreateRule(true)}
                  className="mt-4 px-4 py-2 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
                  Create First Rule
                </button>
              </div>
            ) : (
              rulesList.map((rule) => (
                <div key={rule.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 flex items-start justify-between group hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${rule.enabled !== false ? 'bg-green-50 dark:bg-green-900/30' : 'bg-gray-100 dark:bg-gray-700'}`}>
                      <Zap size={14} className={rule.enabled !== false ? 'text-green-500' : 'text-gray-400'} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{rule.name}</h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Trigger: <span className="font-medium text-gray-700 dark:text-gray-300">{TRIGGER_LABELS[rule.triggerType] || rule.triggerType}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      rule.enabled !== false ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                    }`}>
                      {rule.enabled !== false ? 'ACTIVE' : 'DISABLED'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* RUNS */}
        {activeTab === 'runs' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Automation Run History</h3>
            </div>
            {runsList.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">No automation runs recorded</div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-700">
                    <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Rule</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-gray-500 uppercase">Executed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {runsList.slice(0, 20).map((run) => (
                    <tr key={run.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-5 py-3 text-xs text-gray-900 dark:text-white font-medium">{run.rule?.name || run.ruleId}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          run.status === 'success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          run.status === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                        }`}>
                          {run.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right text-xs text-gray-500">{new Date(run.executedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Create Rule Modal */}
      {showCreateRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCreateRule(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">New Automation Rule</h3>
              <button onClick={() => setShowCreateRule(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Rule Name</label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm({ ...ruleForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                  placeholder="e.g. Auto-assign on status change"
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Trigger Type</label>
                <select
                  value={ruleForm.triggerType}
                  onChange={(e) => setRuleForm({ ...ruleForm, triggerType: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white"
                >
                  {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Conditions (JSON)</label>
                <textarea
                  value={ruleForm.conditions}
                  onChange={(e) => setRuleForm({ ...ruleForm, conditions: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono resize-none"
                  rows={2}
                  placeholder='{"status": "IN_PROGRESS"}'
                />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase mb-1 block">Actions (JSON)</label>
                <textarea
                  value={ruleForm.actions}
                  onChange={(e) => setRuleForm({ ...ruleForm, actions: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white font-mono resize-none"
                  rows={2}
                  placeholder='{"notify": true}'
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowCreateRule(false)} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 dark:text-gray-400">Cancel</button>
              <button
                onClick={() => createRuleMutation.mutate({
                  name: ruleForm.name,
                  trigger_type: ruleForm.triggerType,
                  conditions_json: ruleForm.conditions || '{}',
                  actions_json: ruleForm.actions || '{}',
                })}
                disabled={!ruleForm.name}
                className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              >
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
