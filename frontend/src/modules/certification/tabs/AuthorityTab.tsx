import { useState, useEffect, useCallback } from 'react'
import { Plus, Mail, Calendar, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useCertificationStore } from '../store'
import {
  getCorrespondence,
  getMeetings,
  createCorrespondence,
  createMeeting,
  createActionItem,
  updateActionItem,
  deleteCorrespondence,
  deleteActionItem,
} from '../../../services/certification.service'
import type { Correspondence, Meeting, ActionItem } from '../types'

type View = 'correspondence' | 'meetings'

export default function AuthorityTab() {
  const { state } = useCertificationStore()
  const projectId = state.context.projectId
  const [view, setView] = useState<View>('correspondence')
  const [correspondence, setCorrespondence] = useState<Correspondence[]>([])
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(false)
  const [addCorrOpen, setAddCorrOpen] = useState(false)
  const [addMeetingOpen, setAddMeetingOpen] = useState(false)
  const [addActionMeetingId, setAddActionMeetingId] = useState<string | null>(null)
  const [expandedMeetings, setExpandedMeetings] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const [corrRes, meetRes] = await Promise.all([
      getCorrespondence(projectId),
      getMeetings(projectId),
    ])
    if (corrRes.success && corrRes.data) setCorrespondence(corrRes.data)
    if (meetRes.success && meetRes.data) setMeetings(meetRes.data)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const toggleMeeting = (id: string) => {
    setExpandedMeetings((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleAddCorrespondence = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId) return
    const form = e.currentTarget
    const res = await createCorrespondence(projectId, {
      type: (form.querySelector('[name="type"]') as HTMLSelectElement).value,
      authority: (form.querySelector('[name="authority"]') as HTMLInputElement).value,
      subject: (form.querySelector('[name="subject"]') as HTMLInputElement).value,
      summary: (form.querySelector('[name="summary"]') as HTMLTextAreaElement).value,
    })
    if (res.success) {
      await load()
      setAddCorrOpen(false)
    }
  }

  const handleAddMeeting = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId) return
    const form = e.currentTarget
    const res = await createMeeting(projectId, {
      type: (form.querySelector('[name="type"]') as HTMLSelectElement).value,
      date: (form.querySelector('[name="date"]') as HTMLInputElement).value,
      summary: (form.querySelector('[name="summary"]') as HTMLTextAreaElement).value,
    })
    if (res.success) {
      await load()
      setAddMeetingOpen(false)
    }
  }

  const handleAddActionItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId || !addActionMeetingId) return
    const form = e.currentTarget
    const res = await createActionItem(projectId, addActionMeetingId, {
      owner: (form.querySelector('[name="owner"]') as HTMLInputElement).value,
      dueDate: (form.querySelector('[name="dueDate"]') as HTMLInputElement).value,
      description: (form.querySelector('[name="description"]') as HTMLInputElement).value,
    })
    if (res.success) {
      await load()
      setAddActionMeetingId(null)
    }
  }

  const handleToggleActionItem = async (meeting: Meeting, item: ActionItem) => {
    if (!projectId) return
    const nextStatus = item.status === 'Open' ? 'Closed' : 'Open'
    await updateActionItem(projectId, meeting.id, item.id, { status: nextStatus })
    await load()
  }

  const handleDeleteCorrespondence = async (id: string) => {
    if (!projectId) return
    await deleteCorrespondence(projectId, id)
    await load()
  }

  const handleDeleteActionItem = async (meetingId: string, id: string) => {
    if (!projectId) return
    await deleteActionItem(projectId, meetingId, id)
    await load()
  }

  if (!projectId) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a project to view authority correspondence and meetings.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setView('correspondence')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${view === 'correspondence' ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
        >
          <Mail size={16} />
          Correspondence
        </button>
        <button
          type="button"
          onClick={() => setView('meetings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm ${view === 'meetings' ? 'bg-blue-600 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'}`}
        >
          <Calendar size={16} />
          Meetings & Action items
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : view === 'correspondence' ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Correspondence log</h3>
            <button
              type="button"
              onClick={() => setAddCorrOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={14} />
              Add
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {correspondence.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No correspondence yet.</p>
            ) : (
              correspondence.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(c.date), 'yyyy-MM-dd')} · {c.type} · {c.authority}
                    </span>
                    <p className="font-medium text-gray-900 dark:text-white">{c.subject}</p>
                    {c.summary && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{c.summary.slice(0, 120)}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteCorrespondence(c.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 rounded"
                    aria-label="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Meetings</h3>
            <button
              type="button"
              onClick={() => setAddMeetingOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
            >
              <Plus size={14} />
              Add meeting
            </button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {meetings.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No meetings yet.</p>
            ) : (
              meetings.map((m) => (
                <div key={m.id}>
                  <button
                    type="button"
                    onClick={() => toggleMeeting(m.id)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {expandedMeetings.has(m.id) ? (
                      <ChevronDown size={16} className="text-gray-500" />
                    ) : (
                      <ChevronRight size={16} className="text-gray-500" />
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {format(new Date(m.date), 'yyyy-MM-dd')} · {m.type}
                    </span>
                    {m.actionItems.length > 0 && (
                      <span className="text-xs text-gray-500">
                        {m.actionItems.filter((a) => a.status === 'Open').length} open action(s)
                      </span>
                    )}
                  </button>
                  {expandedMeetings.has(m.id) && (
                    <div className="pl-6 pr-4 pb-3 space-y-2">
                      {m.summary && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">{m.summary}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Action items</span>
                        <button
                          type="button"
                          onClick={() => setAddActionMeetingId(m.id)}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          + Add action item
                        </button>
                      </div>
                      {m.actionItems.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleToggleActionItem(m, a)}
                              className={`text-xs px-2 py-0.5 rounded ${a.status === 'Open' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'}`}
                            >
                              {a.status}
                            </button>
                            <span className="text-sm text-gray-900 dark:text-white">{a.description || '—'}</span>
                            <span className="text-xs text-gray-500">due {format(new Date(a.dueDate), 'yyyy-MM-dd')}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteActionItem(m.id, a.id)}
                            className="p-1 text-gray-500 hover:text-red-600"
                            aria-label="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {addCorrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add correspondence</h3>
            <form onSubmit={handleAddCorrespondence} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                <select name="type" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required>
                  <option value="Letter">Letter</option>
                  <option value="Email">Email</option>
                  <option value="Meeting">Meeting</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Authority</label>
                <input name="authority" type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="e.g. EASA" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Subject</label>
                <input name="subject" type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Summary</label>
                <textarea name="summary" rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                <button type="button" onClick={() => setAddCorrOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addMeetingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add meeting</h3>
            <form onSubmit={handleAddMeeting} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                <input name="date" type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" defaultValue={format(new Date(), 'yyyy-MM-dd')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                <select name="type" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required>
                  <option value="TCB">TCB</option>
                  <option value="TC">TC</option>
                  <option value="Internal">Internal</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Summary</label>
                <textarea name="summary" rows={3} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                <button type="button" onClick={() => setAddMeetingOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addActionMeetingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add action item</h3>
            <form onSubmit={handleAddActionItem} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Owner</label>
                <input name="owner" type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Due date</label>
                <input name="dueDate" type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Description</label>
                <input name="description" type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                <button type="button" onClick={() => setAddActionMeetingId(null)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
