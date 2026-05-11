import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  X, Trash2, RotateCcw, CheckCircle, Plus, Save, Paperclip,
  GitPullRequestArrow, Link2, AlertOctagon, Copy, AlertTriangle,
} from 'lucide-react'
import SafetyLinkPanel from '../safety/SafetyLinkPanel'
import { RenderWithEntityRefs } from '../../utils/entityRefs'
import { checkAmbiguity } from '../../utils/ambiguityCheck'
import MarkdownEditor from '../common/MarkdownEditor'
import { suggestCriteriaFromRequirement, type CriterionSuggestion } from '../../utils/suggestCriteria'
import { projectService } from '../../services/project.service'
import LinkRequirementPicker from './LinkRequirementPicker'
import CreateChangeRequestModal from '../changeRequests/CreateChangeRequestModal'
import RequirementHoverCard from './RequirementHoverCard'
import ValidationCommentsSection from './ValidationCommentsSection'
import {
  validationService,
  CRITERION_OUTCOMES,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  VALIDATION_PRIORITIES,
  type ValidationItemSummary,
  type ValidationCriterion,
  type CriterionOutcome,
  type ValidationMethodType,
  type ValidationMilestone,
  type ValidationPriority,
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

  const { data: linkedReqs = [] } = useQuery({
    queryKey: ['validation-linked-reqs', projectId, itemId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await validationService.listLinkedRequirements(projectId, itemId!)
      return res.success && res.data ? res.data : []
    },
  })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [crModalOpen, setCrModalOpen] = useState(false)

  useEffect(() => {
    if (item) setDraft(item)
  }, [item])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null
      const inField = tgt?.matches('input, textarea, select, [contenteditable="true"]')
      const isMod = e.metaKey || e.ctrlKey
      if (e.key === 'Escape' && !inField) {
        e.preventDefault()
        onClose()
      } else if (isMod && (e.key === 's' || e.key === 'Enter')) {
        // Cmd/Ctrl + S or Cmd/Ctrl + Enter → save
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // `save` is stable enough — re-binding on every keystroke would interfere with browser shortcuts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose])

  const { data: settings } = useQuery({
    queryKey: ['validation-settings', projectId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await validationService.getSettings(projectId)
      return res.success && res.data ? res.data : null
    },
  })

  const { data: activity = [] } = useQuery({
    queryKey: ['validation-activity', projectId, itemId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await validationService.listActivity(projectId, itemId!)
      return res.success && res.data ? res.data : []
    },
  })

  const { data: members = [] } = useQuery({
    queryKey: ['project-members', projectId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await projectService.getProjectMembers(projectId)
      return res.success && res.data ? res.data : []
    },
  })

  const isAuthor = useMemo(() => draft?.createdById === currentUserId, [draft, currentUserId])

  const isDirty = useMemo(() => {
    if (!draft || !item) return false
    return JSON.stringify(draft) !== JSON.stringify(item)
  }, [draft, item])
  const canSignOff = useMemo(() => !!draft && draft.status === 'EXECUTED' && !isAuthor, [draft, isAuthor])

  if (!isOpen) return null

  const close = () => {
    if (isDirty) {
      const ok = window.confirm(
        'You have unsaved changes. Discard and close?',
      )
      if (!ok) return
    }
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

  const moveCriterion = (cid: string, direction: -1 | 1) => {
    if (!draft) return
    const idx = draft.criteria.findIndex((c) => c.id === cid)
    if (idx < 0) return
    const next = idx + direction
    if (next < 0 || next >= draft.criteria.length) return
    const reordered = [...draft.criteria]
    ;[reordered[idx], reordered[next]] = [reordered[next], reordered[idx]]
    setDraft({
      ...draft,
      criteria: reordered.map((c, i) => ({ ...c, orderIndex: i })),
    })
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

  // Criterion templates - now backed by ValidationSettings.criterionTemplates.
  // The pre-backend localStorage entries are migrated on first load so users
  // do not lose previously-saved templates.
  interface CriterionTemplate {
    label: string
    criteria: string[]
  }
  const templatesKey = `validation:criterionTemplates:${projectId}`
  const templatesFromServer: CriterionTemplate[] = useMemo(
    () => settings?.criterionTemplates ?? [],
    [settings],
  )
  const [templates, setTemplates] = useState<CriterionTemplate[]>([])
  useEffect(() => {
    // Merge: backend wins, but legacy localStorage entries are surfaced (and
    // pushed back to the backend transparently on the next save).
    let legacy: CriterionTemplate[] = []
    try {
      const raw = localStorage.getItem(templatesKey)
      if (raw) {
        const arr = JSON.parse(raw)
        if (Array.isArray(arr)) legacy = arr as CriterionTemplate[]
      }
    } catch { /* ignore */ }
    const merged = [
      ...templatesFromServer,
      ...legacy.filter(
        (l) => !templatesFromServer.some((s) => s.label === l.label),
      ),
    ]
    setTemplates(merged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, templatesFromServer])

  const persistTemplates = async (next: CriterionTemplate[]) => {
    setTemplates(next)
    // Clear the legacy LS once we have written to the backend.
    try {
      localStorage.removeItem(templatesKey)
    } catch { /* ignore */ }
    const res = await validationService.updateSettings(projectId, {
      criterionTemplates: next,
    })
    if (!res.success) {
      // Fall back to LS persistence so the change is not lost.
      try {
        localStorage.setItem(templatesKey, JSON.stringify(next))
      } catch { /* ignore */ }
    } else {
      queryClient.invalidateQueries({ queryKey: ['validation-settings', projectId] })
    }
  }
  const insertTemplate = (tpl: CriterionTemplate) => {
    if (!draft) return
    const base = draft.criteria.length
    const next = tpl.criteria.map((text, i) => ({
      id: `tmp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      outcome: 'PENDING' as CriterionOutcome,
      orderIndex: base + i,
    }))
    setDraft({ ...draft, criteria: [...draft.criteria, ...next] })
  }
  const saveCurrentAsTemplate = () => {
    if (!draft || draft.criteria.length === 0) return
    const label = window.prompt('Save current criteria as a template — name:')?.trim()
    if (!label) return
    if (templates.some((t) => t.label === label)) {
      if (!window.confirm(`A template named "${label}" already exists. Overwrite it?`)) return
    }
    const next = [
      ...templates.filter((t) => t.label !== label),
      {
        label,
        criteria: draft.criteria.map((c) => c.text).filter((s) => s.trim().length > 0),
      },
    ]
    persistTemplates(next)
  }
  const deleteTemplate = (label: string) => {
    if (!window.confirm(`Delete template "${label}"?`)) return
    persistTemplates(templates.filter((t) => t.label !== label))
  }

  // T1 criterion seeding (per ai-ready-vision.md §5). Engineers stay in
  // control: the engine emits proposals; nothing is auto-saved.
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  type LinkedReqLite = {
    requirement?: { title?: string | null; description?: string | null } | null
  }
  const suggestions: CriterionSuggestion[] = useMemo(() => {
    if (!suggestionsOpen) return []
    const titles = (linkedReqs as LinkedReqLite[])
      .map((l) => l.requirement?.title ?? '')
      .join('\n')
    const descs = (linkedReqs as LinkedReqLite[])
      .map((l) => l.requirement?.description ?? '')
      .join('\n')
    return suggestCriteriaFromRequirement({ title: titles, description: descs })
  }, [suggestionsOpen, linkedReqs])
  const acceptSuggestion = (s: CriterionSuggestion) => {
    if (!draft) return
    const id = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    setDraft({
      ...draft,
      criteria: [
        ...draft.criteria,
        { id, text: s.text, outcome: 'PENDING', orderIndex: draft.criteria.length },
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
        ownerUserId: draft.ownerUserId ?? null,
        criteria: draft.criteria.filter((c) => c.text.trim().length > 0),
        tags: draft.tags,
        priority: draft.priority,
        dueDate: draft.dueDate ?? null,
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
    <div className="params-v2 validation-v2 fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Close drawer"
        className="flex-1"
        style={{ background: 'rgba(15,20,25,0.3)' }}
        onClick={close}
      />
      <div className="pv-drawer-shell" style={{ width: 720, maxWidth: '100%', margin: 0, borderRadius: 0 }}>
        <div className="pv-dr-head">
          <span className="pv-dr-id">{draft?.key ?? '…'}</span>
          {draft && (
            <span
              className={`pv-dr-pill ${
                draft.status === 'VALIDATED'
                  ? 'released'
                  : draft.status === 'EXECUTED'
                  ? 'review'
                  : draft.status === 'BLOCKED'
                  ? 'deprecated'
                  : draft.status === 'OBSOLETE'
                  ? 'obsolete'
                  : 'draft'
              }`}
            >
              {STATUS_LABEL[draft.status]}
            </span>
          )}
          {draft?.deletedAt && <span className="pv-dr-pill deprecated">DELETED</span>}
          {isDirty && (
            <span
              className="pv-dr-pill"
              style={{ background: 'var(--pv-amber-tint)', color: 'var(--pv-amber)', borderColor: 'var(--pv-amber-line)' }}
              title="Unsaved changes — press Cmd/Ctrl+S to save"
            >
              UNSAVED
            </span>
          )}
          <div className="pv-dr-spacer" />
          {itemId && (
            <button
              type="button"
              onClick={async () => {
                const res = await validationService.duplicate(projectId, itemId)
                if (res.success && res.data) {
                  onChanged()
                  // open the new copy
                  queryClient.invalidateQueries({ queryKey: ['validation-items', projectId] })
                }
              }}
              aria-label="Duplicate"
              title="Duplicate this validation item"
              className="pv-icon-btn"
              style={{ width: 24, height: 24 }}
            >
              <Copy size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="pv-icon-btn"
            style={{ width: 24, height: 24 }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="pv-dr-sub">
          <input
            type="text"
            value={draft?.title ?? ''}
            onChange={(e) => draft && setDraft({ ...draft, title: e.target.value })}
            className="pv-dr-display"
            style={{
              width: '100%',
              background: 'transparent',
              border: 0,
              outline: 0,
              padding: 0,
            }}
          />
          {draft?.title && (() => {
            // T2 advisory per ai-ready-vision.md §5 — proposal only, no auto-fix.
            const findings = checkAmbiguity(draft.title)
            if (findings.length === 0) return null
            return (
              <div
                style={{
                  marginTop: 6,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 4,
                  fontSize: 11,
                  alignItems: 'center',
                  color: 'var(--pv-fg-3)',
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    fontSize: 10,
                    color: 'var(--pv-fg-3)',
                  }}
                  title="Advisory hint generated by the local rule engine (deterministic, no model call). Not a blocker."
                >
                  Advisory
                </span>
                {findings.map((f, i) => (
                  <span
                    key={i}
                    title={f.advice}
                    style={{
                      background:
                        f.severity === 'high'
                          ? 'var(--pv-amber-tint, rgba(184,134,11,0.12))'
                          : 'var(--pv-gray-tint, rgba(160,160,160,0.10))',
                      color:
                        f.severity === 'high'
                          ? 'var(--pv-amber, #b8860b)'
                          : 'var(--pv-fg-2, #555)',
                      border: '1px solid transparent',
                      padding: '0 6px',
                      borderRadius: 3,
                      fontFamily: 'var(--pv-font-mono)',
                      fontSize: 11,
                    }}
                  >
                    {f.term}
                  </span>
                ))}
              </div>
            )
          })()}
        </div>

        <div className="pv-dr-body" style={{ padding: 0 }}>
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 18 }}>
          <section>
            <h3 className="pv-dr-section-title">
              Overview
            </h3>
            {item?.isSuspect && (
              <div
                style={{
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  borderRadius: 4,
                  border: '1px solid var(--pv-amber)',
                  background: 'var(--pv-amber-tint, rgba(184,134,11,0.10))',
                  fontSize: 12,
                }}
                title="A requirement linked to this validation item was updated after the item was last touched. Re-run the validation if the change is material, or acknowledge it if not."
              >
                <AlertTriangle size={14} style={{ color: 'var(--pv-amber)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <strong style={{ color: 'var(--pv-amber)' }}>Suspect</strong>
                  <span style={{ marginLeft: 6, color: 'var(--pv-fg-2)' }}>
                    A linked requirement was updated after this validation. Re-run if material;
                    otherwise mark reviewed.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const res = await validationService.acknowledgeSuspect(projectId, itemId!)
                    if (res.success) {
                      reload()
                    }
                  }}
                  className="pv-btn"
                  style={{ height: 24, padding: '0 10px', fontSize: 11 }}
                >
                  Mark reviewed
                </button>
              </div>
            )}
            {/* Legacy items created before commit 4d7e... had a literal
                "Source requirement <uuid>\n\n..." prefix in the description.
                Detect it, surface a clean callout, and offer a one-click
                cleanup. New items skip this entirely (auto-link via TraceLink). */}
            {(() => {
              const desc = draft?.description ?? ''
              const match = desc.match(/^Source requirement ([0-9a-f-]{36})\n\n([\s\S]*)$/i)
              if (!match) return null
              const [, sourceId, body] = match
              return (
                <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-md border border-blue-200 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/10 text-xs">
                  <span className="text-gray-700 dark:text-gray-300 flex-shrink-0">
                    Source requirement:
                  </span>
                  <a
                    href={`/projects/${projectId}/requirements?focus=${sourceId}`}
                    className="font-mono text-blue-700 dark:text-blue-300 hover:underline truncate"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {sourceId.slice(0, 8)}…
                  </a>
                  <button
                    type="button"
                    onClick={() => draft && setDraft({ ...draft, description: body })}
                    className="ml-auto text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400"
                    title="Remove the legacy prefix from the description (the link is preserved on this item via Linked requirements)."
                  >
                    Clean up
                  </button>
                </div>
              )
            })()}
            <MarkdownEditor
              value={draft?.description ?? ''}
              onChange={(next) => draft && setDraft({ ...draft, description: next })}
              rows={3}
              placeholder="Why this validation matters. Reference REQ-001, PRM-014, VAL-… and @mention teammates. Markdown supported."
              members={(members as Array<{ userId: string; user?: { name?: string | null; email?: string | null } }>).map((m) => ({
                id: m.userId,
                name: m.user?.name ?? null,
                email: m.user?.email ?? null,
              }))}
            />
            {draft?.description && (() => {
              const findings = checkAmbiguity(draft.description)
              if (findings.length === 0) return null
              return (
                <div
                  style={{
                    marginTop: 4,
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 4,
                    alignItems: 'center',
                    fontSize: 11,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--pv-fg-3)',
                    }}
                    title="Advisory hint generated by the local rule engine (deterministic). Not a blocker."
                  >
                    Advisory
                  </span>
                  {findings.map((f, i) => (
                    <span
                      key={i}
                      title={f.advice}
                      style={{
                        background:
                          f.severity === 'high'
                            ? 'var(--pv-amber-tint, rgba(184,134,11,0.12))'
                            : 'var(--pv-gray-tint, rgba(160,160,160,0.10))',
                        color:
                          f.severity === 'high'
                            ? 'var(--pv-amber, #b8860b)'
                            : 'var(--pv-fg-2, #555)',
                        border: '1px solid transparent',
                        padding: '0 6px',
                        borderRadius: 3,
                        fontFamily: 'var(--pv-font-mono)',
                        fontSize: 11,
                      }}
                    >
                      {f.term}
                    </span>
                  ))}
                </div>
              )
            })()}
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                  style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
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
                  Priority
                </label>
                <select
                  value={draft?.priority ?? 'medium'}
                  onChange={(e) =>
                    draft && setDraft({ ...draft, priority: e.target.value as ValidationPriority })
                  }
                  style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
                >
                  {VALIDATION_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Due date
                </label>
                <input
                  type="date"
                  value={draft?.dueDate ? draft.dueDate.slice(0, 10) : ''}
                  onChange={(e) =>
                    draft && setDraft({ ...draft, dueDate: e.target.value || null })
                  }
                  style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                  Owner
                </label>
                <select
                  value={draft?.ownerUserId ?? ''}
                  onChange={(e) =>
                    draft && setDraft({ ...draft, ownerUserId: e.target.value || null })
                  }
                  style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
                >
                  <option value="">— Unassigned —</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.user?.name ?? m.user?.email ?? m.userId.slice(0, 8)}
                    </option>
                  ))}
                </select>
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
                  style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
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

          {settings && settings.tags.length > 0 && (
            <section>
              <h3 className="pv-dr-section-title">Tags</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {settings.tags.map((t) => {
                  const active = (draft?.tags ?? []).includes(t.label)
                  return (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => {
                        if (!draft) return
                        const has = (draft.tags ?? []).includes(t.label)
                        setDraft({
                          ...draft,
                          tags: has
                            ? (draft.tags ?? []).filter((x) => x !== t.label)
                            : [...(draft.tags ?? []), t.label],
                        })
                      }}
                      className="vv-tag"
                      style={{
                        background: active ? `${t.color}22` : 'var(--pv-surface)',
                        color: active ? t.color : 'var(--pv-fg-3)',
                        border: `1px solid ${active ? `${t.color}55` : 'var(--pv-line)'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="pv-dr-section-title">
                Linked requirements
              </h3>
              {!pickerOpen && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Link2 size={12} /> Link requirement
                </button>
              )}
            </div>
            {pickerOpen && (
              <LinkRequirementPicker
                projectId={projectId}
                excludeRequirementIds={linkedReqs.map((l) => l.requirementId)}
                onCancel={() => setPickerOpen(false)}
                onPick={async (reqId) => {
                  const res = await validationService.linkRequirement(projectId, itemId!, reqId)
                  if (res.success) {
                    setPickerOpen(false)
                    queryClient.invalidateQueries({
                      queryKey: ['validation-linked-reqs', projectId, itemId],
                    })
                    onChanged()
                  }
                }}
              />
            )}
            {linkedReqs.length === 0 && !pickerOpen ? (
              <p className="text-sm text-gray-500 italic">
                No requirements linked. Link a requirement to make this validation traceable
                back to the system specification.
              </p>
            ) : (
              <div className="pv-dr-refs" style={{ marginTop: 8 }}>
                {linkedReqs.map((l) => (
                  <div
                    key={l.id}
                    className="pv-dr-ref"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="ref-kind req">
                      <Link2 size={12} />
                    </span>
                    <RequirementHoverCard
                      projectId={projectId}
                      requirementId={l.requirementId}
                      fallbackTitle={l.requirement?.title ?? null}
                    >
                      <a
                        href={`/projects/${projectId}/requirements?focus=${l.requirementId}`}
                        onClick={(e) => e.stopPropagation()}
                        className="ref-id src-link"
                      >
                        {l.requirement?.requirementId ?? l.requirementId.slice(0, 6)}
                      </a>
                    </RequirementHoverCard>
                    <RequirementHoverCard
                      projectId={projectId}
                      requirementId={l.requirementId}
                      fallbackTitle={l.requirement?.title ?? null}
                      className="ref-title"
                    >
                      <span className="ref-title" style={{ cursor: 'help' }}>
                        {l.requirement?.title ?? '(deleted)'}
                      </span>
                    </RequirementHoverCard>
                    <button
                      type="button"
                      onClick={async () => {
                        await validationService.unlinkRequirement(projectId, itemId!, l.id)
                        queryClient.invalidateQueries({
                          queryKey: ['validation-linked-reqs', projectId, itemId],
                        })
                      }}
                      className="pv-icon-btn"
                      style={{ width: 22, height: 22 }}
                      aria-label="Unlink"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="pv-dr-section-title">
                Acceptance criteria
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const action = e.target.value
                    e.currentTarget.value = ''
                    if (!action) return
                    if (action === '__save__') {
                      saveCurrentAsTemplate()
                      return
                    }
                    if (action.startsWith('__delete__:')) {
                      deleteTemplate(action.slice('__delete__:'.length))
                      return
                    }
                    const tpl = templates.find((t) => t.label === action)
                    if (tpl) insertTemplate(tpl)
                  }}
                  title="Insert a saved criterion template, or save the current criteria as a new one"
                  style={{
                    fontSize: 11,
                    padding: '2px 4px',
                    border: '1px solid var(--pv-line)',
                    borderRadius: 3,
                    background: 'var(--pv-bg)',
                    color: 'var(--pv-fg-2)',
                    fontFamily: 'inherit',
                  }}
                >
                  <option value="">Templates…</option>
                  {templates.length > 0 && (
                    <optgroup label="Insert">
                      {templates.map((t) => (
                        <option key={t.label} value={t.label}>
                          {t.label} ({t.criteria.length})
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Manage">
                    <option value="__save__">Save current as template…</option>
                    {templates.map((t) => (
                      <option key={`d-${t.label}`} value={`__delete__:${t.label}`}>
                        Delete "{t.label}"
                      </option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  onClick={() => setSuggestionsOpen((v) => !v)}
                  disabled={linkedReqs.length === 0}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 disabled:text-gray-400 disabled:cursor-not-allowed"
                  title={
                    linkedReqs.length === 0
                      ? 'Link at least one requirement to enable T1 criterion seed suggestions'
                      : 'Suggest criterion seeds from the linked requirements (advisory only, no auto-save)'
                  }
                >
                  Suggest
                </button>
                <button
                  type="button"
                  onClick={addCriterion}
                  className="text-xs flex items-center gap-1 text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  <Plus size={12} /> Add
                </button>
              </div>
            </div>
            {suggestionsOpen && (
              <div
                style={{
                  border: '1px solid var(--pv-line)',
                  background: 'var(--pv-surface-soft)',
                  borderRadius: 4,
                  padding: 8,
                  marginBottom: 8,
                  fontSize: 12,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      letterSpacing: '0.02em',
                      textTransform: 'uppercase',
                      fontSize: 10,
                      color: 'var(--pv-fg-3)',
                    }}
                    title="T1 advisory per ai-ready-vision.md §5 - deterministic rule engine, no model call. Every seed is a proposal until you accept it."
                  >
                    Suggested seeds — advisory
                  </span>
                  <button
                    type="button"
                    onClick={() => setSuggestionsOpen(false)}
                    style={{
                      background: 'none',
                      border: 0,
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--pv-fg-3)',
                      fontSize: 11,
                    }}
                  >
                    Close
                  </button>
                </div>
                {suggestions.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--pv-fg-3)', fontStyle: 'italic' }}>
                    No measurable / normative sentences found in linked requirements. Add detail to the
                    linked requirement description.
                  </p>
                ) : (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {suggestions.map((s, i) => (
                      <li
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 8,
                          padding: '4px 6px',
                          background: 'var(--pv-bg)',
                          border: '1px solid var(--pv-line)',
                          borderRadius: 3,
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => acceptSuggestion(s)}
                          className="pv-btn primary compact"
                          style={{ height: 22, fontSize: 11, padding: '0 8px', flexShrink: 0 }}
                          title="Accept this seed into the criteria list"
                        >
                          Accept
                        </button>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block' }}>{s.text}</span>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 10,
                              color: 'var(--pv-fg-3)',
                              marginTop: 2,
                            }}
                          >
                            {s.reason}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
                    {c.text && (() => {
                      const findings = checkAmbiguity(c.text)
                      if (findings.length === 0) return null
                      return (
                        <div
                          style={{
                            margin: '2px 8px 0',
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: 4,
                            alignItems: 'center',
                            fontSize: 11,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase',
                              color: 'var(--pv-fg-3)',
                            }}
                            title="Advisory hint generated by the local rule engine (deterministic). Not a blocker."
                          >
                            Advisory
                          </span>
                          {findings.map((f, i) => (
                            <span
                              key={i}
                              title={f.advice}
                              style={{
                                background:
                                  f.severity === 'high'
                                    ? 'var(--pv-amber-tint, rgba(184,134,11,0.12))'
                                    : 'var(--pv-gray-tint, rgba(160,160,160,0.10))',
                                color:
                                  f.severity === 'high'
                                    ? 'var(--pv-amber, #b8860b)'
                                    : 'var(--pv-fg-2, #555)',
                                border: '1px solid transparent',
                                padding: '0 6px',
                                borderRadius: 3,
                                fontFamily: 'var(--pv-font-mono)',
                                fontSize: 11,
                              }}
                            >
                              {f.term}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
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
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <MarkdownEditor
                          value={c.notes ?? ''}
                          onChange={(next) => updateCriterion(c.id, { notes: next })}
                          rows={1}
                          placeholder="Notes — reference REQ-001 / @mentions / **bold** supported"
                          members={(members as Array<{ userId: string; user?: { name?: string | null; email?: string | null } }>).map((m) => ({
                            id: m.userId,
                            name: m.user?.name ?? null,
                            email: m.user?.email ?? null,
                          }))}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => moveCriterion(c.id, -1)}
                        className="pv-icon-btn"
                        style={{ width: 22, height: 22 }}
                        aria-label="Move up"
                        title="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveCriterion(c.id, 1)}
                        className="pv-icon-btn"
                        style={{ width: 22, height: 22 }}
                        aria-label="Move down"
                        title="Move down"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeCriterion(c.id)}
                        className="pv-icon-btn"
                        style={{ width: 22, height: 22 }}
                        aria-label="Remove criterion"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {evidence && (
                      <CriterionEvidence
                        projectId={projectId}
                        itemId={itemId!}
                        criterionId={c.id}
                        links={evidence.filter((l) => l.relation === `criterion:${c.id}`)}
                        onChanged={reload}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="pv-dr-section-title">
              Evidence
            </h3>
            {evidence && evidence.length > 0 && (
              <div className="pv-dr-refs">
                {evidence.filter((l) => !l.relation?.startsWith('criterion:')).map((link) => (
                  <div key={link.id} className="pv-dr-ref">
                    <span className="ref-kind">
                      <Paperclip size={12} />
                    </span>
                    <span className="ref-id">{link.evidence.evidenceType}</span>
                    {link.evidence.storageRef?.startsWith('/uploads/') ? (
                      <a
                        href={link.evidence.storageRef}
                        target="_blank"
                        rel="noreferrer"
                        className="ref-title"
                        style={{ color: 'var(--pv-blue)' }}
                        title={`Open ${link.evidence.title}`}
                      >
                        {link.evidence.title}
                      </a>
                    ) : (
                      <span className="ref-title">{link.evidence.title}</span>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        await validationService.detachEvidence(projectId, itemId!, link.id)
                        reload()
                      }}
                      className="pv-icon-btn"
                      style={{ width: 22, height: 22 }}
                      aria-label="Remove evidence"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <EvidenceDropzone
              projectId={projectId}
              itemId={itemId!}
              onUploaded={reload}
            />
          </section>

          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="pv-dr-section-title">
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
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 leading-snug">
              Anyone in the project except the item's author can sign off, once the item is
              EXECUTED. Sign-offs are immutable; revocation creates a supersession row.
              Stakeholders with the <span className="font-semibold">Validation Approver</span> role
              are the intended signers.
            </p>
            {signOffOpen && (
              <div style={{ border: '1px solid var(--pv-green)', borderRadius: 6, padding: 12, marginBottom: 12, background: 'var(--pv-green-tint)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input
                  type="text"
                  value={roleLabel}
                  onChange={(e) => setRoleLabel(e.target.value)}
                  placeholder="Your role (e.g. Customer Operations Lead)"
                  style={{ width: '100%', height: 28, padding: '0 8px', fontSize: 12, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
                />
                <MarkdownEditor
                  value={comment}
                  onChange={setComment}
                  rows={2}
                  placeholder="Optional comment — reference REQ-/VAL-/PRM- and @mention teammates. Markdown supported."
                  members={(members as Array<{ userId: string; user?: { name?: string | null; email?: string | null } }>).map((m) => ({
                    id: m.userId,
                    name: m.user?.name ?? null,
                    email: m.user?.email ?? null,
                  }))}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setSignOffOpen(false)}
                    className="pv-dr-btn"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitSignOff}
                    disabled={!roleLabel.trim()}
                    className="pv-dr-btn"
                    style={{ background: 'var(--pv-green)', borderColor: 'var(--pv-green)', color: '#fff' }}
                  >
                    Confirm sign-off
                  </button>
                </div>
              </div>
            )}
            {item?.status === 'EXECUTED' && isAuthor && !signOffOpen && (
              <p style={{ fontSize: 11, color: 'var(--pv-amber)', fontStyle: 'italic', margin: 0 }}>
                You created this item — another project member must sign it off.
              </p>
            )}
            {/* Sign-off list comes from item.signOffs in get response. */}
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
                      <p
                        className="text-xs text-gray-600 dark:text-gray-400 mt-0.5"
                        style={{ whiteSpace: 'pre-wrap' }}
                      >
                        <RenderWithEntityRefs text={s.comment} />
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {draft?.status === 'BLOCKED' && (
            <section>
              <h3 className="pv-dr-section-title">
                Failed validation
              </h3>
              <div style={{ borderRadius: 6, border: '1px solid var(--pv-red)', background: 'var(--pv-red-tint)', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--pv-red)', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <AlertOctagon size={14} style={{ marginTop: 2, flexShrink: 0 }} />
                  <span>
                    This validation is blocked. Raise a change request so the source requirement
                    can be revised.
                  </span>
                </p>
                {linkedReqs.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 11.5, color: 'var(--pv-red)', fontStyle: 'italic' }}>
                    Link a requirement above first — change requests are scoped to a source
                    requirement.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setCrModalOpen(true)}
                    className="pv-dr-btn"
                    style={{ background: 'var(--pv-red)', borderColor: 'var(--pv-red)', color: '#fff', width: 'fit-content' }}
                  >
                    <GitPullRequestArrow size={12} /> Raise change request
                  </button>
                )}
              </div>
            </section>
          )}

          <section>
            <h3 className="pv-dr-section-title">
              Safety impact
            </h3>
            <SafetyLinkPanel variant="impact" />
          </section>

          {itemId && (
            <ValidationCommentsSection
              projectId={projectId}
              itemId={itemId}
              currentUserId={currentUserId}
            />
          )}

          {activity.length > 0 && (
            <section>
              <h3 className="pv-dr-section-title">Recent activity</h3>
              <div className="pv-dr-timeline">
                {activity.slice(0, 10).map((a) => {
                  const verb = a.action.replace('validation:', '').replace(/-/g, ' ')
                  return (
                    <div key={a.id} className="pv-dr-event is-edit">
                      <div className="e-row">
                        <span className="e-action">
                          <b>{a.user?.name ?? 'Someone'}</b> {verb}
                        </span>
                        <span className="e-meta">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
          </div>
        </div>

        {linkedReqs.length > 0 && crModalOpen && draft && (
          <CreateChangeRequestModal
            isOpen={crModalOpen}
            onClose={() => setCrModalOpen(false)}
            projectId={projectId}
            sourceType="requirement"
            sourceId={linkedReqs[0].requirementId}
            sourceTitle={linkedReqs[0].requirement?.title ?? ''}
            sourceDescription={`Triggered by failed Validation item ${draft.key}: ${draft.title}`}
          />
        )}

        <div className="pv-dr-foot">
          <div className="left">
            {draft?.deletedAt ? (
              <button
                type="button"
                onClick={handleRestore}
                className="pv-dr-btn"
              >
                <RotateCcw size={14} /> Restore
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDelete}
                className="pv-dr-btn"
                style={{ color: 'var(--pv-red)' }}
              >
                <Trash2 size={14} /> Delete
              </button>
            )}
          </div>
          <div className="right">
            {error && (
              <span style={{ fontSize: 11, color: 'var(--pv-red)' }}>{error}</span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={saving || !!draft?.deletedAt}
              className="pv-dr-btn primary"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Drag-and-drop / click-to-pick upload zone for evidence. Keeps each upload
// scoped to a single validation item; large files (>25 MB) are rejected by the
// backend multer limit and reported here as a small inline error.
function EvidenceDropzone({
  projectId,
  itemId,
  onUploaded,
}: {
  projectId: string
  itemId: string
  onUploaded: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const upload = async (files: FileList | File[]) => {
    setErrorMsg(null)
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    for (const f of list) {
      const res = await validationService.uploadEvidence(projectId, itemId, f)
      if (!res.success) {
        setErrorMsg(res.error ?? `Upload failed for ${f.name}`)
        break
      }
    }
    setUploading(false)
    onUploaded()
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          if (e.dataTransfer.files?.length) void upload(e.dataTransfer.files)
        }}
        style={{
          display: 'block',
          border: `1px dashed ${dragging ? 'var(--pv-blue)' : 'var(--pv-line)'}`,
          background: dragging ? 'var(--pv-blue-tint, rgba(43,108,176,0.06))' : 'var(--pv-surface-soft)',
          borderRadius: 4,
          padding: '8px 12px',
          fontSize: 12,
          color: 'var(--pv-fg-3)',
          cursor: uploading ? 'progress' : 'pointer',
          textAlign: 'center',
        }}
        title="Drag a file here or click to pick. Max 25 MB per file."
      >
        <input
          type="file"
          multiple
          disabled={uploading}
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files)
            e.target.value = ''
          }}
          style={{ display: 'none' }}
        />
        {uploading
          ? 'Uploading…'
          : dragging
          ? 'Drop to upload'
          : 'Drag a file here, or click to pick (PDF, image, doc — 25 MB max)'}
      </label>
      {errorMsg && (
        <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--pv-red)' }}>{errorMsg}</p>
      )}
    </div>
  )
}

// Per-criterion evidence list + mini-dropzone. Each criterion can own its own
// evidence using the polymorphic `relation = "criterion:<id>"` convention -
// no schema change required beyond the existing VerEvidenceLink.relation
// string field.
function CriterionEvidence({
  projectId,
  itemId,
  criterionId,
  links,
  onChanged,
}: {
  projectId: string
  itemId: string
  criterionId: string
  links: Array<{
    id: string
    relation: string
    evidence: { evidenceType: string; title: string; storageRef?: string }
  }>
  onChanged: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const upload = async (files: FileList | File[]) => {
    setErrorMsg(null)
    const list = Array.from(files)
    if (list.length === 0) return
    setUploading(true)
    for (const f of list) {
      const res = await validationService.uploadEvidence(projectId, itemId, f, criterionId)
      if (!res.success) {
        setErrorMsg(res.error ?? `Upload failed for ${f.name}`)
        break
      }
    }
    setUploading(false)
    onChanged()
  }

  return (
    <div style={{ marginTop: 4, marginLeft: 8 }}>
      {links.length > 0 && (
        <div className="pv-dr-refs" style={{ marginBottom: 4 }}>
          {links.map((link) => (
            <div key={link.id} className="pv-dr-ref" style={{ fontSize: 11 }}>
              <span className="ref-kind">
                <Paperclip size={10} />
              </span>
              <span className="ref-id">{link.evidence.evidenceType}</span>
              {link.evidence.storageRef?.startsWith('/uploads/') ? (
                <a
                  href={link.evidence.storageRef}
                  target="_blank"
                  rel="noreferrer"
                  className="ref-title"
                  style={{ color: 'var(--pv-blue)' }}
                  title={`Open ${link.evidence.title}`}
                >
                  {link.evidence.title}
                </a>
              ) : (
                <span className="ref-title">{link.evidence.title}</span>
              )}
              <button
                type="button"
                onClick={async () => {
                  await validationService.detachEvidence(projectId, itemId, link.id)
                  onChanged()
                }}
                className="pv-icon-btn"
                style={{ width: 18, height: 18 }}
                aria-label="Remove evidence"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        style={{
          fontSize: 10,
          background: 'transparent',
          border: '1px dashed var(--pv-line)',
          color: 'var(--pv-fg-3)',
          padding: '2px 8px',
          borderRadius: 3,
          cursor: uploading ? 'progress' : 'pointer',
        }}
        title="Attach evidence to this specific criterion"
      >
        {uploading ? 'Uploading…' : '+ Attach evidence to this criterion'}
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) void upload(e.target.files)
          e.target.value = ''
        }}
      />
      {errorMsg && (
        <p style={{ margin: '2px 0 0', fontSize: 10, color: 'var(--pv-red)' }}>{errorMsg}</p>
      )}
    </div>
  )
}
