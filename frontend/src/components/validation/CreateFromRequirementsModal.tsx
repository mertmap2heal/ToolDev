import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Search, AlertCircle } from 'lucide-react'
import { requirementService } from '../../services/requirement.service'
import {
  validationService,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  type ValidationMethodType,
  type ValidationMilestone,
} from '../../services/validation.service'

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
              Create validation items from requirements
            </h2>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              For each selected requirement, an item is created with its acceptance criteria seeded
              as criteria.
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

        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
            <Search size={14} className="text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title or REQ-### key…"
              className="flex-1 text-sm bg-transparent border-0 focus:ring-0 text-gray-900 dark:text-white"
            />
          </div>
          <select
            value={methodType}
            onChange={(e) => setMethodType(e.target.value as ValidationMethodType)}
            className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          >
            {VALIDATION_METHOD_TYPES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            value={targetMilestone}
            onChange={(e) => setTargetMilestone(e.target.value as ValidationMilestone)}
            className="px-2 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
          >
            {VALIDATION_MILESTONES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
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
                  <th className="w-10 px-3 py-2"></th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">
                    Key
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300">
                    Title
                  </th>
                  <th className="text-left px-3 py-2 font-semibold text-gray-700 dark:text-gray-300 w-28">
                    AC?
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
                      <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
                        {hasAc ? 'yes' : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {selected.size} selected
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
              {submitting ? 'Creating…' : `Create ${selected.size} item${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
