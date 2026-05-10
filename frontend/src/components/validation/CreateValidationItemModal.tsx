import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, AlertTriangle } from 'lucide-react'
import {
  validationService,
  VALIDATION_METHOD_TYPES,
  VALIDATION_MILESTONES,
  type ValidationMethodType,
  type ValidationMilestone,
} from '../../services/validation.service'
import { METHOD_LABEL, METHOD_TOOLTIP, MILESTONE_LABEL, MILESTONE_TOOLTIP } from './validationLabels'

interface Props {
  projectId: string
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateValidationItemModal({ projectId, isOpen, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [methodType, setMethodType] = useState<ValidationMethodType>('DEMONSTRATION')
  const [targetMilestone, setTargetMilestone] = useState<ValidationMilestone>('OTHER')
  const [criteriaText, setCriteriaText] = useState('')
  const [prefix, setPrefix] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: settings } = useQuery({
    queryKey: ['validation-settings', projectId],
    enabled: isOpen,
    queryFn: async () => {
      const res = await validationService.getSettings(projectId)
      return res.success && res.data ? res.data : null
    },
  })

  useEffect(() => {
    if (settings && !prefix) {
      const def = settings.prefixes.find((p) => p.isDefault) ?? settings.prefixes[0]
      if (def) setPrefix(def.prefix)
    }
  }, [settings, prefix])

  if (!isOpen) return null

  const reset = () => {
    setTitle('')
    setDescription('')
    setMethodType('DEMONSTRATION')
    setTargetMilestone('OTHER')
    setCriteriaText('')
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const criteria = criteriaText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ text }))

      const res = await validationService.create(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        methodType,
        targetMilestone,
        criteria,
        prefix: prefix || undefined,
      })
      if (res.success) {
        reset()
        onCreated()
        onClose()
      } else {
        setError(res.error || 'Failed to create item')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="params-v2 validation-v2 fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(15,20,25,0.4)' }}>
      <div
        className="pv-drawer-shell"
        style={{ width: '100%', maxWidth: 640, margin: 0, maxHeight: '90vh' }}
      >
        <div className="pv-dr-head">
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--pv-fg)' }}>
            New validation item
          </span>
          <div className="pv-dr-spacer" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="pv-icon-btn"
            style={{ width: 24, height: 24 }}
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="pv-dr-body" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {settings && settings.prefixes.length > 1 && (
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)', marginBottom: 4 }}>
                Key prefix
              </label>
              <select
                value={prefix}
                onChange={(e) => setPrefix(e.target.value)}
                style={{ width: '100%', height: 30, padding: '0 10px', fontSize: 13, fontFamily: 'var(--pv-font-mono)', border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)' }}
              >
                {settings.prefixes.map((p) => (
                  <option key={p.prefix} value={p.prefix} title={p.description}>
                    {p.prefix} — {p.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)', marginBottom: 4 }}>
              Title <span style={{ color: 'var(--pv-red)' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Pilots can complete approach in under 2 minutes"
              style={{ width: '100%', height: 30, padding: '0 10px', fontSize: 13, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
              required
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)', marginBottom: 4 }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Why this validation matters; the stakeholder need being addressed."
              style={{ width: '100%', height: 30, padding: '0 10px', fontSize: 13, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)', marginBottom: 4 }}>
                Method
              </label>
              <select
                value={methodType}
                onChange={(e) => setMethodType(e.target.value as ValidationMethodType)}
                title={METHOD_TOOLTIP[methodType]}
                style={{ width: '100%', height: 30, padding: '0 10px', fontSize: 13, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
              >
                {VALIDATION_METHOD_TYPES.map((m) => (
                  <option key={m} value={m} title={METHOD_TOOLTIP[m]}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {METHOD_TOOLTIP[methodType]}
              </p>
              {methodType === 'ANALYSIS' && (
                <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
                  <span>
                    Confirming a low-level requirement? Use a Verification test case instead.
                  </span>
                </p>
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)', marginBottom: 4 }}>
                Target milestone
              </label>
              <select
                value={targetMilestone}
                onChange={(e) => setTargetMilestone(e.target.value as ValidationMilestone)}
                title={MILESTONE_TOOLTIP[targetMilestone]}
                style={{ width: '100%', height: 30, padding: '0 10px', fontSize: 13, border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)', fontFamily: 'inherit' }}
              >
                {VALIDATION_MILESTONES.map((m) => (
                  <option key={m} value={m} title={MILESTONE_TOOLTIP[m]}>
                    {MILESTONE_LABEL[m]}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {MILESTONE_TOOLTIP[targetMilestone]}
              </p>
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--pv-fg-2)', marginBottom: 4 }}>
              Acceptance criteria (one per line)
            </label>
            <textarea
              value={criteriaText}
              onChange={(e) => setCriteriaText(e.target.value)}
              rows={4}
              placeholder={'Each line becomes a criterion you mark Met / Partial / Not Met later.\nDemo runs end-to-end without manual intervention.\nApproach completes in <120s.'}
              style={{ width: '100%', padding: 8, fontSize: 12.5, fontFamily: 'var(--pv-font-mono)', border: '1px solid var(--pv-line)', borderRadius: 4, background: 'var(--pv-bg)', color: 'var(--pv-fg)' }}
            />
          </div>

          {error && (
            <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </form>

        <div className="pv-dr-foot">
          <div className="right" style={{ marginLeft: 'auto' }}>
            <button
              type="button"
              onClick={onClose}
              className="pv-dr-btn"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !title.trim()}
              className="pv-dr-btn primary"
            >
              {submitting ? 'Creating…' : 'Create item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
