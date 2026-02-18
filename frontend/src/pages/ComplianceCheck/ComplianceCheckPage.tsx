import { useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  ShieldCheck,
  FileCheck,
  AlertCircle,
  Plus,
  Trash2,
  Play,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import { complianceService, CHECK_TYPES } from '../../services/compliance.service'
import { format } from 'date-fns'
import clsx from 'clsx'

type Tab = 'rules' | 'runs' | 'findings'

export default function ComplianceCheckPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('rules')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [runIdFilter, setRunIdFilter] = useState<string>('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ['compliance-rules', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const r = await complianceService.getRules(projectId)
      if (r.success && r.data) return r.data
      throw new Error(r.error || 'Failed to load rules')
    },
    enabled: !!projectId,
  })

  const { data: runs = [], isLoading: runsLoading } = useQuery({
    queryKey: ['compliance-runs', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const r = await complianceService.getRuns(projectId)
      if (r.success && r.data) return r.data
      throw new Error(r.error || 'Failed to load runs')
    },
    enabled: !!projectId && (activeTab === 'runs' || activeTab === 'findings'),
  })

  const { data: findings = [], isLoading: findingsLoading } = useQuery({
    queryKey: ['compliance-findings', projectId, runIdFilter || 'all'],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const r = await complianceService.getFindings(projectId, runIdFilter ? { runId: runIdFilter } : undefined)
      if (r.success && r.data) return r.data
      throw new Error(r.error || 'Failed to load findings')
    },
    enabled: !!projectId && activeTab === 'findings',
  })

  const createRuleMutation = useMutation({
    mutationFn: async (data: { name: string; standard: string; description?: string; checkType: string }) => {
      if (!projectId) throw new Error('Project ID required')
      return complianceService.createRule(projectId, data)
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['compliance-rules', projectId] })
        setCreateModalOpen(false)
      } else {
        alert(res.error || 'Failed to create rule')
      }
    },
    onError: (e: Error) => alert(e.message || 'Failed to create rule'),
  })

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('Project ID required')
      return complianceService.deleteRule(projectId, id)
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['compliance-rules', projectId] })
        setDeleteRuleId(null)
      } else {
        alert(res.error || 'Failed to delete rule')
      }
    },
    onError: (e: Error) => alert(e.message || 'Failed to delete rule'),
  })

  const runChecksMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      return complianceService.runChecks(projectId, {
        name: `Run ${format(new Date(), 'yyyy-MM-dd HH:mm')}`,
      })
    },
    onSuccess: (res) => {
      if (res.success && res.data) {
        queryClient.invalidateQueries({ queryKey: ['compliance-runs', projectId] })
        queryClient.invalidateQueries({ queryKey: ['compliance-findings', projectId] })
        setRunIdFilter(res.data.run.id)
        setActiveTab('findings')
      } else {
        alert(res.error || 'Run failed')
      }
    },
    onError: (e: Error) => alert(e.message || 'Run failed'),
  })

  const tabs: { id: Tab; label: string; icon: typeof FileCheck }[] = [
    { id: 'rules', label: 'Standards & Rules', icon: FileCheck },
    { id: 'runs', label: 'Run checks', icon: ShieldCheck },
    { id: 'findings', label: 'Findings & Reports', icon: AlertCircle },
  ]

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Compliance Check</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Run and track compliance checks against requirements, standards, and regulations.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
              activeTab === t.id
                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            )}
          >
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'rules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Rules</h2>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={16} />
              Add rule
            </button>
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {rulesLoading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading rules…</div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No rules yet. Add a rule to run compliance checks.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {rules.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                      <span className="mx-2 text-gray-400">·</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">{r.standard}</span>
                      {r.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{r.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {!r.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                      <button
                        onClick={() => setDeleteRuleId(r.id)}
                        className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="Delete rule"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Check runs</h2>
            <button
              onClick={() => runChecksMutation.mutate()}
              disabled={runChecksMutation.isPending || rules.length === 0}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play size={16} />
              {runChecksMutation.isPending ? 'Running…' : 'Run check'}
            </button>
          </div>
          {rules.length === 0 && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Add at least one rule before running a check.
            </p>
          )}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            {runsLoading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading runs…</div>
            ) : runs.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No runs yet. Click &quot;Run check&quot; to execute compliance checks.
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {runs.map((run) => (
                  <li
                    key={run.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {run.name || `Run ${run.id.slice(0, 8)}`}
                      </span>
                      <span className="mx-2 text-gray-400">·</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(run.createdAt), 'PPp')}
                      </span>
                    </div>
                    <span
                      className={clsx(
                        'text-xs px-2 py-0.5 rounded',
                        run.status === 'completed'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      )}
                    >
                      {run.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'findings' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Findings</h2>
            <button
              onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <Filter size={14} />
              Filters
              {isFiltersExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {isFiltersExpanded && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm text-gray-600 dark:text-gray-400">Run</label>
                <select
                  value={runIdFilter}
                  onChange={(e) => setRunIdFilter(e.target.value)}
                  className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="">All runs</option>
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name || r.id.slice(0, 8)} — {format(new Date(r.createdAt), 'PP')}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden overflow-x-auto">
            {findingsLoading ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading findings…</div>
            ) : findings.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                No findings. Run a check first, or change filters.
              </div>
            ) : (
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-gray-900 dark:text-white">Rule</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-900 dark:text-white">Entity</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-900 dark:text-white">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-900 dark:text-white">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {findings.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{f.rule?.name ?? f.ruleId}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                        {f.entityType} {f.entityId?.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={clsx(
                            'px-2 py-0.5 rounded text-xs',
                            f.status === 'pass'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                          )}
                        >
                          {f.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{f.message ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {createModalOpen && (
        <CreateRuleModal
          onClose={() => setCreateModalOpen(false)}
          onSubmit={(data) => createRuleMutation.mutate(data)}
          isSubmitting={createRuleMutation.isPending}
        />
      )}

      {deleteRuleId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete rule?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              This cannot be undone. Findings for this rule will remain.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteRuleId(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteRuleMutation.mutate(deleteRuleId)}
                disabled={deleteRuleMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function CreateRuleModal({
  onClose,
  onSubmit,
  isSubmitting,
}: {
  onClose: () => void
  onSubmit: (data: { name: string; standard: string; description?: string; checkType: string }) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState('')
  const [standard, setStandard] = useState('')
  const [description, setDescription] = useState('')
  const [checkType, setCheckType] = useState('requirement_has_acceptance_criteria')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !standard.trim()) return
    onSubmit({ name: name.trim(), standard: standard.trim(), description: description.trim() || undefined, checkType })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add rule</h3>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g. Acceptance criteria required"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Standard</label>
            <input
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g. DO-178C, ISO 29148"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Check type</label>
            <select
              value={checkType}
              onChange={(e) => setCheckType(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {CHECK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Brief description of the rule"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !standard.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
