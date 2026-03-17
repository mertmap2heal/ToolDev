import { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Link2, Unlink, ExternalLink, X } from 'lucide-react'
import { MOCK_HAZARDS, MOCK_ANALYSES } from '../../data/mockSafety'
import {
  MOCK_TRACEABILITY,
  MOCK_REQ_LABELS,
  MOCK_IFACE_LABELS,
  MOCK_VER_LABELS,
  MOCK_CR_LABELS,
} from '../../data/mockSafety'
import clsx from 'clsx'

type MatrixView = 'hazards-reqs' | 'hazards-ifaces' | 'hazards-ver' | 'hazards-cr' | 'analyses-hazards'

const VIEWS: { id: MatrixView; label: string; rowLabel: string; colLabel: string }[] = [
  { id: 'hazards-reqs', label: 'Hazards ↔ Requirements', rowLabel: 'Hazard', colLabel: 'Requirement' },
  { id: 'hazards-ifaces', label: 'Hazards ↔ Interfaces', rowLabel: 'Hazard', colLabel: 'Interface' },
  { id: 'hazards-ver', label: 'Hazards ↔ Verification', rowLabel: 'Hazard', colLabel: 'Verification' },
  { id: 'hazards-cr', label: 'Hazards ↔ Change Requests', rowLabel: 'Hazard', colLabel: 'Change Request' },
  { id: 'analyses-hazards', label: 'Analyses ↔ Hazards', rowLabel: 'Analysis', colLabel: 'Hazard' },
]

function getRows(view: MatrixView): { id: string; label: string }[] {
  if (view === 'analyses-hazards') {
    return Object.entries(MOCK_ANALYSES).flatMap(([method, list]) =>
      list.map((a) => ({ id: a.id, label: `${a.title} (${method})` }))
    )
  }
  return MOCK_HAZARDS.map((h) => ({ id: h.id, label: `${h.identifier}: ${h.title}` }))
}

function getCols(view: MatrixView): { id: string; label: string }[] {
  switch (view) {
    case 'hazards-reqs':
      return Object.entries(MOCK_REQ_LABELS).map(([id, label]) => ({ id, label }))
    case 'hazards-ifaces':
      return Object.entries(MOCK_IFACE_LABELS).map(([id, label]) => ({ id, label }))
    case 'hazards-ver':
      return Object.entries(MOCK_VER_LABELS).map(([id, label]) => ({ id, label }))
    case 'hazards-cr':
      return Object.entries(MOCK_CR_LABELS).map(([id, label]) => ({ id, label }))
    case 'analyses-hazards':
      return MOCK_HAZARDS.map((h) => ({ id: h.id, label: `${h.identifier}: ${h.title}` }))
    default:
      return []
  }
}

function isLinked(view: MatrixView, rowId: string, colId: string): boolean {
  const map = MOCK_TRACEABILITY[view === 'analyses-hazards' ? 'analysesHazards' : view === 'hazards-reqs' ? 'hazardsReqs' : view === 'hazards-ifaces' ? 'hazardsIfaces' : view === 'hazards-ver' ? 'hazardsVer' : 'hazardsCr']
  const rowEntries = map as Record<string, string[]>
  const arr = rowEntries[rowId]
  return !!arr?.includes(colId)
}

function getOpenModule(view: MatrixView): string {
  switch (view) {
    case 'hazards-reqs': return 'requirements'
    case 'hazards-ifaces': return '#'
    case 'hazards-ver': return 'verification'
    case 'hazards-cr': return 'change-requests'
    case 'analyses-hazards': return 'safety-analysis/hazards'
    default: return '#'
  }
}

export default function TraceabilityPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [view, setView] = useState<MatrixView>('hazards-reqs')
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; colId: string; rowLabel: string; colLabel: string } | null>(null)
  const [linkModal, setLinkModal] = useState(false)

  const rows = useMemo(() => getRows(view), [view])
  const cols = useMemo(() => getCols(view), [view])
  const openModule = getOpenModule(view)

  const handleOpenModule = () => {
    if (projectId && openModule !== '#') {
      navigate(`/projects/${projectId}/${openModule}`)
    }
  }
  const openModuleLabel = view === 'analyses-hazards' ? 'Hazards' : view === 'hazards-reqs' ? 'Requirements' : view === 'hazards-ver' ? 'Verification' : view === 'hazards-cr' ? 'Change Requests' : 'Module'

  return (
    <div className="flex gap-4">
      <div className="flex-1 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Traceability</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Matrix views. Highlight missing links. Link/Unlink are UI stubs.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium',
                view === v.id
                  ? 'bg-blue-600 text-white'
                  : 'border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                  {VIEWS.find((v) => v.id === view)?.rowLabel}
                </th>
                {cols.map((c) => (
                  <th
                    key={c.id}
                    className="text-center py-2 px-2 font-medium text-gray-700 dark:text-gray-300 border-b border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 max-w-[120px] truncate"
                    title={c.label}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-2 px-3 border-r border-gray-200 dark:border-gray-700 font-medium text-gray-900 dark:text-white max-w-[200px] truncate" title={r.label}>
                    {r.label}
                  </td>
                  {cols.map((c) => {
                    const linked = isLinked(view, r.id, c.id)
                    const missing = !linked
                    return (
                      <td
                        key={c.id}
                        onClick={() => setSelectedCell({ rowId: r.id, colId: c.id, rowLabel: r.label, colLabel: c.label })}
                        className={clsx(
                          'py-2 px-2 border-r border-gray-200 dark:border-gray-700 text-center cursor-pointer',
                          linked && 'bg-green-100 dark:bg-green-900/20',
                          missing && 'bg-amber-50 dark:bg-amber-900/10',
                          selectedCell?.rowId === r.id && selectedCell?.colId === c.id && 'ring-2 ring-blue-500 ring-inset'
                        )}
                      >
                        {linked ? '✓' : '—'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setLinkModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            <Link2 size={14} /> Link
          </button>
          <button
            onClick={() => alert('Unlink placeholder.')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            <Unlink size={14} /> Unlink
          </button>
          <button
            onClick={handleOpenModule}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
          >
            <ExternalLink size={14} /> Open in {openModuleLabel}
          </button>
        </div>
      </div>
      {selectedCell && (
        <div className="w-72 shrink-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Cell</h3>
            <button onClick={() => setSelectedCell(null)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X size={14} />
            </button>
          </div>
          <div className="text-xs space-y-2">
            <div><span className="text-gray-500">Row:</span> {selectedCell.rowLabel}</div>
            <div><span className="text-gray-500">Col:</span> {selectedCell.colLabel}</div>
            <div><span className="text-gray-500">Linked:</span> {isLinked(view, selectedCell.rowId, selectedCell.colId) ? 'Yes' : 'No (missing)'}</div>
          </div>
          <p className="text-xs text-gray-500 mt-3">Mock linked items. Link/Unlink open placeholder modals.</p>
        </div>
      )}
      {linkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Link (placeholder)</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">UI stub. Linking will be implemented later.</p>
            <button onClick={() => setLinkModal(false)} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
