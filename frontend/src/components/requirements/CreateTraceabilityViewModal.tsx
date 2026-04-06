import { useEffect, useMemo, useState } from 'react'
import { X, Plus, Loader, Copy, Save } from 'lucide-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { traceabilityViewsService, type SavedViewFolder, type TraceabilityMatrixSavedDefinition, type TraceabilitySavedView } from '../../services/traceabilityViews.service'
import { LINKAGE_TARGET_OPTIONS, type LinkageTargetType } from '../../linkage/requirementLinkDialogConfig'
import { requirementService } from '../../services/requirement.service'
import type { Requirement } from 'shared/types/engineering.types'

type Props = {
  projectId: string
  initialFolderId?: string | null
  folders?: SavedViewFolder[]
  mode?: 'create' | 'edit' | 'duplicate'
  initialView?: TraceabilitySavedView | null
  onClose: () => void
  onCreated: (view: TraceabilitySavedView) => void
}

function safeParseDefinition(definitionJson: string | null | undefined): TraceabilityMatrixSavedDefinition | null {
  if (!definitionJson) return null
  try {
    const parsed = JSON.parse(definitionJson) as TraceabilityMatrixSavedDefinition
    if (parsed && parsed.viewKind === 'traceability_matrix') return parsed
  } catch {
    // ignore
  }
  return null
}

function uniq(list: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const v of list) {
    const t = String(v ?? '').trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function summarizeDefinition(def: TraceabilityMatrixSavedDefinition): string {
  const row = def.rowMode
  const col = def.colMode
  const rowsPinned = (def.pinnedRequirementIds ?? []).length
  const colsPinned = (def.pinnedTargetIds ?? []).length
  const filtersCount = def.filters ? Object.keys(def.filters).length : 0
  const bits = [
    `Rows: ${row}${rowsPinned ? ` (${rowsPinned} pinned)` : ''}`,
    `Cols: ${col}${colsPinned ? ` (${colsPinned} pinned)` : ''}`,
    filtersCount ? `Row filters: ${filtersCount}` : null,
    def.filterLinked && def.filterLinked !== 'all' ? `Requirement filter: ${def.filterLinked}` : null,
    def.showSuspectOnly ? 'Suspect only' : null,
  ].filter(Boolean)
  return bits.join(' • ')
}

export default function CreateTraceabilityViewModal({
  projectId,
  initialFolderId,
  folders,
  mode = 'create',
  initialView,
  onClose,
  onCreated,
}: Props) {
  const initialDef = useMemo(() => safeParseDefinition(initialView?.definitionJson), [initialView?.definitionJson])

  const [uiMode, setUiMode] = useState<'simple' | 'advanced'>('simple')
  const [name, setName] = useState('')
  const [folderId, setFolderId] = useState<string | null>(initialFolderId ?? null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [linkageTargetType, setLinkageTargetType] = useState<LinkageTargetType>('pbs_component')

  const [rowMode, setRowMode] = useState<TraceabilityMatrixSavedDefinition['rowMode']>('mixed')
  const [colMode, setColMode] = useState<TraceabilityMatrixSavedDefinition['colMode']>('mixed')

  const [pinnedRequirementIds, setPinnedRequirementIds] = useState<string[]>([])
  const [pinnedTargetIds, setPinnedTargetIds] = useState<string[]>([])
  const [pinnedRequirementIdsText, setPinnedRequirementIdsText] = useState('')
  const [pinnedTargetIdsText, setPinnedTargetIdsText] = useState('')
  const [targetSearchQuery, setTargetSearchQuery] = useState('')
  const [filterLinked, setFilterLinked] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [showSuspectOnly, setShowSuspectOnly] = useState(false)
  const [objectiveMinSourceCoveragePct, setObjectiveMinSourceCoveragePct] = useState<number | ''>('')
  const [objectiveMinTargetCoveragePct, setObjectiveMinTargetCoveragePct] = useState<number | ''>('')
  const [objectiveMaxSuspectLinks, setObjectiveMaxSuspectLinks] = useState<number | ''>('')

  const [rowFilterStatus, setRowFilterStatus] = useState('')
  const [rowFilterOwner, setRowFilterOwner] = useState('')
  const [rowFilterPriority, setRowFilterPriority] = useState('')
  const [rowFilterCategory, setRowFilterCategory] = useState('')
  const [rowFilterSearch, setRowFilterSearch] = useState('')

  const [reqPickerQuery, setReqPickerQuery] = useState('')
  const [targetPickerQuery, setTargetPickerQuery] = useState('')

  const { data: allRequirements = [], isLoading: loadingReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const r = await requirementService.getAllRequirements(projectId)
      return r.success && r.data ? r.data : []
    },
    enabled: !!projectId,
  })

  const targetOpt = useMemo(
    () => LINKAGE_TARGET_OPTIONS.find((o) => o.value === linkageTargetType),
    [linkageTargetType]
  )

  const { data: targetSearchResults = [], isLoading: loadingTargets } = useQuery({
    queryKey: ['traceability-view-target-search', projectId, linkageTargetType, targetPickerQuery],
    queryFn: () => (targetOpt ? targetOpt.adapter.search(targetPickerQuery || '', projectId) : Promise.resolve([])),
    enabled: !!projectId && !!targetOpt && targetPickerQuery.trim().length > 0,
  })

  const rowFilters = useMemo(() => {
    if (rowMode === 'pinned') return undefined
    const f: Record<string, string> = {}
    if (rowFilterStatus.trim()) f.status = rowFilterStatus.trim()
    if (rowFilterOwner.trim()) f.owner = rowFilterOwner.trim()
    if (rowFilterPriority.trim()) f.priority = rowFilterPriority.trim()
    if (rowFilterCategory.trim()) f.category = rowFilterCategory.trim()
    if (rowFilterSearch.trim()) f.search = rowFilterSearch.trim()
    return Object.keys(f).length ? f : undefined
  }, [rowMode, rowFilterStatus, rowFilterOwner, rowFilterPriority, rowFilterCategory, rowFilterSearch])

  const effectiveRowMode = useMemo(() => {
    // In practice, users expect pinned picks to constrain the matrix.
    // If they pinned rows but left row filters empty and kept default "mixed", treat it as pinned-only.
    if (rowMode === 'mixed' && pinnedRequirementIds.length > 0 && !rowFilters) return 'pinned'
    return rowMode
  }, [rowMode, pinnedRequirementIds.length, rowFilters])

  const effectiveColMode = useMemo(() => {
    // If user pinned columns but left dynamic target search empty and kept default "mixed", treat it as pinned-only.
    if (colMode === 'mixed' && pinnedTargetIds.length > 0 && !targetSearchQuery.trim()) return 'pinned'
    return colMode
  }, [colMode, pinnedTargetIds.length, targetSearchQuery])

  const definition: TraceabilityMatrixSavedDefinition = useMemo(() => ({
    viewKind: 'traceability_matrix',
    linkageTargetType,
    rowMode: effectiveRowMode,
    colMode: effectiveColMode,
    pinnedRequirementIds,
    pinnedTargetIds,
    targetSearchQuery: targetSearchQuery.trim() || undefined,
    filterLinked,
    showSuspectOnly,
    filters: rowFilters,
    objectives: {
      ...(objectiveMinSourceCoveragePct === '' ? {} : { minSourceCoveragePct: Number(objectiveMinSourceCoveragePct) }),
      ...(objectiveMinTargetCoveragePct === '' ? {} : { minTargetCoveragePct: Number(objectiveMinTargetCoveragePct) }),
      ...(objectiveMaxSuspectLinks === '' ? {} : { maxSuspectLinks: Number(objectiveMaxSuspectLinks) }),
    },
  }), [
    linkageTargetType,
    effectiveRowMode,
    effectiveColMode,
    pinnedRequirementIds,
    pinnedTargetIds,
    targetSearchQuery,
    filterLinked,
    showSuspectOnly,
    rowFilters,
    objectiveMinSourceCoveragePct,
    objectiveMinTargetCoveragePct,
    objectiveMaxSuspectLinks,
  ])

  useEffect(() => {
    const verb = mode === 'edit' ? 'Edit' : mode === 'duplicate' ? 'Duplicate' : 'Create'
    const defaultName =
      initialView?.name && mode !== 'create'
        ? mode === 'duplicate'
          ? `${initialView.name} (copy)`
          : initialView.name
        : ''
    setName(defaultName)

    if (initialDef?.linkageTargetType) setLinkageTargetType(initialDef.linkageTargetType as LinkageTargetType)
    if (initialDef?.rowMode) setRowMode(initialDef.rowMode)
    if (initialDef?.colMode) setColMode(initialDef.colMode)
    if (Array.isArray(initialDef?.pinnedRequirementIds)) setPinnedRequirementIds(uniq(initialDef!.pinnedRequirementIds!))
    if (Array.isArray(initialDef?.pinnedTargetIds)) setPinnedTargetIds(uniq(initialDef!.pinnedTargetIds!))
    if (typeof initialDef?.targetSearchQuery === 'string') setTargetSearchQuery(initialDef.targetSearchQuery)
    if (initialDef?.filterLinked) setFilterLinked(initialDef.filterLinked)
    if (typeof initialDef?.showSuspectOnly === 'boolean') setShowSuspectOnly(initialDef.showSuspectOnly)
    if (initialDef?.objectives && typeof initialDef.objectives === 'object') {
      const o: any = initialDef.objectives
      if (typeof o.minSourceCoveragePct === 'number') setObjectiveMinSourceCoveragePct(o.minSourceCoveragePct)
      if (typeof o.minTargetCoveragePct === 'number') setObjectiveMinTargetCoveragePct(o.minTargetCoveragePct)
      if (typeof o.maxSuspectLinks === 'number') setObjectiveMaxSuspectLinks(o.maxSuspectLinks)
    }

    if (initialView?.folderId !== undefined && mode !== 'create') {
      setFolderId(initialView.folderId ?? null)
    } else {
      setFolderId(initialFolderId ?? null)
    }

    // keep advanced textareas synced
    setPinnedRequirementIdsText((initialDef?.pinnedRequirementIds ?? []).join(', '))
    setPinnedTargetIdsText((initialDef?.pinnedTargetIds ?? []).join(', '))

    void verb
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // keep advanced textareas in sync when user uses pickers in Simple mode
    setPinnedRequirementIdsText(pinnedRequirementIds.join(', '))
  }, [pinnedRequirementIds])

  useEffect(() => {
    setPinnedTargetIdsText(pinnedTargetIds.join(', '))
  }, [pinnedTargetIds])

  const parsedPinnedRequirementIdsFromText = useMemo(
    () => uniq(pinnedRequirementIdsText.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean)),
    [pinnedRequirementIdsText]
  )
  const parsedPinnedTargetIdsFromText = useMemo(
    () => uniq(pinnedTargetIdsText.split(/[\s,]+/g).map((s) => s.trim()).filter(Boolean)),
    [pinnedTargetIdsText]
  )

  useEffect(() => {
    if (uiMode !== 'advanced') return
    setPinnedRequirementIds(parsedPinnedRequirementIdsFromText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiMode, pinnedRequirementIdsText])

  useEffect(() => {
    if (uiMode !== 'advanced') return
    setPinnedTargetIds(parsedPinnedTargetIdsFromText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiMode, pinnedTargetIdsText])

  const pinnedRequirementSet = useMemo(() => new Set(pinnedRequirementIds), [pinnedRequirementIds])
  const pinnedTargetSet = useMemo(() => new Set(pinnedTargetIds), [pinnedTargetIds])

  const requirementsForPicker = useMemo(() => {
    const q = reqPickerQuery.trim().toLowerCase()
    const list = allRequirements as Requirement[]
    if (!q) return list.slice(0, 30)
    return list.filter((r) => {
      const hay = `${r.requirementId ?? ''} ${r.title ?? ''} ${r.description ?? ''}`.toLowerCase()
      return hay.includes(q)
    }).slice(0, 30)
  }, [allRequirements, reqPickerQuery])

  const addPinnedRequirement = (reqId: string) => setPinnedRequirementIds((p) => uniq([...p, reqId]))
  const removePinnedRequirement = (reqId: string) => setPinnedRequirementIds((p) => p.filter((id) => id !== reqId))

  const addPinnedTarget = (targetId: string) => setPinnedTargetIds((p) => uniq([...p, targetId]))
  const removePinnedTarget = (targetId: string) => setPinnedTargetIds((p) => p.filter((id) => id !== targetId))

  const requirementsById = useMemo(() => new Map((allRequirements as Requirement[]).map((r) => [r.id, r])), [allRequirements])

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('Name is required')
      if (mode === 'edit') {
        if (!initialView?.id) throw new Error('View is missing')
        const res = await traceabilityViewsService.updateView(projectId, initialView.id, {
          name: trimmed,
          folderId,
          definition,
        })
        if (!res.success || !res.data) throw new Error(res.error || 'Failed to update view')
        return res.data
      }
      const res = await traceabilityViewsService.createView(projectId, {
        name: trimmed,
        folderId,
        definition,
      })
      if (!res.success || !res.data) throw new Error(res.error || 'Failed to create view')
      return res.data
    },
    onSuccess: (v) => onCreated(v),
    onError: (err: any) => {
      const msg =
        typeof err?.message === 'string'
          ? err.message
          : typeof err?.error === 'string'
            ? err.error
            : 'Failed to save view. Please try again.'
      setSubmitError(msg)
    },
  })

  const targetLabel = LINKAGE_TARGET_OPTIONS.find((o) => o.value === linkageTargetType)?.label ?? linkageTargetType
  const title =
    mode === 'edit' ? 'Edit Traceability View' : mode === 'duplicate' ? 'Duplicate Traceability View' : 'Create Traceability View'

  const nameError = useMemo(() => {
    if (createMutation.isPending) return null
    if (!name.trim()) return 'Name is required.'
    return null
  }, [name, createMutation.isPending])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[720px] max-w-[95vw] max-h-[90vh] overflow-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {mode === 'edit' ? 'Update a project-shared custom matrix.' : 'Save a reusable, project-shared custom matrix.'}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 leading-relaxed max-w-xl">
              Use saved views for recurring allocation and verification coverage checks (ISO/IEC/IEEE 29148; ARP4754A allocation
              and DO-178C Table A-7 themes)—scope follows your certification and safety plans.
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={18} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {summarizeDefinition(definition)}
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setUiMode('simple')}
                className={clsx(
                  'px-3 py-1.5 text-xs',
                  uiMode === 'simple'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                Simple
              </button>
              <button
                type="button"
                onClick={() => setUiMode('advanced')}
                className={clsx(
                  'px-3 py-1.5 text-xs',
                  uiMode === 'advanced'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                )}
              >
                Advanced
              </button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 md:col-span-7">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (submitError) setSubmitError(null)
                }}
                placeholder={`e.g. Allocation coverage (${targetLabel})`}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              {nameError && (
                <div className="mt-1 text-xs text-red-600 dark:text-red-400">{nameError}</div>
              )}
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

          {folders && (
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-7">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Folder</label>
                <select
                  value={folderId ?? ''}
                  onChange={(e) => setFolderId(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Unfiled</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-12 md:col-span-5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Create mode</label>
                <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 text-sm text-gray-700 dark:text-gray-300">
                  {mode === 'edit' ? 'Editing existing view' : mode === 'duplicate' ? 'Duplicating view' : 'New view'}
                </div>
              </div>
            </div>
          )}

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

              {uiMode === 'advanced' ? (
                <>
                  <textarea
                    value={pinnedRequirementIdsText}
                    onChange={(e) => setPinnedRequirementIdsText(e.target.value)}
                    placeholder="Pinned requirement IDs (comma/space separated)\nTip: you can paste IDs here, or use Simple mode pickers."
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
                </>
              ) : (
                <div className={clsx(
                  'rounded-lg border p-2',
                  rowMode === 'filters' ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-200 dark:border-gray-700'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={reqPickerQuery}
                      onChange={(e) => setReqPickerQuery(e.target.value)}
                      placeholder="Search requirements to pin (ID, title, description)…"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={rowMode === 'filters'}
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {loadingReqs ? 'Loading…' : `${pinnedRequirementIds.length} pinned`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {pinnedRequirementIds.slice(0, 12).map((id) => {
                      const r = requirementsById.get(id)
                      const label = r ? `${r.requirementId || r.id.slice(0, 8)} — ${r.title}` : id
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => removePinnedRequirement(id)}
                          className="px-2 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                          title="Click to remove"
                          disabled={rowMode === 'filters'}
                        >
                          {label.length > 42 ? `${label.slice(0, 42)}…` : label} ×
                        </button>
                      )
                    })}
                    {pinnedRequirementIds.length > 12 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 px-1 py-1">
                        +{pinnedRequirementIds.length - 12} more
                      </span>
                    )}
                  </div>
                  <div className="max-h-48 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    {requirementsForPicker.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 dark:text-gray-400">No matches.</div>
                    ) : (
                      requirementsForPicker.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => addPinnedRequirement(r.id)}
                          disabled={rowMode === 'filters' || pinnedRequirementSet.has(r.id)}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 last:border-b-0',
                            'hover:bg-gray-50 dark:hover:bg-gray-700/40',
                            (rowMode === 'filters' || pinnedRequirementSet.has(r.id)) && 'opacity-60 cursor-not-allowed'
                          )}
                          title={pinnedRequirementSet.has(r.id) ? 'Already pinned' : 'Pin this requirement'}
                        >
                          <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                            {r.requirementId || r.id.slice(0, 8)}
                          </div>
                          <div className="text-gray-900 dark:text-white truncate">{r.title || '(Untitled)'}</div>
                        </button>
                      ))
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Tip: pin a small stable set, then use Filters or Mixed for coverage slices.
                  </div>
                </div>
              )}

              {rowMode !== 'pinned' && (
                <div className="mt-3 space-y-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-900/30">
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">Row filters (exact match except Search)</div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={rowFilterStatus}
                      onChange={(e) => setRowFilterStatus(e.target.value)}
                      placeholder="Status (exact)"
                      className="px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      value={rowFilterOwner}
                      onChange={(e) => setRowFilterOwner(e.target.value)}
                      placeholder="Owner (exact)"
                      className="px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      value={rowFilterPriority}
                      onChange={(e) => setRowFilterPriority(e.target.value)}
                      placeholder="Priority (exact)"
                      className="px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      value={rowFilterCategory}
                      onChange={(e) => setRowFilterCategory(e.target.value)}
                      placeholder="Category (exact)"
                      className="px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <input
                    value={rowFilterSearch}
                    onChange={(e) => setRowFilterSearch(e.target.value)}
                    placeholder="Search (matches ID, title, description)"
                    className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              )}
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

              {uiMode === 'advanced' ? (
                <>
                  <textarea
                    value={pinnedTargetIdsText}
                    onChange={(e) => setPinnedTargetIdsText(e.target.value)}
                    placeholder="Pinned target IDs (comma/space separated)\nTip: you can paste IDs here, or use Simple mode pickers."
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
                </>
              ) : (
                <div className={clsx(
                  'rounded-lg border p-2',
                  colMode === 'filters' ? 'border-gray-200 dark:border-gray-700 opacity-60' : 'border-gray-200 dark:border-gray-700'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      value={targetPickerQuery}
                      onChange={(e) => setTargetPickerQuery(e.target.value)}
                      placeholder={`Search ${targetLabel} to pin…`}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={colMode === 'filters'}
                    />
                    <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {loadingTargets ? 'Searching…' : `${pinnedTargetIds.length} pinned`}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {pinnedTargetIds.slice(0, 12).map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => removePinnedTarget(id)}
                        className="px-2 py-1 rounded-full text-xs bg-blue-50 dark:bg-blue-900/25 text-blue-700 dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                        title="Click to remove"
                        disabled={colMode === 'filters'}
                      >
                        {id.slice(0, 8)} ×
                      </button>
                    ))}
                    {pinnedTargetIds.length > 12 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 px-1 py-1">
                        +{pinnedTargetIds.length - 12} more
                      </span>
                    )}
                  </div>
                  <div className="max-h-48 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                    {targetPickerQuery.trim().length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                        Type to search {targetLabel}.
                      </div>
                    ) : targetSearchResults.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                        No matches.
                      </div>
                    ) : (
                      targetSearchResults
                        // some adapters can return mixed types; prefer exact type matches where possible
                        .filter((t: any) => String(t?.type ?? '') === String(linkageTargetType))
                        .slice(0, 30)
                        .map((t: any) => (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => addPinnedTarget(t.id)}
                            disabled={colMode === 'filters' || pinnedTargetSet.has(t.id)}
                            className={clsx(
                              'w-full text-left px-3 py-2 text-sm border-b border-gray-200 dark:border-gray-700 last:border-b-0',
                              'hover:bg-gray-50 dark:hover:bg-gray-700/40',
                              (colMode === 'filters' || pinnedTargetSet.has(t.id)) && 'opacity-60 cursor-not-allowed'
                            )}
                            title={pinnedTargetSet.has(t.id) ? 'Already pinned' : 'Pin this target'}
                          >
                            <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                              {(t.key || t.id.slice(0, 8))}
                            </div>
                            <div className="text-gray-900 dark:text-white truncate">{t.label || '(Untitled)'}</div>
                          </button>
                        ))
                    )}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Tip: keep pinned columns small; use Dynamic search to define wide column slices.
                  </div>
                </div>
              )}
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

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Objectives (optional)</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <input
                  value={objectiveMinSourceCoveragePct}
                  onChange={(e) => setObjectiveMinSourceCoveragePct(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Min source coverage %"
                  type="number"
                  min={0}
                  max={100}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  value={objectiveMinTargetCoveragePct}
                  onChange={(e) => setObjectiveMinTargetCoveragePct(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Min target coverage %"
                  type="number"
                  min={0}
                  max={100}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <input
                  value={objectiveMaxSuspectLinks}
                  onChange={(e) => setObjectiveMaxSuspectLinks(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Max suspect links"
                  type="number"
                  min={0}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                When objectives are set, the matrix can show pass/fail against coverage and suspect thresholds.
              </div>
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-200">
              {submitError}
            </div>
          )}
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
            disabled={createMutation.isPending || !name.trim()}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm flex items-center gap-2"
          >
            {createMutation.isPending ? (
              <Loader size={14} className="animate-spin" />
            ) : mode === 'edit' ? (
              <Save size={14} />
            ) : mode === 'duplicate' ? (
              <Copy size={14} />
            ) : (
              <Plus size={14} />
            )}
            {mode === 'edit' ? 'Save' : mode === 'duplicate' ? 'Create copy' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}

