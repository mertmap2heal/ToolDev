import { useState, useMemo } from 'react'
import { Plus, FileDown, ExternalLink, X } from 'lucide-react'
import type { CommunicationLogEntry, CommType, AudienceType } from '../types'
import { useStakeholdersStore } from '../store'
import PlaceholderLinkModal from './PlaceholderLinkModal'

const COMM_TYPES: CommType[] = ['Announcement', 'ReviewRequest', 'Decision', 'Note']

interface CommunicationTimelineProps {
  onShowToast: (msg: string) => void
  canEdit: boolean
}

export default function CommunicationTimeline({ onShowToast, canEdit }: CommunicationTimelineProps) {
  const { state, dispatch, nextCommId } = useStakeholdersStore()
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set())
  const [postOpen, setPostOpen] = useState(false)
  const [placeholderOpen, setPlaceholderOpen] = useState<CommunicationLogEntry | null>(null)

  const filtered = useMemo(() => {
    if (typeFilter.size === 0) return state.communicationLog
    return state.communicationLog.filter((c) => typeFilter.has(c.type))
  }, [state.communicationLog, typeFilter])

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()),
    [filtered]
  )

  const handleExport = () => {
    onShowToast('Export log is a placeholder. No file is generated.')
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {COMM_TYPES.map((t) => (
            <label key={t} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={typeFilter.has(t)}
                onChange={() =>
                  setTypeFilter((prev) => {
                    const next = new Set(prev)
                    if (next.has(t)) next.delete(t)
                    else next.add(t)
                    return next
                  })
                }
                className="rounded border-gray-300 dark:border-gray-600"
              />
              {t}
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300"
          >
            <FileDown size={16} />
            Export log
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => setPostOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={16} />
              Post announcement
            </button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {sorted.map((entry) => (
            <li key={entry.commId} className="px-6 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{entry.commId}</span>
                    <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded text-xs">{entry.type}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {entry.audience.type}: {entry.audience.ref}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{entry.summary}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(entry.timestamp).toLocaleString()} · {entry.createdBy}
                  </p>
                </div>
                {entry.linkedObject && (
                  <button
                    type="button"
                    onClick={() => setPlaceholderOpen(entry)}
                    className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                  >
                    <ExternalLink size={12} />
                    View linked
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {sorted.length === 0 && (
          <p className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">No communication entries.</p>
        )}
      </div>

      {postOpen && (
        <PostAnnouncementModal
          onClose={() => setPostOpen(false)}
          onPost={(entry) => {
            dispatch({ type: 'CREATE_COMM', payload: entry })
            onShowToast('Announcement posted.')
            setPostOpen(false)
          }}
          nextCommId={nextCommId}
          currentActor={state.role}
        />
      )}

      {placeholderOpen && (
        <PlaceholderLinkModal
          isOpen={!!placeholderOpen}
          onClose={() => setPlaceholderOpen(null)}
          title="View linked object"
          moduleName="Relevant module"
          filterKey="id"
          filterValue={placeholderOpen?.linkedObject?.id ?? '—'}
          previewColumns={['ID', 'Label', 'Status']}
          previewRows={[
            {
              ID: placeholderOpen?.linkedObject?.id ?? '—',
              Label: placeholderOpen?.summary?.slice(0, 30) ?? '—',
              Status: '—',
            },
          ]}
          onPlaceholderNavigate={() => onShowToast('Go to module is a placeholder.')}
        />
      )}
    </div>
  )
}

interface PostAnnouncementModalProps {
  onClose: () => void
  onPost: (entry: CommunicationLogEntry) => void
  nextCommId: () => string
  currentActor: string
}

function PostAnnouncementModal({
  onClose,
  onPost,
  nextCommId,
  currentActor,
}: PostAnnouncementModalProps) {
  const [type, setType] = useState<CommType>('Announcement')
  const [audienceType, setAudienceType] = useState<AudienceType>('All')
  const [audienceRef, setAudienceRef] = useState('*')
  const [summary, setSummary] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onPost({
      commId: nextCommId(),
      type,
      audience: { type: audienceType, ref: audienceRef },
      timestamp: new Date().toISOString(),
      summary,
      createdBy: currentActor,
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={onClose} role="dialog">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Post announcement</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" aria-label="Close">
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CommType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {COMM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Audience type</label>
            <select
              value={audienceType}
              onChange={(e) => setAudienceType(e.target.value as AudienceType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              <option value="All">All</option>
              <option value="Group">Group</option>
              <option value="StakeholderType">StakeholderType</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Audience ref</label>
            <input
              type="text"
              value={audienceRef}
              onChange={(e) => setAudienceRef(e.target.value)}
              placeholder="* or group ID or type"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Summary *</label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
