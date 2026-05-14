import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Search, AlertCircle, Check } from 'lucide-react'
import { requirementService } from '../../services/requirement.service'
import {
  validationService,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  type ValidationMethodType,
  type ValidationMilestone,
} from '../../services/validation.service'
import { METHOD_LABEL, METHOD_TOOLTIP, MILESTONE_LABEL, MILESTONE_TOOLTIP } from './validationLabels'
import RequirementHoverCard from './RequirementHoverCard'

interface Props {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  /**
   * When provided, the modal lists only requirements whose ids are in this
   * set. Used by the page-level "Without validation" entry point so the
   * user can blast through coverage gaps without scrolling the full list.
   */
  restrictToRequirementIds?: string[]
  /**
   * Headline override — defaults to "New validation items from requirements".
   */
  title?: string
}

export default function CreateFromRequirementsModal({
  projectId,
  isOpen,
  onClose,
  onCreated,
  restrictToRequirementIds,
  title,
}: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [methodType, setMethodType] = useState<ValidationMethodType>('DEMONSTRATION')
  const [targetMilestone, setTargetMilestone] = useState<ValidationMilestone>('OTHER')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['requirements-for-validation', projectId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await requirementService.getAllRequirements(projectId)
      return res.success && res.data ? res.data : []
    },
  })

  const filtered = useMemo(() => {
    const allowed = restrictToRequirementIds
      ? new Set(restrictToRequirementIds)
      : null
    const base = allowed ? requirements.filter((r) => allowed.has(r.id)) : requirements
    const q = search.trim().toLowerCase()
    if (!q) return base
    return base.filter(
      (r) =>
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.requirementId ?? '').toLowerCase().includes(q),
    )
  }, [requirements, search, restrictToRequirementIds])

  if (!isOpen) return null

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (selected.size === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await validationService.createFromRequirements(projectId, {
        requirementIds: Array.from(selected),
        methodType,
        targetMilestone,
      })
      if (res.success) {
        setSelected(new Set())
        setSearch('')
        onCreated()
        onClose()
      } else {
        setError(res.error || 'Failed to create items')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,20,25,0.4)' }}>
      <div
        className="pv-drawer-shell params-v2 validation-v2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-from-reqs-title"
        style={{ width: '100%', maxWidth: 880, margin: 0, maxHeight: '90vh' }}
      >
        <div className="pv-dr-head" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, padding: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <h2 id="create-from-reqs-title" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--pv-fg)' }}>
              {title ?? 'New validation items from requirements'}
            </h2>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="pv-icon-btn"
              style={{ width: 24, height: 24 }}
            >
              <X size={14} />
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 11.5, color: 'var(--pv-fg-3)' }}>
            {restrictToRequirementIds
              ? `Showing the ${restrictToRequirementIds.length} requirement(s) without a validation item yet. Pick the ones to cover, choose method and milestone, and create.`
              : 'Pick the requirements you want to validate, then choose how and when. One validation item is created per requirement, automatically linked back to its source.'}
          </p>
        </div>

        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 space-y-3 flex-shrink-0">
          <div className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex-shrink-0 mt-0.5">
              1
            </span>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Pick requirements to validate
              </p>
              <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
                <Search size={14} className="text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by title or REQ-### key…"
                  className="flex-1 text-sm bg-transparent border-0 focus:ring-0 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex-shrink-0 mt-0.5">
              2
            </span>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Validation method
                </label>
                <select
                  value={methodType}
                  onChange={(e) => setMethodType(e.target.value as ValidationMethodType)}
                  title={METHOD_TOOLTIP[methodType]}
                  className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                >
                  {VALIDATION_METHOD_TYPES.map((m) => (
                    <option key={m} value={m} title={METHOD_TOOLTIP[m]}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                  {METHOD_TOOLTIP[methodType]}
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Target milestone
                </label>
                <select
                  value={targetMilestone}
                  onChange={(e) => setTargetMilestone(e.target.value as ValidationMilestone)}
                  title={MILESTONE_TOOLTIP[targetMilestone]}
                  className="w-full px-2 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                >
                  {VALIDATION_MILESTONES.map((m) => (
                    <option key={m} value={m} title={MILESTONE_TOOLTIP[m]}>
                      {MILESTONE_LABEL[m]}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
                  {MILESTONE_TOOLTIP[targetMilestone]}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <p className="p-6 text-sm text-gray-500">Loading requirements…</p>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <AlertCircle size={32} className="mx-auto text-gray-400" />
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {requirements.length === 0
                  ? 'No requirements in this project yet.'
                  : 'No requirements match your search.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 sticky top-0">
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="w-10 px-3 py-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (e.target.checked) filtered.forEach((r) => next.add(r.id))
                          else filtered.forEach((r) => next.delete(r.id))
                          return next
                        })
                      }}
                    />
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">
                    Key
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">
                    Requirement title
                  </th>
                  <th
                    className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-44"
                    title="Whether the requirement has acceptance criteria text. If yes, those criteria are copied as the starting validation criteria."
                  >
                    Acceptance criteria
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isSelected = selected.has(r.id)
                  const hasAc = !!r.acceptanceCriteria?.trim()
                  return (
                    <tr
                      key={r.id}
                      onClick={() => toggle(r.id)}
                      className={`border-b border-gray-100 dark:border-gray-800 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggle(r.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-700 dark:text-blue-300">
                        <RequirementHoverCard
                          projectId={projectId}
                          requirementId={r.id}
                          fallbackTitle={r.title}
                        >
                          <span className="cursor-help">{r.requirementId ?? r.id.slice(0, 6)}</span>
                        </RequirementHoverCard>
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">
                        <RequirementHoverCard
                          projectId={projectId}
                          requirementId={r.id}
                          fallbackTitle={r.title}
                        >
                          <span className="cursor-help">{r.title}</span>
                        </RequirementHoverCard>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {hasAc ? (
                          <span
                            className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"
                            title="The requirement has acceptance criteria. They will be copied as the starting validation criteria."
                          >
                            <Check size={12} /> Will be copied
                          </span>
                        ) : (
                          <span
                            className="text-gray-500 dark:text-gray-400"
                            title="The requirement has no acceptance criteria. You will add validation criteria manually after creation."
                          >
                            None — add manually
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold">
              3
            </span>
            <span>
              {selected.size === 0
                ? 'Pick at least one requirement.'
                : `${selected.size} requirement${selected.size === 1 ? '' : 's'} selected — ready to create.`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {error && <span className="text-xs text-red-600">{error}</span>}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={selected.size === 0 || submitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md"
            >
              {submitting
                ? 'Creating…'
                : selected.size === 0
                ? 'Create items'
                : `Create ${selected.size} validation item${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
