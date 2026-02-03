import { useState } from 'react'
import { Plus, X, AlertCircle } from 'lucide-react'
import type { ApprovalRule, AppliesTo } from '../types'
import { useStakeholdersStore } from '../store'
import ConfirmModal from './ConfirmModal'

const APPLIES_TO_OPTIONS: AppliesTo[] = [
  'Baseline',
  'Release',
  'CertificationPackage',
  'SafetyGate',
  'DeviationWaiver',
]

const IMPACT_PREVIEW_ROWS = [
  { ID: 'BL-2026-01', Label: 'SRR Baseline', Status: 'Approved' },
  { ID: 'BL-2026-02', Label: 'PDR Baseline', Status: 'In Review' },
  { ID: 'CP-001', Label: 'Certification Package', Status: 'Draft' },
  { ID: 'SG-002', Label: 'Safety Gate 2', Status: 'Open' },
  { ID: 'DW-001', Label: 'Deviation D-001', Status: 'Pending' },
]

interface ApprovalRulesProps {
  onShowToast: (msg: string) => void
  canEdit: boolean
  canEditGovernance: boolean
}

export default function ApprovalRules({ onShowToast, canEdit, canEditGovernance }: ApprovalRulesProps) {
  const { state, dispatch, nextRuleId } = useStakeholdersStore()
  const [builderOpen, setBuilderOpen] = useState(false)
  const [disableConfirm, setDisableConfirm] = useState<ApprovalRule | null>(null)
  const [enableConfirm, setEnableConfirm] = useState<ApprovalRule | null>(null)

  const handleDisable = (rule: ApprovalRule) => {
    dispatch({ type: 'UPDATE_RULE', payload: { ...rule, status: 'Disabled' } })
    setDisableConfirm(null)
    onShowToast('Rule disabled.')
  }

  const handleEnable = (rule: ApprovalRule) => {
    dispatch({ type: 'UPDATE_RULE', payload: { ...rule, status: 'Active' } })
    setEnableConfirm(null)
    onShowToast('Rule enabled.')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEditGovernance && (
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
          >
            <Plus size={16} />
            Add rule
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Rule ID</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Applies to</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Condition</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Approvals</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Groups</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">2-person</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Delegation</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Status</th>
              {canEditGovernance && <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {state.approvalRules.map((r) => (
              <tr key={r.ruleId}>
                <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-white">{r.ruleId}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.appliesTo}</td>
                <td className="px-4 py-2 max-w-xs truncate text-gray-600 dark:text-gray-400" title={r.condition}>
                  {r.condition}
                </td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.requiredApprovals}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.requiredGroups.join(', ') || '—'}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.twoPersonRule ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{r.delegationAllowed ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      r.status === 'Active'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {r.status}
                  </span>
                </td>
                {canEditGovernance && (
                  <td className="px-4 py-2">
                    {r.status === 'Active' ? (
                      <button
                        type="button"
                        onClick={() => setDisableConfirm(r)}
                        className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEnableConfirm(r)}
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        Enable
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
          <AlertCircle size={16} />
          Impact preview (placeholder)
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
          Affected deliverables by selected rule. Navigation not implemented.
        </p>
<table className="w-full text-sm text-gray-900 dark:text-white">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">ID</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Label</th>
              <th className="px-4 py-2 text-left text-gray-500 dark:text-gray-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {IMPACT_PREVIEW_ROWS.map((row) => (
              <tr key={row.ID}>
                <td className="px-4 py-2 font-mono text-xs text-gray-900 dark:text-white">{row.ID}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{row.Label}</td>
                <td className="px-4 py-2 text-gray-900 dark:text-white">{row.Status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {builderOpen && (
        <RuleBuilderModal
          onClose={() => setBuilderOpen(false)}
          onSave={(rule) => {
            dispatch({ type: 'CREATE_RULE', payload: rule })
            onShowToast('Rule created.')
            setBuilderOpen(false)
          }}
          nextRuleId={nextRuleId}
          committees={state.committees}
        />
      )}

      <ConfirmModal
        isOpen={!!disableConfirm}
        title="Disable rule"
        message={disableConfirm ? `Disable rule ${disableConfirm.ruleId}?` : ''}
        confirmLabel="Disable"
        variant="danger"
        onConfirm={() => disableConfirm && handleDisable(disableConfirm)}
        onCancel={() => setDisableConfirm(null)}
      />
      <ConfirmModal
        isOpen={!!enableConfirm}
        title="Enable rule"
        message={enableConfirm ? `Enable rule ${enableConfirm.ruleId}?` : ''}
        confirmLabel="Enable"
        onConfirm={() => enableConfirm && handleEnable(enableConfirm)}
        onCancel={() => setEnableConfirm(null)}
      />
    </div>
  )
}

interface RuleBuilderModalProps {
  onClose: () => void
  onSave: (rule: ApprovalRule) => void
  nextRuleId: () => string
  committees: { groupId: string; name: string }[]
}

function RuleBuilderModal({ onClose, onSave, nextRuleId, committees }: RuleBuilderModalProps) {
  const [appliesTo, setAppliesTo] = useState<AppliesTo>('Baseline')
  const [condition, setCondition] = useState('DAL=A OR SafetyCritical=true')
  const [requiredApprovals, setRequiredApprovals] = useState(2)
  const [requiredGroups, setRequiredGroups] = useState<string[]>([])
  const [twoPersonRule, setTwoPersonRule] = useState(true)
  const [delegationAllowed, setDelegationAllowed] = useState(false)
  const [escalationPath, setEscalationPath] = useState('')
  const [notes, setNotes] = useState('')

  const toggleGroup = (groupId: string) => {
    setRequiredGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      ruleId: nextRuleId(),
      appliesTo,
      condition,
      requiredApprovals,
      requiredGroups,
      twoPersonRule,
      delegationAllowed,
      escalationPath: escalationPath || undefined,
      notes: notes || undefined,
      status: 'Active',
    })
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Rule builder</h2>
          <button type="button" onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg" aria-label="Close">
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Applies to</label>
            <select
              value={appliesTo}
              onChange={(e) => setAppliesTo(e.target.value as AppliesTo)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            >
              {APPLIES_TO_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Condition</label>
            <input
              type="text"
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              placeholder="e.g. DAL=A OR SafetyCritical=true"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Required approvals</label>
            <input
              type="number"
              min={1}
              value={requiredApprovals}
              onChange={(e) => setRequiredApprovals(parseInt(e.target.value, 10) || 1)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Required groups</label>
            <div className="flex flex-wrap gap-2">
              {committees.map((c) => (
                <label key={c.groupId} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={requiredGroups.includes(c.groupId)}
                    onChange={() => toggleGroup(c.groupId)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={twoPersonRule}
                onChange={(e) => setTwoPersonRule(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Two-person rule
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={delegationAllowed}
                onChange={(e) => setDelegationAllowed(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              Delegation allowed
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Escalation path (optional)</label>
            <input
              type="text"
              value={escalationPath}
              onChange={(e) => setEscalationPath(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm">
              Cancel
            </button>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
              Create rule
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
