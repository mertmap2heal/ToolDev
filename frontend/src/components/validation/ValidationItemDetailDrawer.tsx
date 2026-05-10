import { useState, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { X, Trash2, RotateCcw, CheckCircle, Plus, Save, Paperclip } from 'lucide-react'
import {
  validationService,
  CRITERION_OUTCOMES,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  type ValidationItemSummary,
  type ValidationCriterion,
  type CriterionOutcome,
  type ValidationMethodType,
  type ValidationMilestone,
} from '../../services/validation.service'
import {
  METHOD_LABEL,
  METHOD_TOOLTIP,
  MILESTONE_LABEL,
  MILESTONE_TOOLTIP,
  STATUS_COLOR,
  STATUS_LABEL,
  OUTCOME_LABEL,
  OUTCOME_COLOR,
} from './validationLabels'

interface Props {
  projectId: string
  itemId: string | null
  currentUserId: string
  onClose: () => void
  onChanged: () => void
}

export default function ValidationItemDetailDrawer({
  projectId,
  itemId,
  currentUserId,
  onClose,
  onChanged,
}: Props) {
  const queryClient = useQueryClient()
  const isOpen = !!itemId
  const [draft, setDraft] = useState<ValidationItemSummary | null>(null)
  const [signOffOpen, setSignOffOpen] = useState(false)
  const [roleLabel, setRoleLabel] = useState('')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: item } = useQuery({
    queryKey: ['validation-item', projectId, itemId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await validationService.get(projectId, itemId!)
      return res.success ? res.data : null
    },
  })

  const { data: evidence } = useQuery({
    queryKey: ['validation-evidence', projectId, itemId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await validationService.listEvidence(projectId, itemId!)
      return res.success ? res.data : []
    },
  })

  useEffect(() => {
    if (item) setDraft(item)
  }, [item])

  const isAuthor = useMemo(() => draft?.createdById === currentUserId, [draft, currentUserId])
  const canSignOff = useMemo(() => !!draft && draft.status === 'EXECUTED' && !isAuthor, [draft, isAuthor])

  if (!isOpen) return null

  const close = () => {
    setDraft(null)
    setSignOffOpen(false)
    setRoleLabel('')
    setComment('')
    setError(null)
    onClose()
  }

  const reload = () => {
    queryClient.invalidateQueries({ queryKey: ['validation-item', projectId, itemId] })
    queryClient.invalidateQueries({ queryKey: ['validation-evidence', projectId, itemId] })
    queryClient.invalidateQueries({ queryKey: ['validation-items', projectId] })
    onChanged()
  }

  const updateCriterion = (cid: string, patch: Partial<ValidationCriterion>) => {
    if (!draft) return
    setDraft({
      ...draft,
      criteria: draft.criteria.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
    })
  }

  const addCriterion = () => {
    if (!draft) return
    const id = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setDraft({
      ...draft,
      criteria: [
        ...draft.criteria,
        { id, text: '', outcome: 'PENDING', orderIndex: draft.criteria.length },
      ],
    })
  }

  const removeCriterion = (cid: string) => {
    if (!draft) return
    setDraft({
      ...draft,
      criteria: draft.criteria
        .filter((c) => c.id !== cid)
        .map((c, i) => ({ ...c, orderIndex: i })),
    })
  }

  const save = async () => {
    if (!draft || !itemId) return
    setSaving(true)
    setError(null)
    try {
      const res = await validationService.update(projectId, itemId, {
        title: draft.title,
        description: draft.description ?? '',
        methodType: draft.methodType,
        targetMilestone: draft.targetMilestone,
        criteria: draft.criteria.filter((c) => c.text.trim().length > 0),
      })
      if (res.success) {
        reload()
      } else {
        setError(res.error || 'Failed to save')
      }
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const submitSignOff = async () => {
    if (!itemId || !roleLabel.trim()) return
    setError(null)
    const res = await validationService.signOff(projectId, itemId, {
      signerRoleLabel: roleLabel.trim(),
      comment: comment.trim() || undefined,
    })
    if (res.success) {
      setSignOffOpen(false)
      setRoleLabel('')
      setComment('')
      reload()
    } else {
      setError(res.error || 'Sign-off failed')
    }
  }

  const handleDelete = async () => {
    if (!itemId) return
    const reason = window.prompt('Reason for deletion (optional)?') ?? undefined
    const res = await validationService.remove(projectId, itemId, reason)
    if (res.success) {
      reload()
      close()
    }
  }

  const handleRestore = async () => {
    if (!itemId) return
    const res = await validationService.restore(projectId, itemId)
    if (res.success) reload()
  }

  return (
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Close drawer"
        className="flex-1 bg-black/30"
        onClick={close}
      />
      <div className="w-[640px] max-w-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col">
        <div className="bg-blue-500/20 backdrop-blur-sm border-b border-blue-500/30 px-6 py-4 flex items-start justify-between flex-shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-blue-700 dark:text-blue-300">
                {draft?.key ?? '…'}
              </span>
              {draft && (
                <span
                  className={`text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded ${STATUS_COLOR[draft.status]}`}
                >
                  {STATUS_LABEL[draft.status]}
                </span>
              )}
              {draft?.deletedAt && (
                <span className="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded bg-red-200 text-red-800 dark:bg-red-900/40 dark:text-red-200">
                  DELETED
                </span>
              )}
            </div>
            <input
              type="text"
              value={draft?.title ?? ''}
              onChange={(e) => draft && setDraft({ ...draft, title: e.target.value })}
              className="mt-1 w-full text-base font-semibold text-gray-900 dark:text-white bg-transparent border-0 focus:ring-0 px-0"
            />
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 ml-2"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Overview
            </h3>
            <textarea
              value={draft?.description ?? ''}
              onChange={(e) => draft && setDraft({ ...draft, description: e.target.value })}
              rows={3}
              placeholder="Why this validation matters"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Method
                </label>
                <select
                  value={draft?.methodType ?? 'DEMONSTRATION'}
                  onChange={(e) =>
                    draft && setDraft({ ...draft, methodType: e.target.value as ValidationMethodType })
                  }
                  title={draft ? METHOD_TOOLTIP[draft.methodType] : ''}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {VALIDATION_METHOD_TYPES.map((m) => (
                    <option key={m} value={m} title={METHOD_TOOLTIP[m]}>
                      {METHOD_LABEL[m]}
                    </option>
                  ))}
                </select>
                {draft && (
                  <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                    {METHOD_TOOLTIP[draft.methodType]}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Milestone
                </label>
                <select
                  value={draft?.targetMilestone ?? 'OTHER'}
                  onChange={(e) =>
                    draft && setDraft({ ...draft, targetMilestone: e.target.value as ValidationMilestone })
                  }
                  title={draft ? MILESTONE_TOOLTIP[draft.targetMilestone] : ''}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {VALIDATION_MILESTONES.map((m) => (
                    <option key={m} value={m} title={MILESTONE_TOOLTIP[m]}>
                      {MILESTONE_LABEL[m]}
                    </option>
                  ))}
                </select>
                {draft && (
                  <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                    {MILESTONE_TOOLTIP[draft.targetMilestone]}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Acceptance criteria
              </h3>
              <button
                type="button"
                onClick={addCriterion}
                className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {draft && draft.criteria.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No criteria yet — add at least one.</p>
            ) : (
              <ul className="space-y-2">
                {draft?.criteria.map((c) => (
                  <li
                    key={c.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-md p-2 bg-gray-50 dark:bg-gray-800/50"
                  >
                    <input
                      type="text"
                      value={c.text}
                      onChange={(e) => updateCriterion(c.id, { text: e.target.value })}
                      placeholder="Criterion text"
                      className="w-full px-2 py-1 text-sm border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0"
                    />
                    <div className="mt-1 flex items-center gap-2">
                      <select
                        value={c.outcome}
                        onChange={(e) =>
                          updateCriterion(c.id, { outcome: e.target.value as CriterionOutcome })
                        }
                        className={`text-xs px-2 py-1 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 ${OUTCOME_COLOR[c.outcome]}`}
                      >
                        {CRITERION_OUTCOMES.map((o) => (
                          <option key={o} value={o}>
                            {OUTCOME_LABEL[o]}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={c.notes ?? ''}
                        onChange={(e) => updateCriterion(c.id, { notes: e.target.value })}
                        placeholder="Notes"
                        className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeCriterion(c.id)}
                        className="text-gray-400 hover:text-red-500"
                        aria-label="Remove criterion"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
              Evidence
            </h3>
            {evidence && evidence.length > 0 ? (
              <ul className="space-y-1">
                {evidence.map((link) => (
                  <li
                    key={link.id}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <Paperclip size={14} className="text-gray-400" />
                    <span className="truncate flex-1">{link.evidence.title}</span>
                    <span className="text-[11px] text-gray-500">{link.evidence.evidenceType}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        await validationService.detachEvidence(projectId, itemId!, link.id)
                        reload()
                      }}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Remove evidence"
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 italic">
                No evidence attached. Drag a file here or attach via the upload dialog (coming
                soon — file upload is wired in a follow-up; for now use the API directly).
              </p>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                Sign-offs
              </h3>
              {canSignOff && !signOffOpen && (
                <button
                  type="button"
                  onClick={() => setSignOffOpen(true)}
                  className="text-xs flex items-center gap-1 text-green-700 hover:text-green-800 dark:text-green-400"
                >
                  <CheckCircle size={12} /> Sign off
                </button>
              )}
            </div>
            {signOffOpen && (
              <div className="border border-green-300 dark:border-green-700 rounded-md p-3 mb-3 bg-green-50 dark:bg-green-900/20 space-y-2">
                <input
                  type="text"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder="Your role (e.g. Customer Operations Lead)"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                />
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Optional comment"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSignOffOpen(false)}
                    className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:underline"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitSignOff}
                    disabled={!roleLabel.trim()}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                  >
                    Confirm sign-off
                  </button>
                </div>
              </div>
            )}
            {item?.status === 'EXECUTED' && isAuthor && !signOffOpen && (
              <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                You created this item — another project member must sign it off.
              </p>
            )}
            {/* Sign-off list comes from item.signOffs in get response */}
            {item && (item as ValidationItemSummary & { signOffs?: { id: string; signerRoleLabel: string; signedAt: string; supersededById: string | null; signer?: { name: string }; comment: string | null }[] }).signOffs && (
              <ul className="space-y-1">
                {(item as ValidationItemSummary & { signOffs?: { id: string; signerRoleLabel: string; signedAt: string; supersededById: string | null; signer?: { name: string }; comment: string | null }[] }).signOffs!
                  .map((s) => (
                  <li
                    key={s.id}
                    className={`text-sm px-2 py-1.5 rounded border ${
                      s.supersededById
                        ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 line-through opacity-60'
                        : 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {s.signer?.name ?? 'Unknown'}{' '}
                        <span className="text-gray-500">— {s.signerRoleLabel}</span>
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {new Date(s.signedAt).toLocaleString()}
                      </span>
                    </div>
                    {s.comment && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{s.comment}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            {draft?.deletedAt ? (
              <button
                type="button"
                onClick={handleRestore}
                className="text-sm flex items-center gap-1 px-3 py-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md"
              >
                <RotateCcw size={14} /> Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                className="text-sm flex items-center gap-1 px-3 py-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || !!draft?.deletedAt}
              className="text-sm flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
