import { useMemo, useState } from 'react'
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
  ChevronRight,
  Filter,
  X,
  Folder,
  Edit2,
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import {
  complianceService,
  CHECK_TYPES,
  type ComplianceRegulationFolder,
} from '../../services/compliance.service'
import { format } from 'date-fns'
import clsx from 'clsx'

type Tab = 'rules' | 'runs' | 'findings'

type FolderTreeNode = ComplianceRegulationFolder & { children: FolderTreeNode[] }

function buildFolderTree(folders: ComplianceRegulationFolder[]): FolderTreeNode[] {
  const byParent = new Map<string | null, ComplianceRegulationFolder[]>()
  for (const f of folders) {
    const k = f.parentId
    if (!byParent.has(k)) byParent.set(k, [])
    byParent.get(k)!.push(f)
  }
  const sortFn = (a: ComplianceRegulationFolder, b: ComplianceRegulationFolder) =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
  function walk(parentId: string | null): FolderTreeNode[] {
    const list = (byParent.get(parentId) ?? []).slice().sort(sortFn)
    return list.map((f) => ({ ...f, children: walk(f.id) }))
  }
  return walk(null)
}

function flattenFolderOptions(nodes: FolderTreeNode[], depth = 0): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = []
  for (const n of nodes) {
    out.push({ id: n.id, label: `${'\u00a0\u00a0'.repeat(depth)}${n.name}`.trimStart() })
    out.push(...flattenFolderOptions(n.children, depth + 1))
  }
  return out
}

function folderTitleMap(folders: ComplianceRegulationFolder[]): Map<string, string> {
  return new Map(folders.map((f) => [f.id, f.name]))
}

export default function ComplianceCheckPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('rules')
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false)
  const [runIdFilter, setRunIdFilter] = useState<string>('')
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [selectedFolderKey, setSelectedFolderKey] = useState<'unfiled' | string>('unfiled')
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({})
  const [folderModal, setFolderModal] = useState<
    | null
    | { mode: 'create'; parentId: string | null }
    | { mode: 'edit'; folder: ComplianceRegulationFolder }
  >(null)
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  const { data: folders = [], isLoading: foldersLoading } = useQuery({
    queryKey: ['compliance-regulation-folders', projectId],
    queryFn: async () => {
      if (!projectId) throw new Error('Project ID required')
      const r = await complianceService.getRegulationFolders(projectId)
      if (r.success && r.data) return r.data
      throw new Error(r.error || 'Failed to load folders')
    },
    enabled: !!projectId && activeTab === 'rules',
  })

  const folderTree = useMemo(() => buildFolderTree(folders), [folders])
  const folderNames = useMemo(() => folderTitleMap(folders), [folders])
  const folderMoveOptions = useMemo(() => flattenFolderOptions(folderTree), [folderTree])

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

  const ruleCountByFolderId = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rules) {
      if (r.folderId) m.set(r.folderId, (m.get(r.folderId) ?? 0) + 1)
    }
    return m
  }, [rules])

  const filteredRules = useMemo(() => {
    if (selectedFolderKey === 'unfiled') return rules.filter((r) => !r.folderId)
    return rules.filter((r) => r.folderId === selectedFolderKey)
  }, [rules, selectedFolderKey])

  const createFolderMutation = useMutation({
    mutationFn: async (data: {
      name: string
      description?: string | null
      purpose?: string | null
      parentId?: string | null
    }) => {
      if (!projectId) throw new Error('Project ID required')
      return complianceService.createRegulationFolder(projectId, {
        name: data.name,
        description: data.description ?? undefined,
        purpose: data.purpose ?? undefined,
        parentId: data.parentId,
      })
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['compliance-regulation-folders', projectId] })
        setFolderModal(null)
      } else {
        alert(res.error || 'Failed to create folder')
      }
    },
    onError: (e: Error) => alert(e.message || 'Failed to create folder'),
  })

  const updateFolderMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Parameters<typeof complianceService.updateRegulationFolder>[2]
    }) => {
      if (!projectId) throw new Error('Project ID required')
      return complianceService.updateRegulationFolder(projectId, id, data)
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['compliance-regulation-folders', projectId] })
        setFolderModal(null)
      } else {
        alert(res.error || 'Failed to update folder')
      }
    },
    onError: (e: Error) => alert(e.message || 'Failed to update folder'),
  })

  const deleteFolderMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!projectId) throw new Error('Project ID required')
      return complianceService.deleteRegulationFolder(projectId, id)
    },
    onSuccess: (res, deletedId) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['compliance-regulation-folders', projectId] })
        queryClient.invalidateQueries({ queryKey: ['compliance-rules', projectId] })
        setDeleteFolderId(null)
        setSelectedFolderKey((prev) => (prev === deletedId ? 'unfiled' : prev))
      } else {
        alert(res.error || 'Failed to delete folder')
      }
    },
    onError: (e: Error) => alert(e.message || 'Failed to delete folder'),
  })

  const createRuleMutation = useMutation({
    mutationFn: async (data: {
      name: string
      standard: string
      description?: string
      checkType: string
      folderId?: string | null
    }) => {
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

  const moveRuleMutation = useMutation({
    mutationFn: async ({ id, folderId }: { id: string; folderId: string | null }) => {
      if (!projectId) throw new Error('Project ID required')
      return complianceService.updateRule(projectId, id, { folderId })
    },
    onSuccess: (res) => {
      if (res.success) {
        queryClient.invalidateQueries({ queryKey: ['compliance-rules', projectId] })
      } else {
        alert(res.error || 'Failed to move rule')
      }
    },
    onError: (e: Error) => alert(e.message || 'Failed to move rule'),
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

  const toggleExpanded = (id: string) => {
    setExpandedFolderIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const ruleTargetFolderId = selectedFolderKey === 'unfiled' ? null : selectedFolderKey

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
            type="button"
            data-testid={t.id === 'rules' ? 'compliance-tab-standards' : undefined}
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
        <div className="space-y-4" data-testid="compliance-standards-panel">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Organize checks by regulation set or program need. Common aerospace examples include DO-178C, DO-254,
            ARP4754A, and AS9100—use folder names and purposes that match your certification basis.
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Regulation folders</h2>
                <button
                  type="button"
                  data-testid="compliance-create-root-folder"
                  onClick={() => setFolderModal({ mode: 'create', parentId: null })}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={14} />
                  Folder
                </button>
              </div>
              <div
                data-testid="compliance-folder-tree"
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 min-h-[200px]"
              >
                {foldersLoading ? (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">Loading folders…</div>
                ) : (
                  <>
                    <button
                      type="button"
                      data-testid="compliance-unfiled"
                      onClick={() => setSelectedFolderKey('unfiled')}
                      className={clsx(
                        'w-full text-left px-2 py-2 rounded-md text-sm flex items-center gap-2',
                        selectedFolderKey === 'unfiled'
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200'
                      )}
                    >
                      <Folder size={16} className="opacity-70 shrink-0" />
                      <span className="font-medium">Unfiled rules</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                        {rules.filter((r) => !r.folderId).length}
                      </span>
                    </button>
                    <div className="mt-1 space-y-0.5">
                      {folderTree.map((node) => (
                        <FolderTreeRows
                          key={node.id}
                          node={node}
                          depth={0}
                          selectedFolderKey={selectedFolderKey}
                          expandedFolderIds={expandedFolderIds}
                          onToggleExpand={toggleExpanded}
                          onSelectFolder={setSelectedFolderKey}
                          onAddSubfolder={(parentId) => setFolderModal({ mode: 'create', parentId })}
                          onEditFolder={(f) => setFolderModal({ mode: 'edit', folder: f })}
                          onDeleteFolder={setDeleteFolderId}
                          ruleCountByFolderId={ruleCountByFolderId}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="lg:col-span-8 space-y-3">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Rules
                  {selectedFolderKey === 'unfiled' ? (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> — Unfiled</span>
                  ) : (
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                      {' '}
                      — {folderNames.get(selectedFolderKey) ?? 'Folder'}
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  data-testid="compliance-add-rule"
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
                ) : filteredRules.length === 0 ? (
                  <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                    No rules in this location. Add a rule or select another folder.
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredRules.map((r) => (
                      <li
                        key={r.id}
                        data-testid={`compliance-rule-row-${r.id}`}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <div className="min-w-0">
                          <span className="font-medium text-gray-900 dark:text-white">{r.name}</span>
                          <span className="mx-2 text-gray-400">·</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{r.standard}</span>
                          {r.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{r.description}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                            <span>Folder</span>
                            <select
                              data-testid={`compliance-rule-folder-select-${r.id}`}
                              value={r.folderId ?? ''}
                              onChange={(e) => {
                                const v = e.target.value
                                moveRuleMutation.mutate({ id: r.id, folderId: v === '' ? null : v })
                              }}
                              disabled={moveRuleMutation.isPending}
                              className="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs max-w-[160px]"
                            >
                              <option value="">Unfiled</option>
                              {folderMoveOptions.map((o) => (
                                <option key={o.id} value={o.id}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          {!r.isActive && (
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300">
                              Inactive
                            </span>
                          )}
                          <button
                            type="button"
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
          </div>
        </div>
      )}

      {activeTab === 'runs' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Check runs</h2>
            <button
              type="button"
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
              type="button"
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
          targetFolderId={ruleTargetFolderId}
          targetFolderLabel={
            ruleTargetFolderId ? folderNames.get(ruleTargetFolderId) ?? 'Selected folder' : 'Unfiled'
          }
        />
      )}

      {folderModal?.mode === 'create' && (
        <FolderFormModal
          key={`create-${folderModal.parentId ?? 'root'}`}
          mode="create"
          defaultParentId={folderModal.parentId}
          parentLabel={
            folderModal.parentId ? folderNames.get(folderModal.parentId) ?? 'Parent' : undefined
          }
          onClose={() => setFolderModal(null)}
          isSubmitting={createFolderMutation.isPending}
          onSubmit={(data) => createFolderMutation.mutate(data)}
        />
      )}

      {folderModal?.mode === 'edit' && (
        <FolderFormModal
          key={`edit-${folderModal.folder.id}`}
          mode="edit"
          folder={folderModal.folder}
          onClose={() => setFolderModal(null)}
          isSubmitting={updateFolderMutation.isPending}
          onSubmit={(data) =>
            updateFolderMutation.mutate({ id: folderModal.folder.id, data })
          }
        />
      )}

      {deleteFolderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete regulation folder?</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Subfolders will move up one level. Rules in this folder will move to the parent folder (or Unfiled if
              this was a root folder).
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteFolderId(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                data-testid="compliance-confirm-delete-folder"
                onClick={() => deleteFolderMutation.mutate(deleteFolderId)}
                disabled={deleteFolderMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
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
                type="button"
                onClick={() => setDeleteRuleId(null)}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
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

function FolderTreeRows({
  node,
  depth,
  selectedFolderKey,
  expandedFolderIds,
  onToggleExpand,
  onSelectFolder,
  onAddSubfolder,
  onEditFolder,
  onDeleteFolder,
  ruleCountByFolderId,
}: {
  node: FolderTreeNode
  depth: number
  selectedFolderKey: 'unfiled' | string
  expandedFolderIds: Record<string, boolean>
  onToggleExpand: (id: string) => void
  onSelectFolder: (id: string) => void
  onAddSubfolder: (parentId: string) => void
  onEditFolder: (f: ComplianceRegulationFolder) => void
  onDeleteFolder: (id: string) => void
  ruleCountByFolderId: Map<string, number>
}) {
  const hasChildren = node.children.length > 0
  const open = expandedFolderIds[node.id] ?? true
  const pad = 10 + depth * 14
  const ruleCount = ruleCountByFolderId.get(node.id) ?? 0

  return (
    <div>
      <div
        className={clsx(
          'flex items-center gap-1 rounded-md text-sm group',
          selectedFolderKey === node.id
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
            : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-800 dark:text-gray-200'
        )}
        style={{ paddingLeft: pad, paddingRight: 4 }}
      >
        <button
          type="button"
          className="p-0.5 rounded shrink-0 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600"
          aria-label={open ? 'Collapse' : 'Expand'}
          onClick={(e) => {
            e.stopPropagation()
            if (hasChildren) onToggleExpand(node.id)
          }}
          disabled={!hasChildren}
        >
          {hasChildren ? (
            open ? (
              <ChevronDown size={16} />
            ) : (
              <ChevronRight size={16} />
            )
          ) : (
            <span className="inline-block w-4" />
          )}
        </button>
        <button
          type="button"
          data-testid={`compliance-folder-${node.id}`}
          className="flex-1 text-left py-2 flex items-center gap-2 min-w-0"
          onClick={() => onSelectFolder(node.id)}
        >
          <Folder size={16} className="opacity-70 shrink-0" />
          <span className="font-medium truncate">{node.name}</span>
          {node.purpose && (
            <span className="text-xs text-gray-500 dark:text-gray-400 truncate hidden sm:inline">
              — {node.purpose}
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto shrink-0">{ruleCount}</span>
        </button>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 shrink-0">
          <button
            type="button"
            title="Add subfolder"
            data-testid={`compliance-folder-add-child-${node.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onAddSubfolder(node.id)
            }}
            className="p-1 text-gray-500 hover:text-blue-600 rounded"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            title="Edit folder"
            onClick={(e) => {
              e.stopPropagation()
              onEditFolder(node)
            }}
            className="p-1 text-gray-500 hover:text-blue-600 rounded"
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            title="Delete folder"
            data-testid={`compliance-folder-delete-${node.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onDeleteFolder(node.id)
            }}
            className="p-1 text-gray-500 hover:text-red-600 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {hasChildren && open && (
        <div>
          {node.children.map((ch) => (
            <FolderTreeRows
              key={ch.id}
              node={ch}
              depth={depth + 1}
              selectedFolderKey={selectedFolderKey}
              expandedFolderIds={expandedFolderIds}
              onToggleExpand={onToggleExpand}
              onSelectFolder={onSelectFolder}
              onAddSubfolder={onAddSubfolder}
              onEditFolder={onEditFolder}
              onDeleteFolder={onDeleteFolder}
              ruleCountByFolderId={ruleCountByFolderId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderFormModal({
  mode,
  folder,
  defaultParentId,
  parentLabel,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  mode: 'create' | 'edit'
  folder?: ComplianceRegulationFolder
  defaultParentId?: string | null
  parentLabel?: string
  onClose: () => void
  onSubmit: (data: {
    name: string
    description?: string | null
    purpose?: string | null
    parentId?: string | null
  }) => void
  isSubmitting: boolean
}) {
  const [name, setName] = useState(mode === 'edit' && folder ? folder.name : '')
  const [description, setDescription] = useState(mode === 'edit' && folder ? folder.description ?? '' : '')
  const [purpose, setPurpose] = useState(mode === 'edit' && folder ? folder.purpose ?? '' : '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (mode === 'create') {
      onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        purpose: purpose.trim() || undefined,
        parentId: defaultParentId ?? null,
      })
    } else if (folder) {
      onSubmit({
        name: name.trim(),
        description: description.trim() || null,
        purpose: purpose.trim() || null,
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {mode === 'create' ? 'New regulation folder' : 'Edit regulation folder'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        {mode === 'create' && defaultParentId && parentLabel && (
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Under: {parentLabel}</p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="compliance-folder-form">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              data-testid="compliance-folder-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g. DO-178C DAL A objectives"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Purpose (optional)</label>
            <input
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g. Software certification, hardware lifecycle"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Notes for auditors or the team"
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
              data-testid="compliance-folder-submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : mode === 'create' ? 'Create' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CreateRuleModal({
  onClose,
  onSubmit,
  isSubmitting,
  targetFolderId,
  targetFolderLabel,
}: {
  onClose: () => void
  onSubmit: (data: {
    name: string
    standard: string
    description?: string
    checkType: string
    folderId?: string | null
  }) => void
  isSubmitting: boolean
  targetFolderId: string | null
  targetFolderLabel: string
}) {
  const [name, setName] = useState('')
  const [standard, setStandard] = useState('')
  const [description, setDescription] = useState('')
  const [checkType, setCheckType] = useState('requirement_has_acceptance_criteria')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !standard.trim()) return
    onSubmit({
      name: name.trim(),
      standard: standard.trim(),
      description: description.trim() || undefined,
      checkType,
      folderId: targetFolderId,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-lg w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add rule</h3>
          <button type="button" onClick={onClose} className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Folder: <span className="font-medium text-gray-800 dark:text-gray-200">{targetFolderLabel}</span>
        </p>
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="compliance-rule-form">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              data-testid="compliance-rule-name-input"
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
              data-testid="compliance-rule-standard-input"
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
              data-testid="compliance-rule-submit"
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
