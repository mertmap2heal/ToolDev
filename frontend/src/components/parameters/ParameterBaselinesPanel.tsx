import { useEffect, useState } from 'react'
import { X, Plus, RotateCcw, GitCompare, Trash2 } from 'lucide-react'
import {
  parameterBaselineService,
  type ParameterBaselineSummary,
  type DiffEntry,
} from '../../services/parameterBaseline.service'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  projectId: string
  onClose: () => void
}

/**
 * Modal that owns the Parameter-Baseline workflow:
 *   - list every baseline taken on this project
 *   - create a new one (full-project snapshot)
 *   - compare a baseline against the live state OR another baseline
 *   - restore the live state back to a baseline (additive or prune)
 *   - delete a baseline
 *
 * Reached from the Parameters toolbar's "Baselines" button.
 */
export default function ParameterBaselinesPanel({ projectId, onClose }: Props) {
  const queryClient = useQueryClient()
  const [baselines, setBaselines] = useState<ParameterBaselineSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [diff, setDiff] = useState<{ from: string; to?: string; entries: DiffEntry[] } | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)

  async function refresh() {
    setLoading(true)
    setError(null)
    const res = await parameterBaselineService.list(projectId)
    if (res.success && res.data) setBaselines(res.data)
    else setError((res as { error?: string }).error ?? 'Failed to load baselines')
    setLoading(false)
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function handleCreate() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await parameterBaselineService.create(projectId, {
      name: newName.trim(),
      description: newDesc.trim() || undefined,
    })
    setCreating(false)
    if (res.success) {
      setNewName('')
      setNewDesc('')
      await refresh()
    } else {
      setError((res as { error?: string }).error ?? 'Failed to create baseline')
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this baseline? Cannot be undone.')) return
    const res = await parameterBaselineService.remove(projectId, id)
    if (res.success) await refresh()
    else setError((res as { error?: string }).error ?? 'Failed to delete')
  }

  async function handleCompareToLive(id: string) {
    setDiffLoading(true)
    const res = await parameterBaselineService.compare(projectId, id)
    setDiffLoading(false)
    if (res.success && res.data) {
      setDiff({ from: id, entries: res.data })
    } else {
      setError((res as { error?: string }).error ?? 'Compare failed')
    }
  }

  async function handleRestore(id: string) {
    if (
      !window.confirm(
        'Restore the live parameter set to this baseline? Existing parameter values will be overwritten. Parameters not in the baseline are left alone (additive restore).',
      )
    )
      return
    const res = await parameterBaselineService.restore(projectId, id, { prune: false })
    if (res.success && res.data) {
      window.alert(
        `Restored ${res.data.restored} · skipped ${res.data.skipped}${
          res.data.pruned ? ` · pruned ${res.data.pruned}` : ''
        }`,
      )
      queryClient.invalidateQueries({ queryKey: ['parameters', projectId] })
    } else {
      setError((res as { error?: string }).error ?? 'Restore failed')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Parameter baselines"
    >
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Parameter Baselines
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
            title="Close"
          >
            <X size={14} />
          </button>
        </div>

        {error && (
          <div className="mx-5 mt-3 px-3 py-2 rounded-md border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-xs text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Create form */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 font-semibold mb-2">
            Create new baseline
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (e.g. PDR-2026-05)"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <input
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Description (optional)"
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md"
            >
              <Plus size={12} />
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : baselines.length === 0 ? (
            <p className="text-sm text-gray-500">No baselines yet. Create one above.</p>
          ) : (
            <ul className="space-y-2">
              {baselines.map((b) => (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {b.name}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      {new Date(b.createdAt).toLocaleString()} · {b.itemCount} parameters
                      {b.description ? ` · ${b.description}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleCompareToLive(b.id)}
                      title="Compare against current live state"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded"
                    >
                      <GitCompare size={11} />
                      Compare
                    </button>
                    <button
                      onClick={() => handleRestore(b.id)}
                      title="Restore live parameters from this baseline"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded"
                    >
                      <RotateCcw size={11} />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      title="Delete baseline"
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Diff result */}
        {diff && (
          <div className="border-t border-gray-200 dark:border-gray-700 px-5 py-3 max-h-[40vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400 font-semibold">
                Diff vs live ({diff.entries.length} parameter{diff.entries.length === 1 ? '' : 's'})
              </p>
              <button
                onClick={() => setDiff(null)}
                className="text-[11px] text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Close diff
              </button>
            </div>
            {diffLoading ? (
              <p className="text-xs text-gray-500">Computing…</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-1.5 px-2 text-gray-500 dark:text-gray-400 font-semibold">
                      Parameter
                    </th>
                    <th className="text-left py-1.5 px-2 text-gray-500 dark:text-gray-400 font-semibold">
                      Status
                    </th>
                    <th className="text-left py-1.5 px-2 text-gray-500 dark:text-gray-400 font-semibold">
                      Changed fields
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {diff.entries
                    .filter((e) => e.status !== 'unchanged')
                    .map((e) => (
                      <tr
                        key={e.parameterId}
                        className="border-b border-gray-100 dark:border-gray-900"
                      >
                        <td className="py-1.5 px-2 font-mono text-gray-700 dark:text-gray-300 truncate max-w-[200px]">
                          {e.name}
                        </td>
                        <td className="py-1.5 px-2">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${
                              e.status === 'added'
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                : e.status === 'removed'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {e.status}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-gray-600 dark:text-gray-400">
                          {e.fieldDiffs
                            ? Object.keys(e.fieldDiffs).join(', ')
                            : ''}
                        </td>
                      </tr>
                    ))}
                  {diff.entries.filter((e) => e.status !== 'unchanged').length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-3 px-2 text-gray-500 italic">
                        No differences — live state matches the baseline.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
