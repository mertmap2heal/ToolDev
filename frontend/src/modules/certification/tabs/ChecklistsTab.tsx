import { useState, useEffect, useCallback } from 'react'
import { Plus, CheckSquare, Square, UserCheck } from 'lucide-react'
import { format } from 'date-fns'
import { useCertificationStore } from '../store'
import {
  getChecklists,
  createChecklist,
  updateChecklistItem,
  addSignOff,
  updateSignOff,
} from '../../../services/certification.service'
import type { CertificationChecklist } from '../types'

export default function ChecklistsTab() {
  const { state } = useCertificationStore()
  const projectId = state.context.projectId
  const [checklists, setChecklists] = useState<CertificationChecklist[]>([])
  const [loading, setLoading] = useState(false)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const res = await getChecklists(projectId)
    if (res.success && res.data) setChecklists(res.data)
    else setChecklists([])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const handleCreateChecklist = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId) return
    const form = e.currentTarget
    const res = await createChecklist(projectId, {
      name: (form.querySelector('[name="name"]') as HTMLInputElement).value,
      phase: (form.querySelector('[name="phase"]') as HTMLSelectElement).value,
    })
    if (res.success) {
      await load()
      setAddOpen(false)
    }
  }

  const handleToggleItem = async (checklist: CertificationChecklist, itemId: string, currentStatus: string) => {
    if (!projectId) return
    const nextStatus = currentStatus === 'Complete' ? 'Open' : 'Complete'
    await updateChecklistItem(projectId, checklist.id, itemId, { status: nextStatus })
    await load()
  }

  const handleSignOff = async (signOffId: string) => {
    if (!projectId) return
    await updateSignOff(projectId, signOffId, { status: 'Signed', signedAt: new Date().toISOString() })
    await load()
  }

  if (!projectId) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a project to view checklists and sign-offs.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus size={16} />
          Add checklist
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : checklists.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">No checklists yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {checklists.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {c.name} · {c.phase}
                </h3>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Items</p>
                  <ul className="space-y-2">
                    {c.items.length === 0 ? (
                      <li className="text-sm text-gray-500 dark:text-gray-400">No items.</li>
                    ) : (
                      c.items.map((item) => (
                        <li key={item.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleItem(c, item.id, item.status)}
                            className="flex items-center gap-2 text-left flex-1"
                          >
                            {item.status === 'Complete' ? (
                              <CheckSquare size={18} className="text-green-600 dark:text-green-400 shrink-0" />
                            ) : (
                              <Square size={18} className="text-gray-400 shrink-0" />
                            )}
                            <span className={`text-sm ${item.status === 'Complete' ? 'text-gray-500 line-through dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                              {item.description || '—'}
                            </span>
                            {item.required && <span className="text-xs text-amber-600 dark:text-amber-400">Required</span>}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                {c.signOffs.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1">
                      <UserCheck size={12} />
                      Sign-offs
                    </p>
                    <ul className="space-y-1">
                      {c.signOffs.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-gray-900 dark:text-white">
                            {s.role && `${s.role}: `}{s.person || '—'}
                          </span>
                          {s.status === 'Pending' ? (
                            <button
                              type="button"
                              onClick={() => handleSignOff(s.id)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              Mark signed
                            </button>
                          ) : (
                            <span className="text-xs text-green-600 dark:text-green-400">
                              {s.signedAt ? format(new Date(s.signedAt), 'PP') : s.status}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add checklist</h3>
            <form onSubmit={handleCreateChecklist} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input name="name" type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="e.g. PDR checklist" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Phase</label>
                <select name="phase" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required>
                  <option value="PDR">PDR</option>
                  <option value="CDR">CDR</option>
                  <option value="TRR">TRR</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
