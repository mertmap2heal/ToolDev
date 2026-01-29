import { useState } from 'react'
import {
  X,
  Link2,
  FileText,
  Settings,
  Sliders,
  Network,
  CheckCircle2,
  ClipboardCheck,
  GitBranch,
  AlertCircle,
  Activity,
  Archive,
  FileSearch,
  ExternalLink,
} from 'lucide-react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Hazard } from '../../types/safety.types'
import { MOCK_ANALYSES } from '../../data/mockSafety'
import clsx from 'clsx'
import { format } from 'date-fns'

interface HazardDetailDrawerProps {
  isOpen: boolean
  hazard: Hazard | null
  projectId: string
  onClose: () => void
}

const TRACEABILITY_PANELS: { id: string; label: string; module: string; path: string; icon: React.ElementType }[] = [
  { id: 'req', label: 'Requirements', module: 'Requirements', path: 'requirements', icon: FileText },
  { id: 'fn', label: 'Functions', module: 'Functions', path: 'functions', icon: Settings },
  { id: 'param', label: 'Parameters', module: 'Parameters', path: 'parameters', icon: Sliders },
  { id: 'iface', label: 'Interfaces', module: 'Interfaces', path: '#', icon: Network },
  { id: 'ver', label: 'Verification Items', module: 'Verification', path: 'verification', icon: CheckCircle2 },
  { id: 'test', label: 'Test Plans', module: 'Test Plans', path: 'verification', icon: ClipboardCheck },
  { id: 'cr', label: 'Change Requests', module: 'Change Requests', path: 'change-requests', icon: GitBranch },
  { id: 'iss', label: 'Issues', module: 'Issues', path: 'issues', icon: AlertCircle },
  { id: 'lc', label: 'Lifecycle Phase', module: 'Lifecycle Status', path: 'lifecycle-status', icon: Activity },
  { id: 'bl', label: 'Baseline', module: 'Configuration / Baselines', path: 'lifecycle', icon: Archive },
]

const MOCK_LINKED_ITEMS: Record<string, string[]> = {
  req: ['REQ-001', 'REQ-002'],
  fn: ['F-101'],
  param: ['P-01'],
  iface: [],
  ver: ['VER-01'],
  test: ['TP-01'],
  cr: ['CR-001'],
  iss: [],
  lc: ['Design'],
  bl: ['BL-001'],
}

const MOCK_HISTORY = [
  { id: 'v1', version: 'v1.2', date: '2025-01-20T10:00:00Z', user: 'admin', comment: 'Updated severity.' },
  { id: 'v2', version: 'v1.1', date: '2025-01-18T14:00:00Z', user: 'safety_eng', comment: 'Initial draft.' },
]

export default function HazardDetailDrawer({
  isOpen,
  hazard,
  projectId,
  onClose,
}: HazardDetailDrawerProps) {
  const [linkModalStub, setLinkModalStub] = useState<string | null>(null)
  const navigate = useNavigate()

  const openInModule = (path: string) => {
    if (path === '#') return
    if (projectId) navigate(`/projects/${projectId}/${path}`)
  }

  const relatedAnalyses = hazard
    ? Object.entries(MOCK_ANALYSES).flatMap(([method, list]) =>
        list.map((a) => ({ ...a, method }))
      ).slice(0, 6)
    : []

  if (!hazard) return null

  return (
    <div
      className={clsx(
        'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 overflow-hidden',
        isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
      )}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Hazard Detail</h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* A) Hazard Definition */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Hazard Definition</h4>
          <div className="space-y-3 text-sm">
            <div>
              <label className="block text-gray-500 dark:text-gray-400 mb-1">Title</label>
              <div className="text-gray-900 dark:text-white">{hazard.title}</div>
            </div>
            <div>
              <label className="block text-gray-500 dark:text-gray-400 mb-1">Description</label>
              <div className="text-gray-700 dark:text-gray-300">{hazard.description}</div>
            </div>
            <div className="flex gap-4">
              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1">Severity</label>
                <select
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  defaultValue={hazard.severity}
                >
                  <option>Catastrophic</option>
                  <option>Hazardous</option>
                  <option>Major</option>
                  <option>Minor</option>
                  <option>No Safety Effect</option>
                </select>
              </div>
              <div>
                <label className="block text-gray-500 dark:text-gray-400 mb-1">Status</label>
                <select
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  defaultValue={hazard.status}
                >
                  <option>Draft</option>
                  <option>Open</option>
                  <option>Mitigated</option>
                  <option>Verified</option>
                  <option>Closed</option>
                </select>
              </div>
            </div>
          </div>
        </section>

        {/* B) Traceability Panels */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Traceability</h4>
          <div className="space-y-3">
            {TRACEABILITY_PANELS.map(({ id, label, module, path, icon: Icon }) => {
              const items = MOCK_LINKED_ITEMS[id] ?? []
              return (
                <div
                  key={id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Icon size={14} />
                      {label}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setLinkModalStub(id)}
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
                      >
                        Link
                      </button>
                      <button
                        onClick={() => openInModule(path)}
                        className="text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 flex items-center gap-1"
                      >
                        Open in {module}
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  </div>
                  <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                    {items.length > 0
                      ? items.map((x) => <li key={x}>{x}</li>)
                      : <li className="italic">No links (placeholder)</li>}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* C) Related Analyses */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <FileSearch size={14} />
            Related Analyses
          </h4>
          <ul className="space-y-2">
            {relatedAnalyses.length > 0
              ? relatedAnalyses.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="text-sm text-gray-700 dark:text-gray-300 flex justify-between"
                  >
                    <span>{a.title}</span>
                    <span className="text-gray-500 dark:text-gray-400">{a.method}</span>
                  </li>
                ))
              : <li className="text-sm text-gray-500 dark:text-gray-400 italic">None (mock)</li>}
          </ul>
        </section>

        {/* D) History */}
        <section>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">History</h4>
          <ul className="space-y-2">
            {MOCK_HISTORY.map((h) => (
              <li
                key={h.id}
                className="text-sm border-l-2 border-gray-200 dark:border-gray-600 pl-3 py-1"
              >
                <span className="font-medium text-gray-700 dark:text-gray-300">{h.version}</span>{' '}
                <span className="text-gray-500 dark:text-gray-400">
                  {format(new Date(h.date), 'PPp')} · {h.user}
                </span>
                <div className="text-gray-600 dark:text-gray-400">{h.comment}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Link modal stub */}
      {linkModalStub && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-sm w-full mx-4 shadow-xl">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Link (placeholder)
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Linking will be implemented later. This is a UI stub.
            </p>
            <button
              onClick={() => setLinkModalStub(null)}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
