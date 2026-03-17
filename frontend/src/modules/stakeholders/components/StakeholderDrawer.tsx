import { useEffect, useState } from 'react'
import { X, Mail, Edit2, Layers, FileText, Target, Shield } from 'lucide-react'
import clsx from 'clsx'
import type { Stakeholder } from '../types'
import { useStakeholdersStore } from '../store'
import PlaceholderLinkModal from './PlaceholderLinkModal'

interface StakeholderDrawerProps {
  stakeholder: Stakeholder | null
  isOpen: boolean
  onClose: () => void
  onEdit: () => void
  onShowToast: (msg: string) => void
  canEdit: boolean
}

const PLACEHOLDER_BASELINES = [
  { ID: 'BL-2026-01', Label: 'SRR Baseline', Status: 'Approved' },
  { ID: 'BL-2026-02', Label: 'PDR Baseline', Status: 'In Review' },
  { ID: 'BL-2026-03', Label: 'CDR Baseline', Status: 'Draft' },
]
const PLACEHOLDER_OBJECTIVES = [
  { ID: 'OBJ-001', Label: 'CS 25.1309', Status: 'Complete' },
  { ID: 'OBJ-002', Label: 'DO-178C', Status: 'Open' },
]
const PLACEHOLDER_EVIDENCE = [
  { ID: 'EV-001', Label: 'Test Report TR-001', Status: 'Approved' },
  { ID: 'EV-002', Label: 'Analysis Report', Status: 'Draft' },
]
const PLACEHOLDER_SAFETY = [
  { ID: 'HAZ-001', Label: 'Hazard 1', Status: 'Mitigated' },
  { ID: 'HAZ-002', Label: 'Hazard 2', Status: 'Open' },
]

export default function StakeholderDrawer({
  stakeholder,
  isOpen,
  onClose,
  onEdit,
  onShowToast,
  canEdit,
}: StakeholderDrawerProps) {
  const { state } = useStakeholdersStore()

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      return () => document.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onClose])

  const [linkModal, setLinkModal] = useState<
    | { title: string; module: string; key: string; value: string; cols: string[]; rows: Record<string, string>[] }
    | null
  >(null)

  if (!stakeholder) return null

  const committees = state.committees.filter((c) => c.members.includes(stakeholder.stakeholderId))
  const raciEntries = state.raci.filter(
    (r) =>
      r.responsible.includes(stakeholder.stakeholderId) ||
      r.accountable.includes(stakeholder.stakeholderId) ||
      r.consulted.includes(stakeholder.stakeholderId) ||
      r.informed.includes(stakeholder.stakeholderId)
  )
  const requests = state.requests.filter(
    (r) => r.targetType === 'Stakeholder' && r.targetId === stakeholder.stakeholderId
  )

  const openPlaceholder = (
    title: string,
    module: string,
    key: string,
    value: string,
    cols: string[],
    rows: Record<string, string>[]
  ) => setLinkModal({ title, module, key, value, cols, rows })

  return (
    <>
      <div
        className={clsx(
          'h-full bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out overflow-hidden fixed right-0 top-0 z-40',
          isOpen ? 'w-full max-w-2xl min-w-[32rem]' : 'w-0 min-w-0'
        )}
        style={{ height: 'calc(100vh - 4rem)', top: '4rem' }}
        role="region"
        aria-label="Stakeholder details"
      >
        <div className="flex flex-col h-full overflow-y-auto">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-gray-600 dark:text-gray-400">{stakeholder.stakeholderId}</span>
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    stakeholder.status === 'Active'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {stakeholder.status}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{stakeholder.displayName}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">{stakeholder.organization}</p>
            </div>
            <div className="flex items-center gap-2">
              {canEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  aria-label="Edit"
                >
                  <Edit2 size={18} className="text-gray-600 dark:text-gray-400" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Close"
              >
                <X size={20} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-6">
            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Profile</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-500 dark:text-gray-400">Type</dt>
                <dd className="text-gray-900 dark:text-white">{stakeholder.stakeholderType}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Discipline</dt>
                <dd className="text-gray-900 dark:text-white">{stakeholder.discipline}</dd>
                <dt className="text-gray-500 dark:text-gray-400">Authority</dt>
                <dd className="text-gray-900 dark:text-white">{stakeholder.authorityLevel}</dd>
                {stakeholder.location && (
                  <>
                    <dt className="text-gray-500 dark:text-gray-400">Location</dt>
                    <dd className="text-gray-900 dark:text-white">{stakeholder.location}</dd>
                  </>
                )}
              </dl>
              {stakeholder.contact && (stakeholder.contact.email || stakeholder.contact.phone) && (
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-gray-500 dark:text-gray-400" />
                  {stakeholder.contact.email && <span>{stakeholder.contact.email}</span>}
                  {stakeholder.contact.phone && <span>{stakeholder.contact.phone}</span>}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Roles & Scopes</h3>
              <div className="flex flex-wrap gap-2">
                {stakeholder.roles.map((r) => (
                  <span
                    key={r}
                    className="px-2 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 rounded text-xs"
                  >
                    {r}
                  </span>
                ))}
                {stakeholder.scopes.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Committee memberships</h3>
              {committees.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {committees.map((c) => (
                    <li key={c.groupId} className="text-gray-900 dark:text-white">
                      {c.name} ({c.groupId})
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Responsibilities (RACI)</h3>
              {raciEntries.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {raciEntries.slice(0, 8).map((r) => (
                    <li key={r.raciId} className="text-gray-900 dark:text-white">
                      {r.subjectRef} — R/A/C/I
                    </li>
                  ))}
                  {raciEntries.length > 8 && (
                    <li className="text-gray-500 dark:text-gray-400">+{raciEntries.length - 8} more</li>
                  )}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Requests assigned</h3>
              {requests.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">None</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {requests.slice(0, 5).map((r) => (
                    <li key={r.requestId} className="text-gray-900 dark:text-white">
                      {r.title} — {r.status}
                    </li>
                  ))}
                  {requests.length > 5 && (
                    <li className="text-gray-500 dark:text-gray-400">+{requests.length - 5} more</li>
                  )}
                </ul>
              )}
            </section>

            <section>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Linked items (placeholder)</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPlaceholder(
                      'View linked Baselines',
                      'Configuration Management',
                      'stakeholderId',
                      stakeholder.stakeholderId,
                      ['ID', 'Label', 'Status'],
                      PLACEHOLDER_BASELINES
                    )
                  }
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Layers size={14} />
                  View linked Baselines
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openPlaceholder(
                      'View linked Objectives',
                      'Certification',
                      'stakeholderId',
                      stakeholder.stakeholderId,
                      ['ID', 'Label', 'Status'],
                      PLACEHOLDER_OBJECTIVES
                    )
                  }
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Target size={14} />
                  View linked Objectives
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openPlaceholder(
                      'View linked Test Evidence',
                      'Verification',
                      'stakeholderId',
                      stakeholder.stakeholderId,
                      ['ID', 'Label', 'Status'],
                      PLACEHOLDER_EVIDENCE
                    )
                  }
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FileText size={14} />
                  View linked Test Evidence
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openPlaceholder(
                      'View linked Safety Artifacts',
                      'Safety Analysis',
                      'stakeholderId',
                      stakeholder.stakeholderId,
                      ['ID', 'Label', 'Status'],
                      PLACEHOLDER_SAFETY
                    )
                  }
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <Shield size={14} />
                  View linked Safety Artifacts
                </button>
              </div>
            </section>

            {stakeholder.notes && (
              <section>
                <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">Notes</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{stakeholder.notes}</p>
              </section>
            )}
          </div>
        </div>
      </div>

      {linkModal && (
        <PlaceholderLinkModal
          isOpen={!!linkModal}
          onClose={() => setLinkModal(null)}
          title={linkModal.title}
          moduleName={linkModal.module}
          filterKey={linkModal.key}
          filterValue={linkModal.value}
          previewColumns={linkModal.cols}
          previewRows={linkModal.rows}
          onPlaceholderNavigate={() => onShowToast('Go to module is a placeholder.')}
        />
      )}
    </>
  )
}
