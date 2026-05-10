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

interface Props {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateFromRequirementsModal({
  projectId,
  isOpen,
  onClose,
  onCreated,
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
    const q = search.trim().toLowerCase()
    if (!q) return requirements
    return requirements.filter(
      (r) =>
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.requirementId ?? '').toLowerCase().includes(q),
    )
  }, [requirements, search])

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-900 rounded-lg shadow-2xl flex flex-col max-h-[90vh]">
        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-500/30 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              New validation items from requirements
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Pick the requirements you want to validate, then choose how and when. One
              validation item is created per requirement, automatically linked back to its source.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <X size={18} />
          </button>
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
                    className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-32"
                    title="Whether the requirement has acceptance criteria text. If yes, the criteria are seeded as validation criteria."
                  >
                    Has AC?
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
                        {r.requirementId ?? r.id.slice(0, 6)}
                      </td>
                      <td className="px-3 py-2 text-gray-900 dark:text-white">{r.title}</td>
                      <td className="px-3 py-2 text-xs">
                        {hasAc ? (
                          <span
                            className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"
                            title="Acceptance criteria will be seeded as validation criteria."
                          >
                            <Check size={12} /> Yes
                          </span>
                        ) : (
                          <span
                            className="text-gray-500 dark:text-gray-400"
                            title="No acceptance criteria — you'll add criteria manually after creation."
                          >
                            None
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
