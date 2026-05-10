import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, X } from 'lucide-react'
import { requirementService } from '../../services/requirement.service'

interface Props {
  projectId: string
  excludeRequirementIds?: string[]
  onPick: (requirementId: string) => void
  onCancel: () => void
}

/**
 * Inline requirement picker for the Validation drawer "Linked requirements"
 * section. Shows a searchable list of project requirements and emits a single
 * pick. Excludes requirements already linked.
 */
export default function LinkRequirementPicker({
  projectId,
  excludeRequirementIds = [],
  onPick,
  onCancel,
}: Props) {
  const [search, setSearch] = useState('')
  const exclude = useMemo(() => new Set(excludeRequirementIds), [excludeRequirementIds])

  const { data: requirements = [], isLoading } = useQuery({
    queryKey: ['requirements-for-validation-link', projectId],
    queryFn: async () => {
      const res = await requirementService.getAllRequirements(projectId)
      return res.success && res.data ? res.data : []
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requirements.filter((r) => {
      if (exclude.has(r.id)) return false
      if (!q) return true
      return (
        (r.title ?? '').toLowerCase().includes(q) ||
        (r.requirementId ?? '').toLowerCase().includes(q)
      )
    })
  }, [requirements, search, exclude])

  return (
    <div className="border border-blue-200 dark:border-blue-700 rounded-md bg-blue-50 dark:bg-blue-900/10 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800">
          <Search size={12} className="text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search requirement…"
            className="flex-1 text-xs bg-transparent border-0 focus:ring-0 text-gray-900 dark:text-white"
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel"
          className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900">
        {isLoading ? (
          <p className="p-3 text-xs text-gray-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-xs text-gray-500 italic">
            {requirements.length === 0
              ? 'No requirements in this project yet.'
              : 'No requirements match your search.'}
          </p>
        ) : (
          <ul>
            {filtered.slice(0, 50).map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onPick(r.id)}
                  className="w-full text-left px-2 py-1.5 text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                >
                  <span className="font-mono text-blue-700 dark:text-blue-300 w-20 truncate">
                    {r.requirementId ?? r.id.slice(0, 6)}
                  </span>
                  <span className="text-gray-900 dark:text-white truncate">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
