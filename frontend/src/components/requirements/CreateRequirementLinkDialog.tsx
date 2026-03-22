import { useState, useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Link as LinkIcon, Loader } from 'lucide-react'
import { linkService } from '../../services/link.service'
import { traceabilityService } from '../../services/traceability.service'
import { functionService } from '../../services/function.service'
import { requirementService } from '../../services/requirement.service'
import { LINKAGE_V1 } from '../../config/featureFlags'
import {
  type LinkageTargetType,
  LINKAGE_TARGET_OPTIONS,
  LINK_TYPE_MAP,
  linkageTargetOptionFor,
} from '../../linkage/requirementLinkDialogConfig'
import type { LinkType } from 'shared/types/traceability.types'
import type { EntitySummary } from 'shared/types/linkage.types'
import { invalidateLinkCaches } from '../../utils/invalidateLinkCaches'
import clsx from 'clsx'

const normType = (s: string | undefined) => (s ?? '').toLowerCase().replace(/-/g, '_')

export interface CreateRequirementLinkDialogProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  sourceRequirement: { id: string; requirementId?: string | null; title?: string | null } | null
  readOnly?: boolean
}

type LegacyTargetKind = 'function' | 'requirement'

export default function CreateRequirementLinkDialog({
  isOpen,
  onClose,
  projectId,
  sourceRequirement,
  readOnly = false,
}: CreateRequirementLinkDialogProps) {
  const queryClient = useQueryClient()
  const [targetType, setTargetType] = useState<LinkageTargetType>('pbs_component')
  const [legacyTargetKind, setLegacyTargetKind] = useState<LegacyTargetKind>('function')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [selectedTarget, setSelectedTarget] = useState<EntitySummary | null>(null)
  const [reqToReqLinkType, setReqToReqLinkType] = useState<LinkType>('derives')
  const [legacyLinkType, setLegacyLinkType] = useState<LinkType>('satisfies')
  const [linkDirection, setLinkDirection] = useState('')
  const [linkRationale, setLinkRationale] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    if (!isOpen) return
    setSearchQuery('')
    setDebouncedSearch('')
    setSelectedTarget(null)
    setLinkDirection('')
    setLinkRationale('')
    if (LINKAGE_V1) {
      setTargetType('pbs_component')
      setReqToReqLinkType('derives')
    } else {
      setLegacyTargetKind('function')
      setLegacyLinkType('satisfies')
    }
  }, [isOpen, sourceRequirement?.id])

  const targetOpt = linkageTargetOptionFor(targetType)

  const { data: linkageResults = [], isLoading: loadingLinkage } = useQuery({
    queryKey: ['create-req-link-targets', projectId, targetType, debouncedSearch],
    queryFn: async () => {
      if (!targetOpt) return []
      return targetOpt.adapter.search(debouncedSearch, projectId)
    },
    enabled: isOpen && !!projectId && !!targetOpt && LINKAGE_V1 && !readOnly,
  })

  const filteredLinkageTargets = useMemo(() => {
    const want = normType(targetType)
    return linkageResults.filter((t) => normType(t.type) === want)
  }, [linkageResults, targetType])

  const { data: legacyFunctions = [], isLoading: loadingLegacyFuncs } = useQuery({
    queryKey: ['functions', projectId],
    queryFn: async () => {
      const r = await functionService.getFunctions(projectId)
      return r.success && r.data ? r.data : []
    },
    enabled: isOpen && !!projectId && !LINKAGE_V1 && legacyTargetKind === 'function' && !readOnly,
  })

  const { data: legacyRequirements = [], isLoading: loadingLegacyReqs } = useQuery({
    queryKey: ['requirements', projectId],
    queryFn: async () => {
      const r = await requirementService.getAllRequirements(projectId)
      return r.success && r.data ? r.data : []
    },
    enabled: isOpen && !!projectId && !LINKAGE_V1 && legacyTargetKind === 'requirement' && !readOnly,
  })

  const filteredLegacyFunctions = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    if (!q) return legacyFunctions.slice(0, 50)
    return legacyFunctions
      .filter(
        (f) =>
          f.name?.toLowerCase().includes(q) ||
          f.functionId?.toLowerCase().includes(q) ||
          f.id.toLowerCase().includes(q)
      )
      .slice(0, 50)
  }, [legacyFunctions, debouncedSearch])

  const filteredLegacyRequirements = useMemo(() => {
    const q = debouncedSearch.toLowerCase().trim()
    let list = legacyRequirements.filter((r) => r.id !== sourceRequirement?.id)
    if (q) {
      list = list.filter(
        (r) =>
          (r.title && r.title.toLowerCase().includes(q)) ||
          (r.requirementId && r.requirementId.toLowerCase().includes(q)) ||
          r.id.toLowerCase().includes(q)
      )
    }
    return list.slice(0, 50)
  }, [legacyRequirements, debouncedSearch, sourceRequirement?.id])

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!sourceRequirement) throw new Error('No source requirement')
      if (LINKAGE_V1) {
        if (!selectedTarget) throw new Error('Select a target')
        const linkType =
          targetType === 'requirement'
            ? reqToReqLinkType
            : ((LINK_TYPE_MAP[targetType] || 'trace') as LinkType)
        const res = await linkService.createLink(projectId, {
          sourceType: 'requirement',
          sourceId: sourceRequirement.id,
          targetType: selectedTarget.type,
          targetId: selectedTarget.id,
          linkType,
          direction: linkDirection || undefined,
          rationale: linkRationale || undefined,
        })
        if (!res.success) throw new Error(res.error || 'Failed to create link')
        return res
      }
      if (!selectedTarget) throw new Error('Select a target')
      const tt = legacyTargetKind === 'function' ? 'function' : 'requirement'
      const res = await traceabilityService.createTraceLink(projectId, {
        sourceType: 'requirement',
        sourceId: sourceRequirement.id,
        targetType: tt as 'function' | 'requirement',
        targetId: selectedTarget.id,
        linkType: legacyLinkType,
        direction: linkDirection || undefined,
        rationale: linkRationale || undefined,
      })
      if (!res.success) throw new Error(res.error || 'Failed to create trace link')
      return res
    },
    onSuccess: () => {
      invalidateLinkCaches(queryClient, projectId)
      onClose()
    },
    onError: (e: Error) => {
      alert(e.message || 'Failed to create link')
    },
  })

  const handleSelectLinkageTarget = (t: EntitySummary) => {
    if (targetType === 'requirement' && t.id === sourceRequirement?.id) return
    setSelectedTarget(t)
  }

  const handleSelectLegacyFunction = (f: { id: string; name: string; functionId?: string }) => {
    setSelectedTarget({
      id: f.id,
      type: 'function',
      label: `[${f.functionId || f.id.slice(0, 8)}] ${f.name}`,
    })
  }

  const handleSelectLegacyRequirement = (r: { id: string; title: string; requirementId?: string | null }) => {
    setSelectedTarget({
      id: r.id,
      type: 'requirement',
      label: `[${r.requirementId || r.id.slice(0, 8)}] ${r.title}`,
    })
  }

  const handleSubmit = () => {
    if (readOnly || !sourceRequirement) return
    createMutation.mutate()
  }

  if (!isOpen || !sourceRequirement) return null

  const showReqToReqLinkPicker = LINKAGE_V1 && targetType === 'requirement'
  const showLegacyLinkPicker = !LINKAGE_V1

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Add link</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            aria-label="Close"
          >
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {readOnly ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Links cannot be edited in baseline view.</p>
          ) : (
            <>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">From requirement</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {sourceRequirement.requirementId || sourceRequirement.id.slice(0, 8)} — {sourceRequirement.title || '—'}
                </p>
              </div>

              {LINKAGE_V1 ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link to</label>
                  <select
                    value={targetType}
                    onChange={(e) => {
                      setTargetType(e.target.value as LinkageTargetType)
                      setSelectedTarget(null)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {LINKAGE_TARGET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Link to</label>
                  <select
                    value={legacyTargetKind}
                    onChange={(e) => {
                      setLegacyTargetKind(e.target.value as LegacyTargetKind)
                      setSelectedTarget(null)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="function">Function</option>
                    <option value="requirement">Requirement</option>
                  </select>
                </div>
              )}

              {(showReqToReqLinkPicker || showLegacyLinkPicker) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Link type (SysML)
                  </label>
                  <select
                    value={showReqToReqLinkPicker ? reqToReqLinkType : legacyLinkType}
                    onChange={(e) => {
                      const v = e.target.value as LinkType
                      if (showReqToReqLinkPicker) setReqToReqLinkType(v)
                      else setLegacyLinkType(v)
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="satisfies">Satisfies</option>
                    <option value="implements">Implements</option>
                    <option value="verifies">Verifies</option>
                    <option value="derives">Derives</option>
                    <option value="refines">Refines</option>
                    <option value="copy">Copy</option>
                    <option value="trace">Trace</option>
                    <option value="allocate">Allocate</option>
                  </select>
                </div>
              )}

              {LINKAGE_V1 && !showReqToReqLinkPicker && targetOpt && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Relationship type:{' '}
                  <span className="font-mono">{LINK_TYPE_MAP[targetType]}</span>
                </p>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search and select target
                </label>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-2"
                />
                <div className="border border-gray-200 dark:border-gray-600 rounded-lg max-h-48 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700">
                  {LINKAGE_V1 ? (
                    loadingLinkage ? (
                      <div className="p-4 text-sm text-gray-500 flex items-center gap-2">
                        <Loader size={16} className="animate-spin" /> Loading…
                      </div>
                    ) : filteredLinkageTargets.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">No matches. Try another search.</div>
                    ) : (
                      filteredLinkageTargets.map((t) => (
                        <button
                          key={`${t.type}-${t.id}`}
                          type="button"
                          onClick={() => handleSelectLinkageTarget(t)}
                          disabled={targetType === 'requirement' && t.id === sourceRequirement.id}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50',
                            selectedTarget?.id === t.id && 'bg-blue-50 dark:bg-blue-900/30'
                          )}
                        >
                          {t.label}
                        </button>
                      ))
                    )
                  ) : legacyTargetKind === 'function' ? (
                    loadingLegacyFuncs ? (
                      <div className="p-4 text-sm text-gray-500 flex items-center gap-2">
                        <Loader size={16} className="animate-spin" /> Loading…
                      </div>
                    ) : filteredLegacyFunctions.length === 0 ? (
                      <div className="p-4 text-sm text-gray-500">No functions match.</div>
                    ) : (
                      filteredLegacyFunctions.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleSelectLegacyFunction(f)}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50',
                            selectedTarget?.id === f.id && 'bg-blue-50 dark:bg-blue-900/30'
                          )}
                        >
                          [{f.functionId || f.id.slice(0, 8)}] {f.name}
                        </button>
                      ))
                    )
                  ) : loadingLegacyReqs ? (
                    <div className="p-4 text-sm text-gray-500 flex items-center gap-2">
                      <Loader size={16} className="animate-spin" /> Loading…
                    </div>
                  ) : filteredLegacyRequirements.length === 0 ? (
                    <div className="p-4 text-sm text-gray-500">No requirements match.</div>
                  ) : (
                    filteredLegacyRequirements.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleSelectLegacyRequirement(r)}
                        className={clsx(
                          'w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/50',
                          selectedTarget?.id === r.id && 'bg-blue-50 dark:bg-blue-900/30'
                        )}
                      >
                        [{r.requirementId || r.id.slice(0, 8)}] {r.title}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Direction (optional)
                </label>
                <input
                  type="text"
                  value={linkDirection}
                  onChange={(e) => setLinkDirection(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rationale (optional)
                </label>
                <textarea
                  value={linkRationale}
                  onChange={(e) => setLinkRationale(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={readOnly || !selectedTarget || createMutation.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
          >
            {createMutation.isPending ? (
              <>
                <Loader size={14} className="animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <LinkIcon size={14} />
                Create link
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
