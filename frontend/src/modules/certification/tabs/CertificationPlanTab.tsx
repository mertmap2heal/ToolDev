import { useState, useEffect, useCallback } from 'react'
import { Plus, FileText, Calendar, CheckCircle2, Circle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { useCertificationStore } from '../store'
import {
  getPlan,
  upsertPlan,
  getMilestones,
  createMilestone,
  updateMilestone,
} from '../../../services/certification.service'
import type { CertificationPlan, CertificationMilestone } from '../types'

export default function CertificationPlanTab() {
  const { state } = useCertificationStore()
  const projectId = state.context.projectId
  const [plan, setPlan] = useState<CertificationPlan | null>(null)
  const [milestones, setMilestones] = useState<CertificationMilestone[]>([])
  const [loading, setLoading] = useState(false)
  const [editPlanOpen, setEditPlanOpen] = useState(false)
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    const [planRes, milestonesRes] = await Promise.all([
      getPlan(projectId),
      getMilestones(projectId),
    ])
    if (planRes.success && planRes.data) setPlan(planRes.data)
    else setPlan(null)
    if (milestonesRes.success && milestonesRes.data) setMilestones(milestonesRes.data)
    else setMilestones([])
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  const handleSavePlan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId) return
    const form = e.currentTarget
    const scopeSummary = (form.querySelector('[name="scopeSummary"]') as HTMLTextAreaElement).value
    const approvalStatus = (form.querySelector('[name="approvalStatus"]') as HTMLSelectElement).value
    const res = await upsertPlan(projectId, { scopeSummary, approvalStatus })
    if (res.success && res.data) {
      setPlan(res.data)
      setEditPlanOpen(false)
    }
  }

  const handleAddMilestone = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!projectId) return
    const form = e.currentTarget
    const res = await createMilestone(projectId, {
      name: (form.querySelector('[name="name"]') as HTMLInputElement).value,
      date: (form.querySelector('[name="date"]') as HTMLInputElement).value,
      type: (form.querySelector('[name="type"]') as HTMLSelectElement).value,
    })
    if (res.success) {
      await load()
      setAddMilestoneOpen(false)
    }
  }

  const handleToggleMilestoneStatus = async (m: CertificationMilestone) => {
    if (!projectId) return
    const nextStatus = m.status === 'Completed' ? 'Planned' : 'Completed'
    await updateMilestone(projectId, m.id, { status: nextStatus })
    await load()
  }

  if (!projectId) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Select a project to view the certification plan and milestones.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText size={16} />
            Certification plan
          </h3>
          <button
            type="button"
            onClick={() => setEditPlanOpen(true)}
            className="text-sm text-blue-600 hover:underline"
          >
            Edit
          </button>
        </div>
        {loading ? (
          <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : plan ? (
          <div className="p-4 space-y-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Version {plan.version} · {plan.approvalStatus} · Last updated {format(new Date(plan.lastUpdated), 'PP')}
            </p>
            <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
              {plan.scopeSummary || 'No scope summary. Click Edit to add.'}
            </p>
          </div>
        ) : (
          <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No plan yet. Click Edit to create.</p>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Calendar size={16} />
            Milestones
          </h3>
          <button
            type="button"
            onClick={() => setAddMilestoneOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Plus size={14} />
            Add milestone
          </button>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {milestones.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-500 dark:text-gray-400">No milestones yet.</p>
          ) : (
            milestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <button
                  type="button"
                  onClick={() => handleToggleMilestoneStatus(m)}
                  className="flex items-center gap-3 text-left flex-1 min-w-0"
                >
                  {m.status === 'Completed' ? (
                    <CheckCircle2 size={20} className="text-green-600 dark:text-green-400 shrink-0" />
                  ) : (
                    <Circle size={20} className="text-gray-400 shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{m.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(m.date), 'yyyy-MM-dd')} · {m.type}
                    </p>
                  </div>
                </button>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    m.status === 'Completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {m.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {editPlanOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-lg w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {plan ? 'Edit certification plan' : 'Create certification plan'}
            </h3>
            <form onSubmit={handleSavePlan} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Scope summary</label>
                <textarea
                  name="scopeSummary"
                  rows={4}
                  defaultValue={plan?.scopeSummary ?? ''}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Approval status</label>
                <select
                  name="approvalStatus"
                  defaultValue={plan?.approvalStatus ?? 'Draft'}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="Draft">Draft</option>
                  <option value="UnderReview">Under review</option>
                  <option value="Approved">Approved</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                <button type="button" onClick={() => setEditPlanOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addMilestoneOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Add milestone</h3>
            <form onSubmit={handleAddMilestone} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Name</label>
                <input name="name" type="text" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="e.g. PDR" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
                <input name="date" type="date" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
                <select name="type" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                  <option value="PDR">PDR</option>
                  <option value="CDR">CDR</option>
                  <option value="TRR">TRR</option>
                  <option value="TC submission">TC submission</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">Save</button>
                <button type="button" onClick={() => setAddMilestoneOpen(false)} className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
