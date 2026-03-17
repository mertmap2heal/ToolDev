import { useState, useMemo } from 'react'
import { Plus, AlertTriangle, User, LayoutGrid, List } from 'lucide-react'
import type { RaciEntry, RaciSubjectType } from '../types'
import { useStakeholdersStore } from '../store'
import PlaceholderLinkModal from './PlaceholderLinkModal'

type RaciView = 'matrix' | 'byStakeholder' | 'gaps'

const SUBJECT_TYPES: RaciSubjectType[] = ['Module', 'SystemElement', 'Deliverable']

interface RaciMatrixProps {
  onShowToast: (msg: string) => void
  canEdit: boolean
}

export default function RaciMatrix({ onShowToast, canEdit }: RaciMatrixProps) {
  const { state, dispatch, nextRaciId } = useStakeholdersStore()
  const [view, setView] = useState<RaciView>('matrix')
  const [selectedStakeholderId, setSelectedStakeholderId] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editEntry, setEditEntry] = useState<RaciEntry | null>(null)
  const [placeholderOpen, setPlaceholderOpen] = useState(false)

  const getStakeholderName = (id: string) => state.stakeholders.find((s) => s.stakeholderId === id)?.displayName ?? id

  const gaps = useMemo(
    () => state.raci.filter((r) => r.accountable.length === 0 || r.riskFlag),
    [state.raci]
  )

  const byStakeholderEntries = useMemo(() => {
    if (!selectedStakeholderId) return []
    return state.raci.filter(
      (r) =>
        r.responsible.includes(selectedStakeholderId) ||
        r.accountable.includes(selectedStakeholderId) ||
        r.consulted.includes(selectedStakeholderId) ||
        r.informed.includes(selectedStakeholderId)
    )
  }, [state.raci, selectedStakeholderId])

  const formatRole = (entry: RaciEntry, stakeholderId: string) => {
    const roles: string[] = []
    if (entry.responsible.includes(stakeholderId)) roles.push('R')
    if (entry.accountable.includes(stakeholderId)) roles.push('A')
    if (entry.consulted.includes(stakeholderId)) roles.push('C')
    if (entry.informed.includes(stakeholderId)) roles.push('I')
    return roles.join(', ')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('matrix')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              view === 'matrix'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            <LayoutGrid size={16} />
            Matrix
          </button>
          <button
            type="button"
            onClick={() => setView('byStakeholder')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              view === 'byStakeholder'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            <User size={16} />
            By Stakeholder
          </button>
          <button
            type="button"
            onClick={() => setView('gaps')}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              view === 'gaps'
                ? 'bg-blue-600 text-white'
                : 'bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
            }`}
          >
            <AlertTriangle size={16} />
            Gaps & Risks
          </button>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setEditEntry(null)
              setModalOpen(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Plus size={16} />
            Create RACI Entry
          </button>
        )}
      </div>

      {view === 'matrix' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto">
          <table className="w-full text-sm min-w-[600px] text-gray-900 dark:text-white">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Subject</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Responsible</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Accountable</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Consulted</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Informed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {state.raci.map((r) => (
                <tr key={r.raciId} className={r.riskFlag ? 'bg-amber-50 dark:bg-amber-900/10' : ''}>
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.subjectRef}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.subjectType}</td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {r.responsible.map((id) => getStakeholderName(id)).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {r.accountable.map((id) => getStakeholderName(id)).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {r.consulted.map((id) => getStakeholderName(id)).join(', ') || '—'}
                  </td>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                    {r.informed.map((id) => getStakeholderName(id)).join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'byStakeholder' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Stakeholder</label>
            <select
              value={selectedStakeholderId}
              onChange={(e) => setSelectedStakeholderId(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm min-w-[200px]"
            >
              <option value="">Select…</option>
              {state.stakeholders.map((s) => (
                <option key={s.stakeholderId} value={s.stakeholderId}>
                  {s.displayName} ({s.stakeholderId})
                </option>
              ))}
            </select>
          </div>
          {selectedStakeholderId && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Subject</th>
                    <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Type</th>
                    <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {byStakeholderEntries.map((r) => (
                    <tr key={r.raciId}>
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.subjectRef}</td>
                      <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.subjectType}</td>
                      <td className="px-4 py-2 text-gray-900 dark:text-white">{formatRole(r, selectedStakeholderId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {byStakeholderEntries.length === 0 && (
                <p className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No RACI assignments.</p>
              )}
            </div>
          )}
        </div>
      )}

      {view === 'gaps' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <p className="px-4 py-2 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20">
            Subjects with no Accountable or risk flag.
          </p>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Subject</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Type</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Accountable</th>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {gaps.map((r) => (
                <tr key={r.raciId} className="bg-amber-50 dark:bg-amber-900/10">
                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-white">{r.subjectRef}</td>
                  <td className="px-4 py-2">{r.subjectType}</td>
                  <td className="px-4 py-2">
                    {r.accountable.length === 0
                      ? '—'
                      : r.accountable.map((id) => getStakeholderName(id)).join(', ')}
                  </td>
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{r.riskFlag ? 'Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {gaps.length === 0 && (
            <p className="px-4 py-6 text-center text-gray-500 dark:text-gray-400">No gaps or risks.</p>
          )}
        </div>
      )}

      {modalOpen && (
        <RaciEditModal
          entry={editEntry}
          onClose={() => {
            setModalOpen(false)
            setEditEntry(null)
          }}
          onSave={(entry) => {
            if (editEntry) {
              dispatch({ type: 'UPDATE_RACI', payload: entry })
              onShowToast('RACI entry updated.')
            } else {
              dispatch({ type: 'CREATE_RACI', payload: entry })
              onShowToast('RACI entry created.')
            }
            setModalOpen(false)
            setEditEntry(null)
          }}
          state={state}
          nextRaciId={nextRaciId}
          onOpenSubjectPlaceholder={() => setPlaceholderOpen(true)}
        />
      )}

      {placeholderOpen && (
        <PlaceholderLinkModal
          isOpen={true}
          onClose={() => setPlaceholderOpen(false)}
          title="Open subject in module"
          moduleName="Relevant module"
          filterKey="subjectRef"
          filterValue="—"
          previewColumns={['ID', 'Label', 'Status']}
          previewRows={[
            { ID: 'CP-001', Label: 'Certification Package', Status: 'Draft' },
            { ID: 'BL-001', Label: 'Baseline', Status: 'Approved' },
          ]}
          onPlaceholderNavigate={() => onShowToast('Go to module is a placeholder.')}
        />
      )}
    </div>
  )
}

interface RaciEditModalProps {
  entry: RaciEntry | null
  onClose: () => void
  onSave: (entry: RaciEntry) => void
  state: { stakeholders: { stakeholderId: string; displayName: string }[] }
  nextRaciId: () => string
  onOpenSubjectPlaceholder: () => void
}

function RaciEditModal({
  entry,
  onClose,
  onSave,
  state,
  nextRaciId,
  onOpenSubjectPlaceholder,
}: RaciEditModalProps) {
  const [subjectType, setSubjectType] = useState<RaciSubjectType>(entry?.subjectType ?? 'Deliverable')
  const [subjectRef, setSubjectRef] = useState(entry?.subjectRef ?? '')
  const [responsible, setResponsible] = useState<string[]>(entry?.responsible ?? [])
  const [accountable, setAccountable] = useState<string[]>(entry?.accountable ?? [])
  const [consulted, setConsulted] = useState<string[]>(entry?.consulted ?? [])
  const [informed, setInformed] = useState<string[]>(entry?.informed ?? [])

  const toggleInList = (list: string[], setList: (v: string[]) => void, id: string) => {
    if (list.includes(id)) setList(list.filter((x) => x !== id))
    else setList([...list, id])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const raciId = entry?.raciId ?? nextRaciId()
    onSave({
      raciId,
      subjectType,
      subjectRef,
      responsible,
      accountable,
      consulted,
      informed,
      riskFlag: accountable.length === 0,
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {entry ? 'Edit RACI Entry' : 'Create RACI Entry'}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject type</label>
            <select
              value={subjectType}
              onChange={(e) => setSubjectType(e.target.value as RaciSubjectType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {SUBJECT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Subject ref</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={subjectRef}
                onChange={(e) => setSubjectRef(e.target.value)}
                required
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              />
              <button type="button" onClick={onOpenSubjectPlaceholder} className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm">
                Open in module
              </button>
            </div>
          </div>
          {(['Responsible', 'Accountable', 'Consulted', 'Informed'] as const).map((label, i) => {
            const key = label.toLowerCase().slice(0, 1) as 'r' | 'a' | 'c' | 'i'
            const stateKeys = { r: responsible, a: accountable, c: consulted, i: informed }
            const setters = { r: setResponsible, a: setAccountable, c: setConsulted, i: setInformed }
            const list = stateKeys[key]
            const setList = setters[key]
            return (
              <div key={label}>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</label>
                <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                  {state.stakeholders.map((s) => (
                    <label key={s.stakeholderId} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={list.includes(s.stakeholderId)}
                        onChange={() => toggleInList(list, setList, s.stakeholderId)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      {s.displayName}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              {entry ? 'Save' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
