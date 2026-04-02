import { useMemo, useState } from 'react'
import { X, Plus, Loader } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { traceabilityViewsService, type TraceabilityMatrixSavedDefinition, type TraceabilitySavedView } from '../../services/traceabilityViews.service'
import { LINKAGE_TARGET_OPTIONS, type LinkageTargetType } from '../../linkage/requirementLinkDialogConfig'

type Props = {
  projectId: string
  initialFolderId?: string | null
  onClose: () => void
  onCreated: (view: TraceabilitySavedView) => void
}

export default function CreateTraceabilityViewModal({ projectId, initialFolderId, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [linkageTargetType, setLinkageTargetType] = useState<LinkageTargetType>('pbs_component')

  const [rowMode, setRowMode] = useState<TraceabilityMatrixSavedDefinition['rowMode']>('mixed')
  const [colMode, setColMode] = useState<TraceabilityMatrixSavedDefinition['colMode']>('mixed')

  const [pinnedRequirementIdsText, setPinnedRequirementIdsText] = useState('')
  const [pinnedTargetIdsText, setPinnedTargetIdsText] = useState('')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)

  const pinnedRequirementIds = useMemo(
    () => pinnedRequirementIdsText.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean),
    [pinnedRequirementIdsText]
  )
  const pinnedTargetIds = useMemo(
    () => pinnedTargetIdsText.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean),
    [pinnedTargetIdsText]
  )

  const definition: TraceabilityMatrixSavedDefinition = useMemo(() => ({
    viewKind: 'traceability_matrix',
    linkageTargetType,
    rowMode,
    colMode,
    pinnedRequirementIds,
    pinnedTargetIds,
    targetSearchQuery: targetSearchQuery.trim() || undefined,
    filterLinked,
    showSuspectOnly,
  }), [linkageTargetType, rowMode, colMode, pinnedRequirementIds, pinnedTargetIds, targetSearchQuery, filterLinked, showSuspectOnly])

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Name is required')
      const res = await traceabilityViewsService.createView(projectId, {
        name: trimmed,
        folderId: initialFolderId ?? null,
        definition,
      })
      if (!res.success || !res.data) throw new Error(res.error || 'Failed to create view')
      return res.data
    },
    onSuccess: (v) => onCreated(v),
  })

  const targetLabel = LINKAGE_TARGET_OPTIONS.find((o) => o.value === linkageTargetType)?.label ?? linkageTargetType

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[720px] max-w-[95vw] max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Create Traceability View</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">Save a reusable, project-shared custom matrix.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-7">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={`e.g. Allocation coverage (${targetLabel})`}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div className="col-span-12 md:col-span-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target type</label>
              <select
                value={linkageTargetType}
                onChange={(e) => setLinkageTargetType(e.target.value as LinkageTargetType)}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {LINKAGE_TARGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>Requirements vs {o.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Rows (requirements)</label>
                <select
                  value={rowMode}
                  onChange={(e) => setRowMode(e.target.value as any)}
                  className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  title="Row mode"
                >
                  <option value="filters">Filters only</option>
                  <option value="pinned">Pinned only</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <textarea
                value={pinnedRequirementIdsText}
                onChange={(e) => setPinnedRequirementIdsText(e.target.value)}
                placeholder="Pinned requirement IDs (comma/space separated)\nExample: 3f2… 9ac…"
                rows={4}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none',
                  rowMode === 'filters' ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-300 dark:border-gray-600'
                )}
                disabled={rowMode === 'filters'}
              />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {pinnedRequirementIds.length} pinned requirement(s)
              </div>
            </div>

            <div className="col-span-12 md:col-span-6">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Columns ({targetLabel})</label>
                <select
                  value={colMode}
                  onChange={(e) => setColMode(e.target.value as any)}
                  className="px-2 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  title="Column mode"
                >
                  <option value="filters">Filters only</option>
                  <option value="pinned">Pinned only</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <input
                value={targetSearchQuery}
                onChange={(e) => setTargetSearchQuery(e.target.value)}
                placeholder="Dynamic column search query (optional)"
                className={clsx(
                  'w-full mb-2 px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white',
                  colMode === 'pinned' ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-300 dark:border-gray-600'
                )}
                disabled={colMode === 'pinned'}
              />
              <textarea
                value={pinnedTargetIdsText}
                onChange={(e) => setPinnedTargetIdsText(e.target.value)}
                placeholder="Pinned target IDs (comma/space separated)\nExample: 6ab… 1de…"
                rows={3}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none',
                  colMode === 'filters' ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-300 dark:border-gray-600'
                )}
                disabled={colMode === 'filters'}
              />
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {pinnedTargetIds.length} pinned target(s)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Matrix filters</label>
              <div className="flex items-center gap-2">
                <select
                  value={filterLinked}
                  onChange={(e) => setFilterLinked(e.target.value as any)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All requirements</option>
                  <option value="linked">Linked only</option>
                  <option value="unlinked">Unlinked only</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={showSuspectOnly}
                    onChange={(e) => setShowSuspectOnly(e.target.checked)}
                    className="w-4 h-4"
                  />
                  Suspect only
                </label>
              </div>
            </div>
            <div className="col-span-12 md:col-span-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Definition preview</label>
              <pre className="text-[11px] rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-2 max-h-28 overflow-auto">
                {JSON.stringify(definition, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm flex items-center gap-2"
          >
            {createMutation.isPending ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      </div>
    </div>
  )
}

