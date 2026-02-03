import { useState, useMemo } from 'react'
import { Filter, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import { useStakeholdersStore } from '../store'
import type { Committee } from '../types'

const COMMITTEE_TYPES = ['CCB', 'ReviewBoard', 'AuthorityInterface', 'SupplierPanel', 'ProgramGovernance']

interface CommitteeTableProps {
  onSelectCommittee: (c: Committee | null) => void
  typeFilter?: string
  onCreateCommittee?: () => void
  canEdit?: boolean
}

export default function CommitteeTable({ onSelectCommittee, typeFilter: initialTypeFilter, onCreateCommittee, canEdit }: CommitteeTableProps) {
  const { state } = useStakeholdersStore()
  const [typeFilter, setTypeFilter] = useState<Set<string>>(
    initialTypeFilter ? new Set([initialTypeFilter]) : new Set()
  )
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  const filtered = useMemo(() => {
    if (typeFilter.size === 0) return state.committees
    return state.committees.filter((c) => typeFilter.has(c.type))
  }, [state.committees, typeFilter])

  const getStakeholderName = (id: string) => state.stakeholders.find((s) => s.stakeholderId === id)?.displayName ?? id

  const toggleType = (t: string) => {
    setTypeFilter((prev) => {
      const next = new Set(prev)
      if (next.has(t)) next.delete(t)
      else next.add(t)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => setFiltersExpanded((x) => !x)}
          className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
        >
          <Filter size={16} />
          Filters
          {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {canEdit && onCreateCommittee && (
          <button
            type="button"
            onClick={onCreateCommittee}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Plus size={16} />
            Create committee
          </button>
        )}
      </div>
      {filtersExpanded && (
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg flex flex-wrap gap-2">
          {COMMITTEE_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={typeFilter.has(t)}
                onChange={() => toggleType(t)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              {t}
            </label>
          ))}
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-gray-900 dark:text-white">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">ID</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Type</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Members</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Chair</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Cadence</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                  No committees match the filters.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr
                  key={c.groupId}
                  onClick={() => onSelectCommittee(c)}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-white">{c.groupId}</td>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">
                    {c.name}
                    {c.type === 'AuthorityInterface' && (
                      <span className="ml-2 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 rounded text-xs">
                        Authority Interface
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{c.type}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{c.members.length}</td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{c.chair ? getStakeholderName(c.chair) : '—'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{c.meetingCadence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
