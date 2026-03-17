import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { Filter, ChevronDown, ChevronUp, Download } from 'lucide-react'
import { useCMStore } from './store'
import type { AuditAction } from './types'

const AUDIT_ACTIONS: AuditAction[] = [
  'CREATE_CI', 'UPDATE_CI', 'FREEZE_BASELINE', 'APPROVE_BASELINE', 'CREATE_RELEASE',
  'LOCK_CI', 'UNLOCK_CI', 'CREATE_DW', 'APPROVE_DW', 'SUBMIT_CR', 'APPROVE_CR', 'REJECT_CR', 'APPLY_CR_VERSIONS',
]

export default function AuditTrailTab() {
  const { state } = useCMStore()
  const [actorFilter, setActorFilter] = useState<Set<string>>(new Set())
  const [actionFilter, setActionFilter] = useState<Set<string>>(new Set())
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [exportPlaceholder, setExportPlaceholder] = useState(false)

  const actors = useMemo(
    () => Array.from(new Set(state.auditLog.map((e) => e.actor).filter(Boolean))),
    [state.auditLog]
  )

  const filtered = useMemo(() => {
    return state.auditLog.filter((e) => {
      if (actorFilter.size > 0 && !actorFilter.has(e.actor)) return false
      if (actionFilter.size > 0 && !actionFilter.has(e.action)) return false
      const ts = new Date(e.timestamp).getTime()
      if (dateFrom && ts < new Date(dateFrom).getTime()) return false
      if (dateTo && ts > new Date(dateTo + 'T23:59:59').getTime()) return false
      return true
    })
  }, [state.auditLog, actorFilter, actionFilter, dateFrom, dateTo])

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filtered]
  )

  const toggleActor = (a: string) => {
    setActorFilter((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a); else next.add(a)
      return next
    })
  }
  const toggleAction = (a: AuditAction) => {
    setActionFilter((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a); else next.add(a)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={() => setFiltersExpanded((e) => !e)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">
          <Filter size={16} /> Filters {filtersExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        <button type="button" onClick={() => setExportPlaceholder(true)} className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
          <Download size={16} /> Export Audit Log
        </button>
      </div>
      {filtersExpanded && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Actor</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {actors.map((a) => (
                  <label key={a} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="checkbox" checked={actorFilter.has(a)} onChange={() => toggleActor(a)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600" />
                    {a}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Action</label>
              <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                {AUDIT_ACTIONS.map((a) => (
                  <label key={a} className="flex items-center gap-1 cursor-pointer text-sm">
                    <input type="checkbox" checked={actionFilter.has(a)} onChange={() => toggleAction(a)} className="rounded border-gray-300 dark:border-gray-600 text-blue-600" />
                    {a}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Date range</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-2" />
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          </div>
        </div>
      )}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">Immutable append-only audit log. {sorted.length} event(s).</p>
        </div>
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Time</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Actor</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Action</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Object</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {sorted.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500 dark:text-gray-400">No audit events match.</td></tr>
              ) : (
                sorted.map((e) => (
                  <tr key={e.eventId} className="text-gray-700 dark:text-gray-300">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{format(new Date(e.timestamp), 'yyyy-MM-dd HH:mm:ss')}</td>
                    <td className="px-4 py-2">{e.actor}</td>
                    <td className="px-4 py-2"><span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-xs font-medium">{e.action}</span></td>
                    <td className="px-4 py-2 font-mono text-xs">{e.objectRef}</td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400 truncate max-w-[200px]">{e.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {exportPlaceholder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setExportPlaceholder(false)} role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <p className="text-gray-700 dark:text-gray-300 text-sm">Export placeholder; no file generated.</p>
            <div className="mt-4 flex justify-end">
              <button type="button" onClick={() => setExportPlaceholder(false)} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
