import { useState, useMemo } from 'react'
import { FileDown, Eye } from 'lucide-react'
import type { AuditEvent, AuditAction } from '../types'
import { useStakeholdersStore } from '../store'

const AUDIT_ACTIONS: AuditAction[] = [
  'CREATE_STAKEHOLDER',
  'UPDATE_STAKEHOLDER',
  'CREATE_GROUP',
  'UPDATE_GROUP',
  'ADD_MEMBER',
  'REMOVE_MEMBER',
  'CREATE_RACI',
  'UPDATE_RACI',
  'CREATE_RULE',
  'UPDATE_RULE',
  'CREATE_REQUEST',
  'UPDATE_REQUEST',
  'CREATE_COMM',
  'EXPORT_PLACEHOLDER',
]

interface AuditTrailTableProps {
  onShowToast: (msg: string) => void
}

export default function AuditTrailTable({ onShowToast }: AuditTrailTableProps) {
  const { state } = useStakeholdersStore()
  const [actorFilter, setActorFilter] = useState<Set<string>>(new Set())
  const [actionFilter, setActionFilter] = useState<Set<string>>(new Set())
  const [auditMode, setAuditMode] = useState(false)

  const actors = useMemo(
    () => [...new Set(state.auditEvents.map((e) => e.actor))].sort(),
    [state.auditEvents]
  )

  const filtered = useMemo(() => {
    let list = state.auditEvents
    if (actorFilter.size > 0) list = list.filter((e) => actorFilter.has(e.actor))
    if (actionFilter.size > 0) list = list.filter((e) => actionFilter.has(e.action))
    return [...list].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [state.auditEvents, actorFilter, actionFilter])

  const toggleActor = (a: string) => {
    setActorFilter((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }

  const toggleAction = (a: string) => {
    setActionFilter((prev) => {
      const next = new Set(prev)
      if (next.has(a)) next.delete(a)
      else next.add(a)
      return next
    })
  }

  const handleExport = () => {
    onShowToast('Export audit log is a placeholder. No file is generated.')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Actor</span>
            {actors.slice(0, 10).map((a) => (
              <label key={a} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={actorFilter.has(a)}
                  onChange={() => toggleActor(a)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
                {a}
              </label>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Action</span>
            <select
              value={actionFilter.size === 0 ? '' : Array.from(actionFilter)[0]}
              onChange={(e) => {
                const v = e.target.value
                setActionFilter(v ? new Set([v]) : new Set())
              }}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="">All</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Eye size={16} />
            <input
              type="checkbox"
              checked={auditMode}
              onChange={(e) => setAuditMode(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Audit mode (more details)
          </label>
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
          >
            <FileDown size={16} />
            Export audit log
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm text-gray-900 dark:text-white">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Event ID</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Timestamp</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Actor</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Action</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Object</th>
              {auditMode && <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Details</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map((e) => (
              <tr key={e.eventId}>
                <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-white">{e.eventId}</td>
                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                  {new Date(e.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{e.actor}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{e.action}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">
                  {e.objectRef.kind}:{e.objectRef.id}
                </td>
                {auditMode && <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{e.details}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">No audit events match the filters.</p>
        )}
      </div>
    </div>
  )
}
